import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Phase — Generative Polyrhythm Engine" },
      {
        name: "description",
        content:
          "Browser-native generative ambient instrument. Polygon polyrhythms, glowing particle scenes, hardware-synth controls — pure Web Audio.",
      },
      { property: "og:title", content: "Phase — Generative Polyrhythm Engine" },
      {
        property: "og:description",
        content:
          "Browser-native generative ambient instrument with polygon polyrhythms and glowing particle scenes.",
      },
    ],
  }),
  component: PhaseApp,
});

/* ============================================================
 * Types
 * ============================================================ */

type VoiceKind = "chime" | "pluck" | "bell" | "pad" | "bass" | "none";
type SceneKind = "wheel" | "polygon" | "sine" | "lissajous";
type BgKind = "void" | "grid" | "drift";

type Knobs = {
  mainVol: number;   // 0..1
  pitch: number;     // -12..12 semitones
  revMix: number;    // 0..1
  revSize: number;   // 0.05..1.2 (delay seconds)
  speed: number;     // 0.25..2
  multiply: number;  // 2..12 (integer, vertex count)
  fx1: number;       // 200..8000 cutoff
  fx2: number;       // 0..40 detune cents
};

type VoiceSel = { melo: VoiceKind; bass: VoiceKind; atmo: VoiceKind };

type TriggerEvent = {
  vertex: number;
  time: number;       // audioCtx time
  freq: number;
  voice: VoiceKind;
  laneColor: string;
};

type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; hue: string;
};

type EngineState = {
  // canvas
  w: number; h: number; dpr: number;
  // rhythm
  basePeriod: number; // seconds per full cycle at speed=1
  nextFire: number[]; // per-vertex next audio time
  lastFire: number[]; // per-vertex last visual time
  pendingVisuals: TriggerEvent[]; // sorted-ish
  // particles
  particles: Particle[];
  // ambient
  dust: { x: number; y: number; vx: number; vy: number; s: number; a: number }[];
  // start
  startedAt: number; // audioCtx time when transport started
  paused: boolean;
  // wheel
  wheel: WheelState;
};

type AudioGraph = {
  ctx: AudioContext;
  master: GainNode;
  preFx: GainNode;       // input bus
  filter: BiquadFilterNode;
  chorusDelay: DelayNode;
  chorusLFO: OscillatorNode;
  chorusLFOGain: GainNode;
  chorusMix: GainNode;
  delay: DelayNode;
  feedback: GainNode;
  wet: GainNode;
  dryToMaster: GainNode;
};

/* ============================================================
 * Constants & helpers
 * ============================================================ */

const VOICES: VoiceKind[] = ["chime", "pluck", "bell", "pad", "bass", "none"];
const SCENES: SceneKind[] = ["wheel", "polygon", "sine", "lissajous"];
const BACKGROUNDS: BgKind[] = ["void", "grid", "drift"];
type VoiceSlot = "melo" | "bass" | "atmo";
const VOICE_SLOTS: VoiceSlot[] = ["melo", "bass", "atmo"];

type WheelNote = {
  id: string;
  angle: number;
  pitchIndex: number;
  prevWorld: number;
  flash: number;
};

type WheelRing = {
  id: string;
  radiusFactor: number;
  beats: number;
  subdivision: number;
  direction: 1 | -1;
  phase: number;
  voiceSlot: VoiceSlot;
  notes: WheelNote[];
  flash: number;
};

type WheelLine = {
  id: string;
  angle: number;
  flash: number;
  sparks: { x: number; y: number; t: number }[];
};

type WheelState = {
  rings: WheelRing[];
  lines: WheelLine[];
  lastFire: Map<string, number>;
};

let _uid = 0;
const uid = (p = "id") => `${p}_${++_uid}`;

function voiceSlotColor(slot: VoiceSlot, withAlpha = false): string {
  const base =
    slot === "melo" ? "oklch(0.82 0.18 195" :
    slot === "bass" ? "oklch(0.72 0.22 310" :
                      "oklch(0.86 0.16 85";
  return withAlpha ? `${base} / a)` : `${base})`;
}

function resolveVoice(slot: VoiceSlot, sel: VoiceSel): VoiceKind {
  return slot === "melo" ? sel.melo : slot === "bass" ? sel.bass : sel.atmo;
}

function ringBeatsPerRotation(r: WheelRing) {
  // One "rotation" spans a full musical phrase, not a single bar — keeps
  // wheel motion meditative even at higher tempos.
  // 4/4 → 16 beats/rotation, 3/4 → 12, 11/13 ≈ 13.5
  return (r.beats / r.subdivision) * 16;
}

function ringPeriodSec(r: WheelRing, bpm: number) {
  return (ringBeatsPerRotation(r) * 60) / Math.max(1, bpm);
}

function makeSeedWheel(): WheelState {
  const mkRing = (
    radiusFactor: number, beats: number, subdivision: number,
    direction: 1 | -1, voiceSlot: VoiceSlot, noteAngles: number[], pitchBase: number,
  ): WheelRing => ({
    id: uid("ring"),
    radiusFactor, beats, subdivision, direction,
    phase: 0, voiceSlot, flash: 0,
    notes: noteAngles.map((a, i) => ({
      id: uid("n"), angle: a, pitchIndex: pitchBase + i,
      prevWorld: a, flash: 0,
    })),
  });
  const tau = Math.PI * 2;
  return {
    rings: [
      mkRing(0.78, 4, 4, 1,  "melo",
        [0, tau * 0.25, tau * 0.5, tau * 0.75], 7),
      mkRing(0.55, 3, 4, -1, "bass",
        [0, tau / 3, (tau * 2) / 3], 3),
      mkRing(0.32, 5, 8, 1,  "atmo",
        [0, tau / 5, (tau * 2) / 5, (tau * 3) / 5, (tau * 4) / 5], 10),
    ],
    lines: [
      { id: uid("ln"), angle: Math.PI / 2, flash: 0, sparks: [] }, // vertical
    ],
    lastFire: new Map(),
  };
}

// pentatonic minor across octaves starting at A2
const SCALE_DEG = [0, 3, 5, 7, 10];
const ROOT_HZ = 110; // A2

function vertexFreq(i: number, pitchSemi: number) {
  const deg = SCALE_DEG[i % SCALE_DEG.length];
  const oct = Math.floor(i / SCALE_DEG.length);
  const semitones = deg + oct * 12 + pitchSemi;
  return ROOT_HZ * Math.pow(2, semitones / 12);
}

function vertexVoice(i: number, sel: VoiceSel): VoiceKind {
  // round-robin melo, bass, atmo
  const slot = i % 3;
  if (slot === 0) return sel.melo;
  if (slot === 1) return sel.bass;
  return sel.atmo;
}

function vertexColor(i: number, sel: VoiceSel): string {
  const slot = i % 3;
  const v = slot === 0 ? sel.melo : slot === 1 ? sel.bass : sel.atmo;
  if (v === "none") return "rgba(180,180,200,0.2)";
  if (slot === 0) return "oklch(0.82 0.18 195)";
  if (slot === 1) return "oklch(0.72 0.22 310)";
  return "oklch(0.86 0.16 85)";
}

// Phasing periods: vertex i fires (i+1) times per basePeriod, with a tiny irrational drift
function vertexPeriod(i: number, basePeriod: number) {
  const drift = 1 + i * 0.0042 * Math.SQRT2;
  return (basePeriod / (i + 1)) * drift;
}

/* ============================================================
 * Audio voices (pure oscillator)
 * ============================================================ */

function playVoice(
  ctx: AudioContext,
  dest: AudioNode,
  voice: VoiceKind,
  freq: number,
  detuneCents: number,
  startAt: number,
) {
  if (voice === "none") return;
  const env = ctx.createGain();
  env.gain.value = 0;
  env.connect(dest);

  const mk = (type: OscillatorType, f: number, det: number, gain: number) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = det;
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g);
    g.connect(env);
    return o;
  };

  let attack = 0.01, hold = 0, release = 2.5, peak = 0.5;
  const oscs: OscillatorNode[] = [];

  if (voice === "chime") {
    oscs.push(mk("sine", freq, -detuneCents, 0.35));
    oscs.push(mk("sine", freq * 2.01, detuneCents, 0.12));
    oscs.push(mk("sine", freq * 3.0, 0, 0.05));
    attack = 0.005; release = 3.2; peak = 0.55;
  } else if (voice === "pluck") {
    oscs.push(mk("triangle", freq, -detuneCents, 0.5));
    oscs.push(mk("triangle", freq * 1.005, detuneCents, 0.3));
    attack = 0.003; release = 1.4; peak = 0.7;
  } else if (voice === "bell") {
    oscs.push(mk("sine", freq, 0, 0.4));
    oscs.push(mk("sine", freq * 3.5, 0, 0.18));
    oscs.push(mk("sine", freq * 5.2, 0, 0.06));
    attack = 0.008; release = 4.5; peak = 0.5;
  } else if (voice === "pad") {
    oscs.push(mk("triangle", freq * 0.5, -detuneCents, 0.4));
    oscs.push(mk("sine", freq * 0.5 * 1.005, detuneCents, 0.3));
    oscs.push(mk("sine", freq, 0, 0.18));
    attack = 0.45; release = 3.5; peak = 0.45;
  } else if (voice === "bass") {
    oscs.push(mk("sine", freq * 0.5, -detuneCents, 0.55));
    oscs.push(mk("triangle", freq * 0.5, detuneCents, 0.18));
    attack = 0.01; release = 2.2; peak = 0.7;
  }

  const t = startAt;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);

  oscs.forEach((o) => {
    o.start(t);
    o.stop(t + attack + hold + release + 0.1);
  });
}

/* ============================================================
 * Knob component
 * ============================================================ */

function Knob({
  label,
  value,
  min,
  max,
  step = 0.01,
  defaultValue,
  display,
  onChange,
  integer = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
  display?: (v: number) => string;
  onChange: (v: number) => void;
  integer?: boolean;
}) {
  const dragging = useRef<{ y: number; v: number; fine: boolean } | null>(null);

  const clamp = (v: number) => {
    let n = Math.max(min, Math.min(max, v));
    if (integer) n = Math.round(n);
    else if (step) n = Math.round(n / step) * step;
    return n;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = { y: e.clientY, v: value, fine: e.shiftKey };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const d = dragging.current;
    const dy = d.y - e.clientY;
    const range = max - min;
    const sens = d.fine ? 0.15 : 1;
    const delta = (dy / 140) * range * sens;
    onChange(clamp(d.v + delta));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragging.current = null;
  };
  const onDouble = () => onChange(clamp(defaultValue));

  const pct = (value - min) / (max - min);
  // arc from -135deg to +135deg (270deg span)
  const start = -135;
  const end = -135 + 270 * pct;
  const r = 16;
  const cx = 22;
  const cy = 22;
  const polar = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const [sx, sy] = polar(start);
  const [ex, ey] = polar(end);
  const large = end - start > 180 ? 1 : 0;
  const bgTrackEnd = -135 + 270;
  const [tex, tey] = polar(bgTrackEnd);

  const display_ = display ?? ((v: number) => (integer ? `${Math.round(v)}` : v.toFixed(2)));

  return (
    <div className="flex flex-col items-center select-none">
      <div className="relative">
        <svg
          width={44}
          height={44}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={onDouble}
          style={{ touchAction: "none", cursor: "ns-resize" }}
        >
          <path
            d={`M ${sx} ${sy} A ${r} ${r} 0 1 1 ${tex} ${tey}`}
            fill="none"
            stroke="var(--pr-line)"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <path
            d={`M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`}
            fill="none"
            stroke="var(--pr-accent)"
            strokeWidth={2}
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 4px oklch(0.88 0.15 90 / 0.6))" }}
          />
          {/* indicator dot */}
          <circle cx={ex} cy={ey} r={1.8} fill="var(--pr-accent)" />
          <text
            x={22}
            y={25}
            textAnchor="middle"
            fontSize="9"
            fill="var(--pr-text)"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", pointerEvents: "none" }}
          >
            {display_(value)}
          </text>
        </svg>
      </div>
      <div
        className="text-[9px] uppercase tracking-[0.18em] mt-0.5"
        style={{ color: "var(--pr-muted)" }}
      >
        {label}
      </div>
    </div>
  );
}

/* ============================================================
 * Dropdown
 * ============================================================ */

function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col">
      <div
        className="text-[9px] uppercase tracking-[0.18em] mb-1"
        style={{ color: "var(--pr-muted)" }}
      >
        {label}
      </div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="appearance-none w-full pl-2.5 pr-6 py-1 text-[11px] tracking-wide rounded-sm"
          style={{
            background: "var(--pr-panel-2)",
            color: "var(--pr-text)",
            boxShadow: "inset 0 0 0 1px var(--pr-line)",
            outline: "none",
          }}
        >
          {options.map((o) => (
            <option key={o} value={o} style={{ background: "#1a1a22" }}>
              {o === "none" ? "—" : o}
            </option>
          ))}
        </select>
        <svg
          width={10}
          height={10}
          viewBox="0 0 10 10"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
        >
          <path d="M2 3.5 L5 7 L8 3.5" stroke="var(--pr-muted)" fill="none" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}

/* ============================================================
 * Main app
 * ============================================================ */

function PhaseApp() {
  const [playing, setPlaying] = useState(false);
  const [scene, setScene] = useState<SceneKind>("wheel");
  const [background, setBackground] = useState<BgKind>("drift");
  const [bpm, setBpm] = useState(90);
  // topology bump: rings/lines/notes counts so DOM overlays re-render
  const [topo, setTopo] = useState(0);
  const bumpTopo = useCallback(() => setTopo((x) => x + 1), []);
  // cached canvas client rect for positioning DOM overlays
  const [canvasRect, setCanvasRect] = useState({ w: 0, h: 0 });
  const [voices, setVoices] = useState<VoiceSel>({
    melo: "chime",
    bass: "bass",
    atmo: "pad",
  });
  const [knobs, setKnobs] = useState<Knobs>({
    mainVol: 0.55,
    pitch: 0,
    revMix: 0.45,
    revSize: 0.55,
    speed: 1,
    multiply: 5,
    fx1: 2400,
    fx2: 8,
  });

  // Refs mirror state so the engine doesn't re-subscribe
  const playingRef = useRef(playing); playingRef.current = playing;
  const sceneRef = useRef(scene); sceneRef.current = scene;
  const bgRef = useRef(background); bgRef.current = background;
  const voicesRef = useRef(voices); voicesRef.current = voices;
  const knobsRef = useRef(knobs); knobsRef.current = knobs;
  const bpmRef = useRef(bpm); bpmRef.current = bpm;

  const audioRef = useRef<AudioGraph | null>(null);
  const engineRef = useRef<EngineState>({
    w: 0, h: 0, dpr: 1,
    basePeriod: 8,
    nextFire: [],
    lastFire: [],
    pendingVisuals: [],
    particles: [],
    dust: [],
    startedAt: 0,
    paused: true,
    wheel: makeSeedWheel(),
  });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const grainPatternRef = useRef<CanvasPattern | null>(null);
  const hoverRingIdRef = useRef<string | null>(null);
  const hoverOpacityRef = useRef<number>(0);
  const lastHoverRef = useRef<string | null>(null);

  /* ---- Audio graph init ---- */
  const ensureAudio = useCallback((): AudioGraph => {
    if (audioRef.current) return audioRef.current;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx: AudioContext = new Ctx();

    const master = ctx.createGain();
    master.gain.value = knobsRef.current.mainVol;

    const preFx = ctx.createGain();
    preFx.gain.value = 1;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = knobsRef.current.fx1;
    filter.Q.value = 0.6;

    // chorus: delay modulated by LFO
    const chorusDelay = ctx.createDelay(0.05);
    chorusDelay.delayTime.value = 0.012;
    const chorusLFO = ctx.createOscillator();
    chorusLFO.frequency.value = 0.35;
    const chorusLFOGain = ctx.createGain();
    chorusLFOGain.gain.value = 0.004;
    chorusLFO.connect(chorusLFOGain);
    chorusLFOGain.connect(chorusDelay.delayTime);
    chorusLFO.start();
    const chorusMix = ctx.createGain();
    chorusMix.gain.value = 0.5;

    // delay (rev)
    const delay = ctx.createDelay(2.5);
    delay.delayTime.value = knobsRef.current.revSize;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.55;
    const wet = ctx.createGain();
    wet.gain.value = knobsRef.current.revMix;
    const dryToMaster = ctx.createGain();
    dryToMaster.gain.value = 1;

    // routing: preFx -> filter -> [dry+chorus] -> master, and -> delay -> wet -> master
    preFx.connect(filter);
    filter.connect(dryToMaster);
    filter.connect(chorusDelay);
    chorusDelay.connect(chorusMix);
    chorusMix.connect(dryToMaster);
    dryToMaster.connect(master);

    filter.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(master);

    master.connect(ctx.destination);

    audioRef.current = {
      ctx, master, preFx, filter, chorusDelay, chorusLFO, chorusLFOGain,
      chorusMix, delay, feedback, wet, dryToMaster,
    };
    return audioRef.current;
  }, []);

  /* ---- Sync knobs -> audio params ---- */
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const t = a.ctx.currentTime;
    a.master.gain.setTargetAtTime(knobs.mainVol, t, 0.04);
    a.filter.frequency.setTargetAtTime(knobs.fx1, t, 0.04);
    a.delay.delayTime.setTargetAtTime(knobs.revSize, t, 0.05);
    a.wet.gain.setTargetAtTime(knobs.revMix, t, 0.05);
    a.chorusMix.gain.setTargetAtTime(0.2 + (knobs.fx2 / 40) * 0.6, t, 0.05);
    a.chorusLFOGain.gain.setTargetAtTime(0.001 + (knobs.fx2 / 40) * 0.008, t, 0.05);
  }, [knobs]);

  /* ---- Reset rhythm when multiply / speed changes ---- */
  useEffect(() => {
    const e = engineRef.current;
    const a = audioRef.current;
    const now = a ? a.ctx.currentTime : 0;
    const base = 8 / knobs.speed;
    e.basePeriod = base;
    e.nextFire = new Array(knobs.multiply).fill(0).map((_, i) => now + vertexPeriod(i, base) * 0.3);
    e.lastFire = new Array(knobs.multiply).fill(-999);
  }, [knobs.multiply, knobs.speed]);

  /* ---- Scheduler (look-ahead 25ms tick) ---- */
  useEffect(() => {
    let interval = 0;
    const tick = () => {
      const a = audioRef.current;
      if (!a || !playingRef.current) return;
      // Wheel scene has its own RAF-driven triggering; skip polygon scheduler.
      if (sceneRef.current === "wheel") return;
      const e = engineRef.current;
      const k = knobsRef.current;
      const v = voicesRef.current;
      const horizon = a.ctx.currentTime + 0.15;

      // ensure arrays sized to multiply
      if (e.nextFire.length !== k.multiply) {
        const now = a.ctx.currentTime;
        e.nextFire = new Array(k.multiply).fill(0).map((_, i) => now + vertexPeriod(i, e.basePeriod) * 0.3);
        e.lastFire = new Array(k.multiply).fill(-999);
      }

      for (let i = 0; i < k.multiply; i++) {
        const period = vertexPeriod(i, e.basePeriod);
        while (e.nextFire[i] < horizon) {
          const t = e.nextFire[i];
          const voice = vertexVoice(i, v);
          const freq = vertexFreq(i, k.pitch);
          if (voice !== "none") {
            playVoice(a.ctx, a.preFx, voice, freq, k.fx2, t);
          }
          e.pendingVisuals.push({
            vertex: i,
            time: t,
            freq,
            voice,
            laneColor: vertexColor(i, v),
          });
          e.nextFire[i] = t + period;
        }
      }
    };
    interval = window.setInterval(tick, 25);
    return () => clearInterval(interval);
  }, []);

  /* ---- RAF render loop ---- */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const onResize = () => {
      const c = canvasRef.current; if (!c) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = c.getBoundingClientRect();
      c.width = Math.floor(rect.width * dpr);
      c.height = Math.floor(rect.height * dpr);
      engineRef.current.w = rect.width;
      engineRef.current.h = rect.height;
      engineRef.current.dpr = dpr;
      setCanvasRect({ w: rect.width, h: rect.height });
      grainPatternRef.current = null; // regenerate grain to match dpr
    };
    onResize();
    window.addEventListener("resize", onResize);

    // seed dust
    const dust = engineRef.current.dust;
    for (let i = 0; i < 90; i++) {
      dust.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.005,
        vy: (Math.random() - 0.5) * 0.005,
        s: 0.4 + Math.random() * 1.6,
        a: 0.05 + Math.random() * 0.35,
      });
    }

    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      render(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Renderer ---- */
  const render = (dt: number) => {
    const c = canvasRef.current; if (!c) return;
    const ctx2d = c.getContext("2d"); if (!ctx2d) return;
    const e = engineRef.current;
    const k = knobsRef.current;
    const v = voicesRef.current;
    const a = audioRef.current;
    const audioNow = a ? a.ctx.currentTime : 0;

    const W = e.w, H = e.h;
    ctx2d.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
    const isWheelScene = sceneRef.current === "wheel";

    if (isWheelScene) {
      // ART SURFACE: opaque charcoal base + vignette + tiled grain
      paintArtBackground(ctx2d, W, H, grainPatternRef);
    } else {
      // background fade (creates motion trails) — non-wheel scenes
      ctx2d.fillStyle = "oklch(0.09 0.01 260 / 0.35)";
      ctx2d.fillRect(0, 0, W, H);
      drawBackground(ctx2d, W, H, bgRef.current, e, dt);
    }

    // process pending visual triggers whose time has come
    if (a) {
      const pv = e.pendingVisuals;
      for (let i = pv.length - 1; i >= 0; i--) {
        if (pv[i].time <= audioNow) {
          const ev = pv[i];
          if (ev.vertex < k.multiply) {
            spawnTriggerVisual(e, ev, sceneRef.current, W, H, k);
            e.lastFire[ev.vertex] = audioNow;
          }
          pv.splice(i, 1);
        }
      }
    }

    // draw scene
    if (isWheelScene) {
      // update wheel physics + trigger detection (audio + visuals)
      if (a && playingRef.current) {
        updateWheel(e.wheel, dt, a, bpmRef.current, voicesRef.current, knobsRef.current);
      } else {
        // decay flashes even when paused
        decayWheelFlashes(e.wheel, dt);
      }
      // ghost text behind everything
      const targetOp = hoverRingIdRef.current ? 1 : 0;
      hoverOpacityRef.current += (targetOp - hoverOpacityRef.current) * Math.min(1, dt * 6);
      if (hoverOpacityRef.current > 0.01) {
        const ring = e.wheel.rings.find(r => r.id === hoverRingIdRef.current)
          ?? e.wheel.rings.find(r => r.id === lastHoverRef.current);
        if (ring) {
          lastHoverRef.current = ring.id;
          drawGhostReadout(ctx2d, W, H, ringPeriodSec(ring, bpmRef.current), hoverOpacityRef.current);
        }
      }
      ctx2d.globalCompositeOperation = "lighter";
      drawWheelScene(ctx2d, W, H, e.wheel, voicesRef.current, dt, hoverRingIdRef.current);
    } else {
      ctx2d.globalCompositeOperation = "lighter";
      if (sceneRef.current === "polygon") drawPolygonScene(ctx2d, W, H, e, k, v, audioNow);
      else if (sceneRef.current === "sine") drawSineScene(ctx2d, W, H, e, k, v, audioNow);
      else drawLissajousScene(ctx2d, W, H, e, k, v, audioNow);
    }

    // particles
    if (!isWheelScene) drawParticles(ctx2d, e, dt);

    ctx2d.globalCompositeOperation = "source-over";

    if (!isWheelScene) {
      ctx2d.save();
      ctx2d.fillStyle = "oklch(0.6 0.04 80 / 0.07)";
      ctx2d.font = "600 64px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";
      ctx2d.textAlign = "center";
      ctx2d.textBaseline = "middle";
      ctx2d.letterSpacing = "12px" as unknown as string;
      ctx2d.fillText("PHASE", W / 2, H / 2 - 16);
      ctx2d.font = "500 18px ui-sans-serif, system-ui";
      ctx2d.fillText("RHYTHMS", W / 2, H / 2 + 30);
      ctx2d.restore();
    }
  };

  /* ---- Transport ---- */
  const togglePlay = async () => {
    const a = ensureAudio();
    if (a.ctx.state === "suspended") await a.ctx.resume();
    const e = engineRef.current;
    if (!playing) {
      // (re)seed timers anchored at now
      const now = a.ctx.currentTime;
      e.nextFire = new Array(knobs.multiply).fill(0).map((_, i) => now + vertexPeriod(i, e.basePeriod) * 0.2);
      e.lastFire = new Array(knobs.multiply).fill(-999);
      e.pendingVisuals = [];
      e.startedAt = now;
    }
    setPlaying((p) => !p);
  };

  const setKnob = (key: keyof Knobs, val: number) =>
    setKnobs((k) => ({ ...k, [key]: val }));

  const isWheel = scene === "wheel";

  /* ---- Wheel pointer interaction ---- */
  const onCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (sceneRef.current !== "wheel") return;
    const c = canvasRef.current; if (!c) return;
    const rect = c.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const handled = wheelHandleClick(engineRef.current.wheel, px, py, rect.width, rect.height);
    if (handled) bumpTopo();
  };

  /* ---- Wheel ring/line mutators ---- */
  const addRing = () => {
    const wh = engineRef.current.wheel;
    const used = new Set(wh.rings.map((r) => r.radiusFactor));
    const candidates = [0.85, 0.7, 0.55, 0.4, 0.25, 0.95, 0.48, 0.62];
    const rf = candidates.find((c) => !used.has(c)) ?? 0.5;
    const slot = VOICE_SLOTS[wh.rings.length % 3];
    wh.rings.push({
      id: uid("ring"),
      radiusFactor: rf,
      beats: 4, subdivision: 4, direction: wh.rings.length % 2 === 0 ? 1 : -1,
      phase: 0, voiceSlot: slot, notes: [], flash: 0,
    });
    bumpTopo();
  };
  const removeRing = (id: string) => {
    const wh = engineRef.current.wheel;
    wh.rings = wh.rings.filter((r) => r.id !== id);
    bumpTopo();
  };
  const addLine = () => {
    const wh = engineRef.current.wheel;
    const presets = [Math.PI / 2, 0, Math.PI / 4, (3 * Math.PI) / 4, Math.PI / 6, (5 * Math.PI) / 6];
    const used = new Set(wh.lines.map((l) => Math.round(l.angle * 1000)));
    const a = presets.find((p) => !used.has(Math.round(p * 1000))) ?? Math.random() * Math.PI;
    wh.lines.push({ id: uid("ln"), angle: a, flash: 0, sparks: [] });
    bumpTopo();
  };
  const removeLine = (id: string) => {
    const wh = engineRef.current.wheel;
    wh.lines = wh.lines.filter((l) => l.id !== id);
    bumpTopo();
  };
  const setLineAngle = (id: string, angle: number) => {
    const wh = engineRef.current.wheel;
    const l = wh.lines.find((x) => x.id === id);
    if (l) { l.angle = angle; bumpTopo(); }
  };
  const updateRing = (id: string, patch: Partial<WheelRing>) => {
    const wh = engineRef.current.wheel;
    const r = wh.rings.find((x) => x.id === id);
    if (!r) return;
    Object.assign(r, patch);
    bumpTopo();
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: "var(--pr-bg-2)", color: "var(--pr-text)" }}
    >
      {/* TOP CONTROL STRIP */}
      <header
        className="flex items-center gap-4 px-4 py-2.5 border-b"
        style={{
          background: "linear-gradient(180deg, oklch(0.16 0.013 260) 0%, oklch(0.13 0.012 260) 100%)",
          borderColor: "var(--pr-line)",
          minHeight: 72,
        }}
      >
        <div className="flex items-end gap-3 pr-3 mr-1 border-r" style={{ borderColor: "var(--pr-line-soft)" }}>
          <Dropdown label="scene" value={scene} options={SCENES} onChange={setScene} />
          <Dropdown label="background" value={background} options={BACKGROUNDS} onChange={setBackground} />
        </div>

        <div className="flex items-end gap-3 pr-3 mr-1 border-r" style={{ borderColor: "var(--pr-line-soft)" }}>
          <Dropdown label="melo-sound" value={voices.melo} options={VOICES} onChange={(v) => setVoices((s) => ({ ...s, melo: v }))} />
          <Dropdown label="bass-sound" value={voices.bass} options={VOICES} onChange={(v) => setVoices((s) => ({ ...s, bass: v }))} />
          <Dropdown label="atmo-sound" value={voices.atmo} options={VOICES} onChange={(v) => setVoices((s) => ({ ...s, atmo: v }))} />
        </div>

        <div className="flex items-center gap-2">
          <Knob label="main-vol" value={knobs.mainVol} min={0} max={1} defaultValue={0.55}
                display={(v) => `${Math.round(v * 100)}`}
                onChange={(v) => setKnob("mainVol", v)} />
          <Knob label="pitch" value={knobs.pitch} min={-12} max={12} step={1} integer defaultValue={0}
                display={(v) => `${v > 0 ? "+" : ""}${Math.round(v)}`}
                onChange={(v) => setKnob("pitch", v)} />
          <Knob label="rev-mix" value={knobs.revMix} min={0} max={1} defaultValue={0.45}
                display={(v) => `${Math.round(v * 100)}`}
                onChange={(v) => setKnob("revMix", v)} />
          <Knob label="rev-size" value={knobs.revSize} min={0.05} max={1.2} defaultValue={0.55}
                display={(v) => `${Math.round(v * 100)}`}
                onChange={(v) => setKnob("revSize", v)} />
          {!isWheel && (
            <>
              <Knob label="speed" value={knobs.speed} min={0.25} max={2.5} defaultValue={1}
                    display={(v) => v.toFixed(2)}
                    onChange={(v) => setKnob("speed", v)} />
              <Knob label="multiply" value={knobs.multiply} min={2} max={12} step={1} integer defaultValue={5}
                    display={(v) => `${Math.round(v)}`}
                    onChange={(v) => setKnob("multiply", v)} />
            </>
          )}
          <Knob label="fx-1" value={knobs.fx1} min={200} max={8000} step={10} defaultValue={2400}
                display={(v) => `${Math.round(v / 100)}`}
                onChange={(v) => setKnob("fx1", v)} />
          <Knob label="fx-2" value={knobs.fx2} min={0} max={40} step={1} integer defaultValue={8}
                display={(v) => `${Math.round(v)}`}
                onChange={(v) => setKnob("fx2", v)} />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="h-9 px-4 rounded-sm text-[11px] tracking-[0.25em] uppercase transition-all"
            style={{
              background: playing ? "var(--pr-accent)" : "var(--pr-panel-2)",
              color: playing ? "#1a1a22" : "var(--pr-text)",
              boxShadow: playing
                ? "0 0 22px oklch(0.88 0.15 90 / 0.5)"
                : "inset 0 0 0 1px var(--pr-line)",
            }}
          >
            {playing ? "■ pause" : "▶ play"}
          </button>
        </div>
      </header>

      {/* CANVAS */}
      <main className="flex-1 relative" style={{ minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
          style={{ background: "oklch(0.09 0.01 260)", cursor: isWheel ? "crosshair" : "default" }}
          onPointerDown={onCanvasPointerDown}
        />
        {isWheel && (
          <WheelOverlays
            wheel={engineRef.current.wheel}
            topo={topo}
            canvasW={canvasRect.w}
            canvasH={canvasRect.h}
            onAddRing={addRing}
            onAddLine={addLine}
            onRemoveRing={removeRing}
            onRemoveLine={removeLine}
            onSetLineAngle={setLineAngle}
            onUpdateRing={updateRing}
          />
        )}
      </main>

      {/* BOTTOM BPM DOCK */}
      <footer
        className="flex items-center gap-4 px-5 py-2.5 border-t"
        style={{
          background: "linear-gradient(0deg, oklch(0.16 0.013 260) 0%, oklch(0.13 0.012 260) 100%)",
          borderColor: "var(--pr-line)",
        }}
      >
        <div className="text-[9px] uppercase tracking-[0.2em]" style={{ color: "var(--pr-muted)" }}>
          tempo
        </div>
        <input
          type="range"
          min={20} max={180} step={1}
          value={bpm}
          onChange={(e) => setBpm(parseInt(e.target.value, 10))}
          className="pr-slider flex-1"
        />
        <div className="text-sm tabular-nums tracking-wider" style={{ color: "var(--pr-text)" }}>
          {bpm} <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--pr-muted)" }}>bpm</span>
        </div>
      </footer>
    </div>
  );
}

/* ============================================================
 * Visual triggers — spawn particles per scene
 * ============================================================ */

function spawnTriggerVisual(
  e: EngineState, ev: TriggerEvent, scene: SceneKind, W: number, H: number, k: Knobs,
) {
  const slot = ev.vertex % 3;
  const hue = slot === 0
    ? "oklch(0.82 0.18 195 / a)"
    : slot === 1
    ? "oklch(0.72 0.22 310 / a)"
    : "oklch(0.86 0.16 85 / a)";

  let cx = W / 2, cy = H / 2;

  if (scene === "polygon") {
    const r = Math.min(W, H) * 0.36;
    const ang = (ev.vertex / k.multiply) * Math.PI * 2 - Math.PI / 2;
    cx = W / 2 + Math.cos(ang) * r;
    cy = H / 2 + Math.sin(ang) * r;
  } else if (scene === "sine") {
    const spacing = (H * 0.7) / Math.max(1, k.multiply - 1);
    cx = W * 0.18;
    cy = H * 0.15 + ev.vertex * spacing;
  } else {
    // lissajous: position on curve at vertex's phase
    const a = 3, b = 4;
    const phase = (ev.vertex / k.multiply) * Math.PI * 2;
    cx = W / 2 + Math.cos(a * phase) * W * 0.32;
    cy = H / 2 + Math.sin(b * phase + Math.PI / 4) * H * 0.32;
  }

  const count = 18 + Math.floor(Math.random() * 10);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 30 + Math.random() * 160;
    e.particles.push({
      x: cx, y: cy,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      life: 0,
      max: 0.8 + Math.random() * 1.4,
      size: 0.6 + Math.random() * 1.8,
      hue,
    });
  }

  if (e.particles.length > 2400) e.particles.splice(0, e.particles.length - 2400);
}

/* ============================================================
 * Backgrounds
 * ============================================================ */

function drawBackground(
  ctx: CanvasRenderingContext2D, W: number, H: number, bg: BgKind, e: EngineState, dt: number,
) {
  if (bg === "void") return;
  if (bg === "grid") {
    ctx.save();
    ctx.strokeStyle = "oklch(0.3 0.018 260 / 0.18)";
    ctx.lineWidth = 1;
    const step = 60;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
    return;
  }
  // drift
  ctx.save();
  for (const d of e.dust) {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.x < 0) d.x = 1; if (d.x > 1) d.x = 0;
    if (d.y < 0) d.y = 1; if (d.y > 1) d.y = 0;
    ctx.fillStyle = `oklch(0.85 0.04 260 / ${d.a})`;
    ctx.beginPath();
    ctx.arc(d.x * W, d.y * H, d.s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ============================================================
 * Particles
 * ============================================================ */

function drawParticles(ctx: CanvasRenderingContext2D, e: EngineState, dt: number) {
  const ps = e.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life += dt;
    if (p.life >= p.max) { ps.splice(i, 1); continue; }
    // ease
    const k = 1 - Math.pow(0.05, dt); // drag
    p.vx *= 1 - k * 0.6;
    p.vy *= 1 - k * 0.6;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const lifeT = p.life / p.max;
    const alpha = (1 - lifeT) * 0.85;
    ctx.fillStyle = p.hue.replace("a", alpha.toFixed(3));
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1 - lifeT * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ============================================================
 * Scenes
 * ============================================================ */

function nodeGlow(
  ctx: CanvasRenderingContext2D, x: number, y: number, color: string, intensity: number, baseR: number,
) {
  const r = baseR + intensity * 18;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace("a", (0.9 * (0.4 + intensity * 0.6)).toFixed(3)));
  g.addColorStop(0.4, color.replace("a", (0.3 * intensity).toFixed(3)));
  g.addColorStop(1, color.replace("a", "0"));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // crisp ring
  ctx.strokeStyle = color.replace("a", (0.6 + intensity * 0.4).toFixed(3));
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, baseR, 0, Math.PI * 2);
  ctx.stroke();
}

function intensityFromLastFire(now: number, last: number) {
  if (last < 0) return 0;
  const dt = now - last;
  if (dt < 0) return 0;
  const decay = 0.6; // seconds
  return Math.max(0, 1 - dt / decay);
}

function colorForVertex(i: number, v: VoiceSel): string {
  const slot = i % 3;
  const voice = slot === 0 ? v.melo : slot === 1 ? v.bass : v.atmo;
  if (voice === "none") return "oklch(0.5 0.02 260 / a)";
  if (slot === 0) return "oklch(0.82 0.18 195 / a)";
  if (slot === 1) return "oklch(0.72 0.22 310 / a)";
  return "oklch(0.86 0.16 85 / a)";
}

function drawPolygonScene(
  ctx: CanvasRenderingContext2D, W: number, H: number, e: EngineState, k: Knobs, v: VoiceSel, now: number,
) {
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) * 0.36;

  // faint reference circle
  ctx.strokeStyle = "oklch(0.5 0.03 260 / 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  // collect positions
  const positions: { x: number; y: number; intensity: number; color: string }[] = [];
  for (let i = 0; i < k.multiply; i++) {
    const ang = (i / k.multiply) * Math.PI * 2 - Math.PI / 2;
    positions.push({
      x: cx + Math.cos(ang) * R,
      y: cy + Math.sin(ang) * R,
      intensity: intensityFromLastFire(now, e.lastFire[i] ?? -999),
      color: colorForVertex(i, v),
    });
  }

  // connecting web (lines between vertices that fired recently together)
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = Math.min(positions[i].intensity, positions[j].intensity);
      if (a < 0.04) continue;
      ctx.strokeStyle = `oklch(0.82 0.08 220 / ${(a * 0.45).toFixed(3)})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(positions[i].x, positions[i].y);
      ctx.lineTo(positions[j].x, positions[j].y);
      ctx.stroke();
    }
  }

  // nodes
  for (const p of positions) {
    nodeGlow(ctx, p.x, p.y, p.color, p.intensity, 9);
  }
}

function drawSineScene(
  ctx: CanvasRenderingContext2D, W: number, H: number, e: EngineState, k: Knobs, v: VoiceSel, now: number,
) {
  const colX = W * 0.18;
  const top = H * 0.15;
  const spacing = (H * 0.7) / Math.max(1, k.multiply - 1);

  // axis line
  ctx.strokeStyle = "oklch(0.45 0.03 260 / 0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(colX, top - 20);
  ctx.lineTo(colX, top + spacing * (k.multiply - 1) + 20);
  ctx.stroke();

  for (let i = 0; i < k.multiply; i++) {
    const x = colX;
    const y = top + i * spacing;
    const intensity = intensityFromLastFire(now, e.lastFire[i] ?? -999);
    const color = colorForVertex(i, v);
    // expanding ring on trigger
    if (intensity > 0) {
      const r = 12 + (1 - intensity) * 80;
      ctx.strokeStyle = color.replace("a", (intensity * 0.4).toFixed(3));
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      // trailing streak rightward
      const grd = ctx.createLinearGradient(x, y, W, y);
      grd.addColorStop(0, color.replace("a", (intensity * 0.5).toFixed(3)));
      grd.addColorStop(1, color.replace("a", "0"));
      ctx.fillStyle = grd;
      ctx.fillRect(x, y - 0.6 - intensity * 1.2, W - x, 1.2 + intensity * 2.4);
    }
    nodeGlow(ctx, x, y, color, intensity, 10);
  }
}

function drawLissajousScene(
  ctx: CanvasRenderingContext2D, W: number, H: number, e: EngineState, k: Knobs, v: VoiceSel, now: number,
) {
  const cx = W / 2, cy = H / 2;
  const A = W * 0.32, B = H * 0.32;
  const a = 3, b = 4;

  // curve trail
  ctx.strokeStyle = "oklch(0.7 0.08 220 / 0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const steps = 220;
  for (let s = 0; s <= steps; s++) {
    const t = (s / steps) * Math.PI * 2;
    const x = cx + Math.cos(a * t) * A;
    const y = cy + Math.sin(b * t + Math.PI / 4) * B;
    if (s === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  for (let i = 0; i < k.multiply; i++) {
    const phase = (i / k.multiply) * Math.PI * 2;
    const x = cx + Math.cos(a * phase) * A;
    const y = cy + Math.sin(b * phase + Math.PI / 4) * B;
    const intensity = intensityFromLastFire(now, e.lastFire[i] ?? -999);
    nodeGlow(ctx, x, y, colorForVertex(i, v), intensity, 7);
  }
}

/* ============================================================
 * Wheel — update, render, hit-testing, overlays
 * ============================================================ */

const TAU = Math.PI * 2;

function norm2pi(a: number) { return ((a % TAU) + TAU) % TAU; }

// Returns smallest forward distance from prev to target (prev → +ω → target).
function fwdDist(prev: number, target: number) {
  return ((target - prev) % TAU + TAU) % TAU;
}

function ringRadiusPx(r: WheelRing, W: number, H: number) {
  return (r.radiusFactor * Math.min(W, H)) / 2;
}

function pitchIndexForAngle(angle: number, ringIdx: number, ringsCount: number) {
  const buckets = 8;
  const step = Math.floor(norm2pi(angle) / (TAU / buckets)) % SCALE_DEG.length;
  const oct = Math.max(0, ringsCount - 1 - ringIdx); // outer ring lower
  return step + oct * SCALE_DEG.length;
}

function decayWheelFlashes(wh: WheelState, dt: number) {
  const k = 1 - Math.exp(-dt * 3.2);
  for (const r of wh.rings) {
    r.flash = Math.max(0, r.flash - k);
    for (const n of r.notes) n.flash = Math.max(0, n.flash - k);
  }
  for (const l of wh.lines) {
    l.flash = Math.max(0, l.flash - k);
    for (let i = l.sparks.length - 1; i >= 0; i--) {
      l.sparks[i].t -= dt;
      if (l.sparks[i].t <= 0) l.sparks.splice(i, 1);
    }
  }
}

function updateWheel(
  wh: WheelState, dt: number, audio: AudioGraph, bpm: number, voices: VoiceSel, knobs: Knobs,
) {
  const now = audio.ctx.currentTime;
  const REFRACTORY = 0.04; // 40 ms

  decayWheelFlashes(wh, dt);

  for (const ring of wh.rings) {
    const period = ringPeriodSec(ring, bpm);
    const omega = TAU / Math.max(0.001, period); // rad/s
    const sign = ring.direction;
    const prevPhase = ring.phase;
    ring.phase = prevPhase + sign * omega * dt;

    const voice = resolveVoice(ring.voiceSlot, voices);

    for (const note of ring.notes) {
      const prevWorld = norm2pi(note.angle + prevPhase * sign);
      const newWorld = norm2pi(note.angle + ring.phase * sign);

      // For each line, two target angles: angle and angle+π
      for (const line of wh.lines) {
        for (let s = 0; s < 2; s++) {
          const target = norm2pi(line.angle + s * Math.PI);
          let crossed = false;
          if (sign > 0) {
            const d = fwdDist(prevWorld, newWorld);
            const dt2 = fwdDist(prevWorld, target);
            if (dt2 > 0 && dt2 <= d) crossed = true;
          } else {
            const d = fwdDist(newWorld, prevWorld);
            const dt2 = fwdDist(newWorld, target);
            if (dt2 > 0 && dt2 <= d) crossed = true;
          }
          if (crossed) {
            const key = `${note.id}|${line.id}|${s}`;
            const last = wh.lastFire.get(key) ?? -999;
            if (now - last < REFRACTORY) continue;
            wh.lastFire.set(key, now);

            if (voice !== "none") {
              const freq = vertexFreq(note.pitchIndex, knobs.pitch);
              playVoice(audio.ctx, audio.preFx, voice, freq, knobs.fx2, now);
            }
            note.flash = 1;
            ring.flash = Math.max(ring.flash, 0.7);
            line.flash = 1;
            // record spark location for visual (approx at target angle, radius of ring)
            // we don't have W/H here; store in normalized polar (target, ringId)
            line.sparks.push({ x: target, y: ring.radiusFactor, t: 0.6 });
          }
        }
      }
      note.prevWorld = newWorld;
    }
  }
}

function wheelHandleClick(wh: WheelState, px: number, py: number, W: number, H: number): boolean {
  const cx = W / 2, cy = H / 2;
  const dx = px - cx, dy = py - cy;
  const r = Math.hypot(dx, dy);
  const ang = norm2pi(Math.atan2(dy, dx));

  // 1) try to remove an existing note (within 14px)
  for (const ring of wh.rings) {
    const ringR = ringRadiusPx(ring, W, H);
    const sign = ring.direction;
    for (let i = ring.notes.length - 1; i >= 0; i--) {
      const n = ring.notes[i];
      const wn = norm2pi(n.angle + ring.phase * sign);
      const nx = cx + Math.cos(wn) * ringR;
      const ny = cy + Math.sin(wn) * ringR;
      if (Math.hypot(px - nx, py - ny) < 14) {
        ring.notes.splice(i, 1);
        return true;
      }
    }
  }

  // 2) add note to nearest ring (within 14px radial)
  let best: WheelRing | null = null;
  let bestIdx = -1;
  let bestDist = Infinity;
  wh.rings.forEach((ring, idx) => {
    const ringR = ringRadiusPx(ring, W, H);
    const d = Math.abs(r - ringR);
    if (d < 14 && d < bestDist) { best = ring; bestIdx = idx; bestDist = d; }
  });
  if (best) {
    const ring = best as WheelRing;
    const sign = ring.direction;
    const localAngle = norm2pi(ang - ring.phase * sign);
    const note: WheelNote = {
      id: uid("n"),
      angle: localAngle,
      pitchIndex: pitchIndexForAngle(localAngle, bestIdx, wh.rings.length),
      prevWorld: ang,
      flash: 0.9,
    };
    ring.notes.push(note);
    return true;
  }
  return false;
}

function drawWheelScene(
  ctx: CanvasRenderingContext2D, W: number, H: number, wh: WheelState, voices: VoiceSel,
) {
  const cx = W / 2, cy = H / 2;
  const maxR = Math.min(W, H) / 2;

  // 1) rings (faint stroke, brighten with flash)
  for (const ring of wh.rings) {
    const R = ringRadiusPx(ring, W, H);
    const color = voiceSlotColor(ring.voiceSlot, true);
    ctx.strokeStyle = color.replace("a", (0.18 + ring.flash * 0.5).toFixed(3));
    ctx.lineWidth = 1 + ring.flash * 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
  }

  // 2) lines (chord across the wheel)
  for (const line of wh.lines) {
    const x1 = cx + Math.cos(line.angle) * maxR * 0.96;
    const y1 = cy + Math.sin(line.angle) * maxR * 0.96;
    const x2 = cx - Math.cos(line.angle) * maxR * 0.96;
    const y2 = cy - Math.sin(line.angle) * maxR * 0.96;
    // soft glow
    ctx.strokeStyle = `oklch(0.92 0.05 80 / ${(0.18 + line.flash * 0.55).toFixed(3)})`;
    ctx.lineWidth = 1 + line.flash * 1.8;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.stroke();
    // sparks at crossing points
    for (const s of line.sparks) {
      const sx = cx + Math.cos(s.x) * s.y * (Math.min(W, H) / 2);
      const sy = cy + Math.sin(s.x) * s.y * (Math.min(W, H) / 2);
      const a = Math.max(0, s.t / 0.6);
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 22 * a + 4);
      g.addColorStop(0, `oklch(1 0.04 90 / ${(0.7 * a).toFixed(3)})`);
      g.addColorStop(1, "oklch(1 0.04 90 / 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, 22 * a + 4, 0, TAU);
      ctx.fill();
    }
  }

  // 3) notes
  for (const ring of wh.rings) {
    const R = ringRadiusPx(ring, W, H);
    const sign = ring.direction;
    const color = voiceSlotColor(ring.voiceSlot, true);
    for (const n of ring.notes) {
      const w = norm2pi(n.angle + ring.phase * sign);
      const nx = cx + Math.cos(w) * R;
      const ny = cy + Math.sin(w) * R;
      const inten = n.flash;
      // outer halo
      const baseR = 5 + inten * 12;
      const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, baseR + 14);
      g.addColorStop(0, color.replace("a", (0.9 * (0.45 + inten * 0.55)).toFixed(3)));
      g.addColorStop(0.5, color.replace("a", (0.25 * (0.3 + inten * 0.7)).toFixed(3)));
      g.addColorStop(1, color.replace("a", "0"));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(nx, ny, baseR + 14, 0, TAU);
      ctx.fill();
      // crisp ring
      ctx.strokeStyle = color.replace("a", (0.65 + inten * 0.35).toFixed(3));
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(nx, ny, 4.5, 0, TAU);
      ctx.stroke();
    }
  }
}

/* ---- Wheel DOM overlays ---- */

function WheelOverlays({
  wheel, topo, canvasW, canvasH,
  onAddRing, onAddLine, onRemoveRing, onRemoveLine, onSetLineAngle, onUpdateRing,
}: {
  wheel: WheelState;
  topo: number;
  canvasW: number;
  canvasH: number;
  onAddRing: () => void;
  onAddLine: () => void;
  onRemoveRing: (id: string) => void;
  onRemoveLine: (id: string) => void;
  onSetLineAngle: (id: string, angle: number) => void;
  onUpdateRing: (id: string, patch: Partial<WheelRing>) => void;
}) {
  // touch topo so eslint doesn't whine and to force re-render
  void topo;

  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const maxR = Math.min(canvasW, canvasH) / 2;

  return (
    <>
      {/* Add buttons */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 select-none">
        <button
          onClick={onAddRing}
          className="px-2 py-1 text-[10px] uppercase tracking-[0.2em] rounded-sm"
          style={{ background: "var(--pr-panel-2)", color: "var(--pr-text)", boxShadow: "inset 0 0 0 1px var(--pr-line)" }}
        >
          + ring
        </button>
        <button
          onClick={onAddLine}
          className="px-2 py-1 text-[10px] uppercase tracking-[0.2em] rounded-sm"
          style={{ background: "var(--pr-panel-2)", color: "var(--pr-text)", boxShadow: "inset 0 0 0 1px var(--pr-line)" }}
        >
          + line
        </button>
        <div className="mt-1 text-[9px] uppercase tracking-[0.18em] opacity-60" style={{ color: "var(--pr-muted)" }}>
          click a ring to add a note<br />click a note to remove
        </div>
      </div>

      {/* Ring chips on the right edge of each ring */}
      {wheel.rings.map((r) => {
        const R = (r.radiusFactor * Math.min(canvasW, canvasH)) / 2;
        const left = cx + R + 8;
        const top = cy - 12;
        return (
          <RingChip
            key={r.id}
            ring={r}
            left={left}
            top={top}
            onRemove={() => onRemoveRing(r.id)}
            onUpdate={(patch) => onUpdateRing(r.id, patch)}
          />
        );
      })}

      {/* Line handles at the +angle endpoint */}
      {wheel.lines.map((l) => (
        <LineHandle
          key={l.id}
          line={l}
          cx={cx} cy={cy} maxR={maxR}
          onSetAngle={(a) => onSetLineAngle(l.id, a)}
          onRemove={() => onRemoveLine(l.id)}
        />
      ))}
    </>
  );
}

function RingChip({
  ring, left, top, onRemove, onUpdate,
}: {
  ring: WheelRing;
  left: number; top: number;
  onRemove: () => void;
  onUpdate: (patch: Partial<WheelRing>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(`${ring.beats}/${ring.subdivision}`);

  const commit = () => {
    const m = val.trim().match(/^(\d{1,3})\s*\/\s*(\d{1,3})$/);
    if (m) {
      const n = Math.max(1, Math.min(32, parseInt(m[1], 10)));
      const d = Math.max(1, Math.min(32, parseInt(m[2], 10)));
      onUpdate({ beats: n, subdivision: d });
    }
    setEditing(false);
    setVal(`${ring.beats}/${ring.subdivision}`);
  };

  const dot = ring.voiceSlot === "melo" ? "oklch(0.82 0.18 195)" :
              ring.voiceSlot === "bass" ? "oklch(0.72 0.22 310)" : "oklch(0.86 0.16 85)";

  const cycleSlot = () => {
    const i = VOICE_SLOTS.indexOf(ring.voiceSlot);
    onUpdate({ voiceSlot: VOICE_SLOTS[(i + 1) % VOICE_SLOTS.length] });
  };

  return (
    <div
      className="absolute flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm text-[10px] tracking-wider select-none"
      style={{
        left, top,
        background: "oklch(0.13 0.012 260 / 0.85)",
        boxShadow: "inset 0 0 0 1px var(--pr-line)",
        color: "var(--pr-text)",
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
      }}
    >
      <button title="cycle voice" onClick={cycleSlot}
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: dot, boxShadow: `0 0 6px ${dot}` }} />
      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setVal(`${ring.beats}/${ring.subdivision}`); } }}
          className="w-12 bg-transparent outline-none border-b"
          style={{ borderColor: "var(--pr-line)", color: "var(--pr-text)" }}
        />
      ) : (
        <button onClick={() => { setVal(`${ring.beats}/${ring.subdivision}`); setEditing(true); }}>
          {ring.beats}/{ring.subdivision}
        </button>
      )}
      <button
        title="toggle direction"
        onClick={() => onUpdate({ direction: (ring.direction === 1 ? -1 : 1) as 1 | -1 })}
        style={{ color: "var(--pr-muted)" }}
      >
        {ring.direction === 1 ? "↻" : "↺"}
      </button>
      <span style={{ color: "var(--pr-muted)" }}>·</span>
      <button onClick={cycleSlot} style={{ color: "var(--pr-muted)" }}>{ring.voiceSlot}</button>
      <button onClick={onRemove} style={{ color: "var(--pr-muted)" }} title="remove ring">×</button>
    </div>
  );
}

function LineHandle({
  line, cx, cy, maxR, onSetAngle, onRemove,
}: {
  line: WheelLine;
  cx: number; cy: number; maxR: number;
  onSetAngle: (a: number) => void;
  onRemove: () => void;
}) {
  const dragging = useRef(false);

  const hx = cx + Math.cos(line.angle) * maxR * 0.96;
  const hy = cy + Math.sin(line.angle) * maxR * 0.96;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    e.stopPropagation();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const target = e.currentTarget as HTMLElement;
    const parent = target.parentElement?.getBoundingClientRect();
    if (!parent) return;
    const px = e.clientX - parent.left;
    const py = e.clientY - parent.top;
    const a = Math.atan2(py - cy, px - cx);
    onSetAngle(a);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragging.current = false;
  };

  return (
    <>
      <div
        className="absolute"
        style={{
          left: hx - 10, top: hy - 10, width: 20, height: 20,
          borderRadius: 999,
          background: "oklch(0.13 0.012 260 / 0.85)",
          boxShadow: "inset 0 0 0 1px oklch(0.92 0.05 80 / 0.7), 0 0 10px oklch(0.92 0.05 80 / 0.4)",
          cursor: "grab",
          touchAction: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onRemove}
        title="drag to rotate · double-click to remove"
      />
    </>
  );
}