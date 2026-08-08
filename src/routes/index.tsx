import { createFileRoute, Link } from "@tanstack/react-router";
// SYS-005 dev-only frame probe; renders nothing unless the page was opened with ?perf=1.
import { PerfProbeMount } from "@/components/dev/PerfProbeMount";
import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PhaseDock } from "@/components/dock/PhaseDock";
import {
  DEFAULT_FX_STATE,
  applyFxState,
  REVERB_PRESETS,
  CHORUS_PRESETS,
  GRAIN_PRESETS,
  TONE_PRESETS,
  type FxState,
  type ReverbType,
  type ChorusType,
  type GrainType,
  type ToneType,
} from "@/lib/fx/fxState";
import {
  BUILTIN_RUNTIME_PACKS,
  fetchCustomPacks,
  fetchPublishedPacks,
  triggerPackVoice,
  warmCustomPack,
  type RuntimePack,
} from "@/lib/sound/runtimePacks";
import { flashBus } from "@/lib/neural/flashBus";
import { spawnBurst, updateBursts, drawBursts } from "@/lib/visuals/burstField";
import { updateFlares, drawFlares } from "@/lib/visuals/lensFlare";
import { updateShockwaves, drawShockwaves } from "@/lib/visuals/shockwave";
import { updateInkBleeds, drawInkBleeds } from "@/lib/visuals/inkBleed";
import { stringNetworkScene, type StringNetState } from "@/lib/scenes/stringNetwork";
import { pendulumFanScene, type PendulumFanState } from "@/lib/scenes/pendulumFan";
import { spiralArpScene, type SpiralArpState } from "@/lib/scenes/spiralArp";
import { radialSweepScene, type RadialSweepState } from "@/lib/scenes/radialSweep";
import { mandalaMatrixScene, type MandalaMatrixState } from "@/lib/scenes/mandalaMatrix";
import { metatronLatticeScene, type MetatronLatticeState } from "@/lib/scenes/metatronLattice";
import { fractalNebulaScene, type FractalNebulaState } from "@/lib/scenes/fractalNebula";
import { radialResonatorScene, type RadialResonatorState } from "@/lib/scenes/radialResonator";
import { phaseAlignRingsScene, type PhaseAlignRingsState } from "@/lib/scenes/phaseAlignRings";
import { voidSheetsScene, type VoidSheetsState } from "@/lib/scenes/voidSheets";
import { customScene, type CustomSceneState } from "@/lib/scenes/customScene";
import { engineClock } from "@/lib/engine/clock";
import { createFireLayer } from "@/lib/visuals/fireShaderLayer";
import { engineScheduler } from "@/lib/engine/scheduler";
import {
  composerAdvance,
  resetComposerSources,
  loadComposerSettings,
  saveComposerSettings,
  type ComposerSettings,
} from "@/lib/music/composer";
import { setRegistry, setTempo as setProgressionTempo } from "@/lib/music/progression";
import { fetchPublishedScales } from "@/lib/music/scales.functions";
import {
  NEURAL_PRESETS,
  loadNeuralSettings,
  saveNeuralSettings,
  subscribeNeuralSettings,
  type NeuralSettings,
} from "@/lib/neural/palette";

/**
 * Resolve "how many notes will actually play" for the active scene from the
 * dock's universal density (multiply) knob. Mirrors each scene's internal
 * count formula so the dock can display an honest number.
 */
function resolveNotesCount(scene: SceneKind, density: number, noteCount: number = 8): number {
  switch (scene) {
    case "stringNet": {
      const n = Math.max(3, Math.min(6, Math.round(3 + (density - 2) * 0.3)));
      // C(n,2) strings × 2 particles each.
      return (n * (n - 1)) / 2 * 2;
    }
    case "pendulumFan":
      return Math.max(5, Math.min(14, Math.round(5 + (density - 2) * 0.9)));
    case "spiralArp":
      return 3;
    case "radialSweep":
      return Math.max(6, Math.min(16, Math.round(6 + (density - 2) * 1)));
    case "mandalaMatrix":
      return Math.max(6, Math.min(30, Math.round((6 + (density - 2) * 2.4) / 6) * 6));
    case "metatronLattice":
      return 25;
    case "fractalNebula":
      return 50;
    case "radialResonator":
      return 24;
    case "phaseAlignRings":
      return Math.max(4, Math.min(24, noteCount));
    case "voidSheets":
      return Math.max(4, Math.min(24, noteCount));
    case "custom":
      return Math.max(4, Math.min(48, noteCount));
    case "wheel":
    case "pendulum":
    case "bars":
    default:
      return density;
  }
}
import {
  buildShareUrl,
  copyShareUrl,
  decodeSession,
  encodeSession,
  type SessionState,
  knobsToSession,
  knobsFromSession,
  fxToSession,
  fxFromSession,
  neuralToSession,
  neuralFromSession,
  composerToSession,
  composerFromSession,
  wheelToSession,
  wheelFromSession,
  pendulumToSession,
  pendulumFromSession,
  barsToSession,
  barsFromSession,
} from "@/lib/session/sessionUrl";
import { setSceneOverlay } from "@/lib/engine/sceneOverlay";
import { AdminTrigger } from "@/components/admin/AdminTrigger";
import {
  subscribeActiveScene,
  getActiveScene,
} from "@/lib/scenes/activeScene";
import {
  loadCycleOverride,
  saveCycleOverride,
  subscribeCycleOverride,
  type CycleOverride,
} from "@/lib/engine/cycleOverride";

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
export type SceneKind =
  | "wheel"
  | "pendulum"
  | "bars"
  | "stringNet"
  | "pendulumFan"
  | "spiralArp"
  | "radialSweep"
  | "mandalaMatrix"
  | "metatronLattice"
  | "fractalNebula"
  | "radialResonator"
  | "phaseAlignRings"
  | "voidSheets"
  | "custom";

type Knobs = {
  mainVol: number; // 0..1
  pitch: number; // -12..12 semitones
  revMix: number; // 0..1
  revSize: number; // 0.05..1.2 (delay seconds)
  speed: number; // 0.25..2
  multiply: number; // 2..12 (integer, vertex count)
  fx1: number; // 200..8000 cutoff
  fx2: number; // 0..40 detune cents
};

type VoiceSel = { melo: VoiceKind; bass: VoiceKind; atmo: VoiceKind };

type TriggerEvent = {
  vertex: number;
  time: number; // audioCtx time
  freq: number;
  voice: VoiceKind;
  laneColor: string;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  hue: string;
};

type EngineState = {
  // canvas
  w: number;
  h: number;
  dpr: number;
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
  // pendulum
  pendulum: PendulumState;
  // bars
  bars: BarsState;
  // engine scenes (lazy-initialized in render loop)
  stringNet: StringNetState | null;
  pendulumFan: PendulumFanState | null;
  spiralArp: SpiralArpState | null;
  radialSweep: RadialSweepState | null;
  mandalaMatrix: MandalaMatrixState | null;
  metatronLattice: MetatronLatticeState | null;
  fractalNebula: FractalNebulaState | null;
  radialResonator: RadialResonatorState | null;
  phaseAlignRings: PhaseAlignRingsState | null;
  voidSheets: VoidSheetsState | null;
  custom: CustomSceneState | null;
};

type AudioGraph = {
  ctx: AudioContext;
  master: GainNode;
  busTrim: GainNode;
  highpass: BiquadFilterNode;
  limiter: DynamicsCompressorNode;
  preFx: GainNode; // input bus
  filter: BiquadFilterNode;
  shelf: BiquadFilterNode;
  chorusMix: GainNode;
  chorusRate: AudioParam; // proxy: control both chorus LFOs
  delayL: DelayNode;
  delayR: DelayNode;
  delayFeedback: GainNode;
  wet: GainNode;
  dryToMaster: GainNode;
  grainDelay: DelayNode;
  grainFeedback: GainNode;
  grainMix: GainNode;
  convolver: ConvolverNode;
  reverbWet: GainNode;
  reverbSend: GainNode;
  irSeconds: number;
  _chorusRateB: AudioParam;
  _chorusDepthA: GainNode;
  _chorusDepthB: GainNode;
  _reverbDamp: BiquadFilterNode;
  _reverbPredelay: DelayNode;
};

/* ============================================================
 * Constants & helpers
 * ============================================================ */

const VOICES: VoiceKind[] = ["chime", "pluck", "bell", "pad", "bass", "none"];
const SCENES: SceneKind[] = [
  "wheel",
  "pendulum",
  "bars",
  "stringNet",
  "pendulumFan",
  "spiralArp",
  "radialSweep",
  "mandalaMatrix",
  "metatronLattice",
  "fractalNebula",
  "radialResonator",
  "phaseAlignRings",
  "voidSheets",
  "custom",
];
type VoiceSlot = "melo" | "bass" | "atmo";
const VOICE_SLOTS: VoiceSlot[] = ["melo", "bass", "atmo"];
void VOICES;

export type WheelNote = {
  id: string;
  angle: number;
  pitchIndex: number;
  prevWorld: number;
  flash: number;
};

export type WheelRing = {
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

export type WheelLine = {
  id: string;
  angle: number;
  flash: number;
  sparks: { x: number; y: number; t: number }[];
};

export type WheelState = {
  rings: WheelRing[];
  lines: WheelLine[];
  lastFire: Map<string, number>;
};

/* ---- Pendulum scene ---- */
export type PendulumBob = {
  id: string;
  ratioIndex: number; // 0..N → picks ratio from PEND_RATIOS
  slotIndex: number; // 0..5 → pack slot
  pitchIndex: number; // semitone offset
  phase: number; // 0..1 normalized SHM phase
  prevSign: -1 | 1; // last side
  flash: number; // 0..1 visual
};
export type PendulumState = {
  bobs: PendulumBob[];
};

/* ---- Bars scene ---- */
export type BarLane = {
  id: string;
  ratioIndex: number; // 0..N → picks ratio from BAR_RATIOS
  slotIndex: number;
  pitchIndex: number;
  phase: number; // 0..1 playhead vertical position
  flash: number;
  lastTriggerY: number; // for zigzag connector
};
export type BarsState = {
  lanes: BarLane[];
};

let _uid = 0;
const uid = (p = "id") => `${p}_${++_uid}`;

function voiceSlotColor(slot: VoiceSlot, withAlpha = false): string {
  const base =
    slot === "melo"
      ? "oklch(0.82 0.18 195"
      : slot === "bass"
        ? "oklch(0.72 0.22 310"
        : "oklch(0.86 0.16 85";
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
    radiusFactor: number,
    beats: number,
    subdivision: number,
    direction: 1 | -1,
    voiceSlot: VoiceSlot,
    noteAngles: number[],
    pitchBase: number,
  ): WheelRing => ({
    id: uid("ring"),
    radiusFactor,
    beats,
    subdivision,
    direction,
    phase: 0,
    voiceSlot,
    flash: 0,
    notes: noteAngles.map((a, i) => ({
      id: uid("n"),
      angle: a,
      pitchIndex: pitchBase + i,
      prevWorld: a,
      flash: 0,
    })),
  });
  const tau = Math.PI * 2;
  return {
    rings: [
      mkRing(0.78, 4, 4, 1, "melo", [0, tau * 0.25, tau * 0.5, tau * 0.75], 7),
      mkRing(0.55, 3, 4, -1, "bass", [0, tau / 3, (tau * 2) / 3], 3),
      mkRing(0.32, 5, 8, 1, "atmo", [0, tau / 5, (tau * 2) / 5, (tau * 3) / 5, (tau * 4) / 5], 10),
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
const MAX_ACTIVE_VOICES = 18;
let activeVoiceCount = 0;
void MAX_ACTIVE_VOICES;
void activeVoiceCount;

/* ---- Pendulum / Bars constants & seeds ---- */

// Ratios that produce a slow phasing fan-out (Galileo pendulum style).
// Index N → period multiplier; longer index = slower swing.
const PEND_RATIOS = [1.0, 1.06, 1.13, 1.21, 1.3, 1.4, 1.51, 1.63, 1.76, 1.9, 2.05, 2.21];
const BAR_RATIOS = [
  { num: 3, den: 4 },
  { num: 4, den: 5 },
  { num: 5, den: 6 },
  { num: 6, den: 7 },
  { num: 7, den: 8 },
  { num: 8, den: 9 },
  { num: 9, den: 10 },
  { num: 5, den: 8 },
  { num: 4, den: 7 },
  { num: 3, den: 8 },
  { num: 7, den: 12 },
  { num: 11, den: 13 },
];

function pendBaseSec(bpm: number) {
  // Slowest pendulum's full half-cycle ≈ this many seconds at the given bpm.
  // At 90 bpm → ~3.6s for one zero-cross-to-zero-cross.
  return (60 / Math.max(20, bpm)) * 5.4;
}

function pendPeriodSec(b: PendulumBob, bpm: number) {
  const r = PEND_RATIOS[b.ratioIndex % PEND_RATIOS.length];
  return pendBaseSec(bpm) * r;
}

function barBaseSec(bpm: number) {
  return (60 / Math.max(20, bpm)) * 4.0;
}

function barPeriodSec(l: BarLane, bpm: number) {
  const r = BAR_RATIOS[l.ratioIndex % BAR_RATIOS.length];
  return barBaseSec(bpm) * (r.den / r.num);
}

function pitchToFreq(semitones: number) {
  // A3 (220) as root; pitchIndex 0 → A3.
  return 220 * Math.pow(2, semitones / 12);
}

function makeSeedPendulum(): PendulumState {
  return {
    bobs: [
      { id: uid("p"), ratioIndex: 0, slotIndex: 0, pitchIndex: 7, phase: 0, prevSign: 1, flash: 0 },
      {
        id: uid("p"),
        ratioIndex: 1,
        slotIndex: 1,
        pitchIndex: 5,
        phase: 0.1,
        prevSign: 1,
        flash: 0,
      },
      {
        id: uid("p"),
        ratioIndex: 2,
        slotIndex: 2,
        pitchIndex: 3,
        phase: 0.2,
        prevSign: 1,
        flash: 0,
      },
      {
        id: uid("p"),
        ratioIndex: 3,
        slotIndex: 3,
        pitchIndex: 0,
        phase: 0.3,
        prevSign: 1,
        flash: 0,
      },
      {
        id: uid("p"),
        ratioIndex: 4,
        slotIndex: 4,
        pitchIndex: -2,
        phase: 0.4,
        prevSign: 1,
        flash: 0,
      },
      {
        id: uid("p"),
        ratioIndex: 5,
        slotIndex: 5,
        pitchIndex: -5,
        phase: 0.5,
        prevSign: 1,
        flash: 0,
      },
    ],
  };
}

function makeSeedBars(): BarsState {
  return {
    lanes: [
      {
        id: uid("b"),
        ratioIndex: 0,
        slotIndex: 0,
        pitchIndex: 12,
        phase: 0,
        flash: 0,
        lastTriggerY: 1,
      },
      {
        id: uid("b"),
        ratioIndex: 1,
        slotIndex: 1,
        pitchIndex: 7,
        phase: 0.07,
        flash: 0,
        lastTriggerY: 1,
      },
      {
        id: uid("b"),
        ratioIndex: 2,
        slotIndex: 2,
        pitchIndex: 5,
        phase: 0.14,
        flash: 0,
        lastTriggerY: 1,
      },
      {
        id: uid("b"),
        ratioIndex: 3,
        slotIndex: 3,
        pitchIndex: 3,
        phase: 0.21,
        flash: 0,
        lastTriggerY: 1,
      },
      {
        id: uid("b"),
        ratioIndex: 4,
        slotIndex: 4,
        pitchIndex: 0,
        phase: 0.28,
        flash: 0,
        lastTriggerY: 1,
      },
      {
        id: uid("b"),
        ratioIndex: 5,
        slotIndex: 5,
        pitchIndex: -5,
        phase: 0.35,
        flash: 0,
        lastTriggerY: 1,
      },
    ],
  };
}

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
  if (activeVoiceCount >= MAX_ACTIVE_VOICES) return;
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

  let attack = 0.01,
    hold = 0,
    release = 2.5,
    peak = 0.16;
  const oscs: OscillatorNode[] = [];

  if (voice === "chime") {
    oscs.push(mk("sine", freq, -detuneCents, 0.25));
    oscs.push(mk("sine", freq * 2.01, detuneCents, 0.08));
    oscs.push(mk("sine", freq * 3.0, 0, 0.035));
    attack = 0.005;
    release = 3.2;
    peak = 0.14;
  } else if (voice === "pluck") {
    oscs.push(mk("triangle", freq, -detuneCents, 0.35));
    oscs.push(mk("triangle", freq * 1.005, detuneCents, 0.2));
    attack = 0.003;
    release = 1.4;
    peak = 0.16;
  } else if (voice === "bell") {
    oscs.push(mk("sine", freq, 0, 0.28));
    oscs.push(mk("sine", freq * 3.5, 0, 0.12));
    oscs.push(mk("sine", freq * 5.2, 0, 0.04));
    attack = 0.008;
    release = 4.5;
    peak = 0.12;
  } else if (voice === "pad") {
    oscs.push(mk("triangle", freq * 0.5, -detuneCents, 0.28));
    oscs.push(mk("sine", freq * 0.5 * 1.005, detuneCents, 0.2));
    oscs.push(mk("sine", freq, 0, 0.12));
    attack = 0.45;
    release = 3.5;
    peak = 0.1;
  } else if (voice === "bass") {
    oscs.push(mk("sine", freq * 0.5, -detuneCents, 0.38));
    oscs.push(mk("triangle", freq * 0.5, detuneCents, 0.12));
    attack = 0.01;
    release = 2.2;
    peak = 0.13;
  }

  const t = startAt;
  const duration = attack + hold + release + 0.1;
  activeVoiceCount += 1;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);

  oscs.forEach((o) => {
    o.start(t);
    o.stop(t + duration);
  });
  window.setTimeout(
    () => {
      activeVoiceCount = Math.max(0, activeVoiceCount - 1);
    },
    Math.max(0, (t + duration - ctx.currentTime) * 1000),
  );
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
  const [bpm, setBpm] = useState(90);
  const [fxState, setFxState] = useState<FxState>(DEFAULT_FX_STATE);
  const [selectedPack, setSelectedPack] = useState<string>("moss");
  const [customPacks, setCustomPacks] = useState<RuntimePack[]>([]);
  const [neural, setNeural] = useState<NeuralSettings>(() => loadNeuralSettings());
  const [composer, setComposer] = useState<ComposerSettings>(() => loadComposerSettings());
  const auth = useAuth();
  // topology bump: rings/lines/notes counts so DOM overlays re-render
  const [topo, setTopo] = useState(0);
  const bumpTopo = useCallback(() => setTopo((x) => x + 1), []);
  // cached canvas client rect for positioning DOM overlays
  const [canvasRect, setCanvasRect] = useState({ w: 0, h: 0 });
  const [voices] = useState<VoiceSel>({
    melo: "chime",
    bass: "bass",
    atmo: "pad",
  });
  const [knobs, setKnobs] = useState<Knobs>({
    mainVol: 0.55,
    pitch: 0,
    revMix: 0.45,
    revSize: 0.55,
    speed: 0.25,
    multiply: 5,
    fx1: 2400,
    fx2: 8,
  });

  // Refs mirror state so the engine doesn't re-subscribe
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const voicesRef = useRef(voices);
  voicesRef.current = voices;
  const knobsRef = useRef(knobs);
  knobsRef.current = knobs;
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  // ---- Chord Progression Engine wiring ----
  // Push tempo into the progression module whenever it changes so bar math
  // matches the audio scheduler.
  useEffect(() => { setProgressionTempo(bpm); }, [bpm]);

  // Load published scales into the in-memory registry.
  const fetchScalesFn = useServerFn(fetchPublishedScales);
  const scalesQ = useQuery({
    queryKey: ["published-scales"],
    queryFn: () => fetchScalesFn(),
    staleTime: 30_000,
  });
  useEffect(() => {
    if (!scalesQ.data) return;
    setRegistry(scalesQ.data);
    // If the stored composer scale id no longer exists, fall back to first and
    // keep the audio engine's composer singleton in sync with React state.
    setComposer((c) => {
      const exists = scalesQ.data!.some((s) => s.id === c.scale);
      if (exists || scalesQ.data!.length === 0) return c;
      const next = { ...c, scale: scalesQ.data![0].id };
      saveComposerSettings(next);
      return next;
    });
  }, [scalesQ.data]);
  // Resolve currently-selected pack into a RuntimePack (built-in or custom).
  const allPacks: RuntimePack[] = [...BUILTIN_RUNTIME_PACKS, ...customPacks];
  const activePack: RuntimePack =
    allPacks.find((p) => p.id === selectedPack) ?? BUILTIN_RUNTIME_PACKS[0];
  const packRef = useRef<RuntimePack>(activePack);
  packRef.current = activePack;

  const audioRef = useRef<AudioGraph | null>(null);
  const engineRef = useRef<EngineState>({
    w: 0,
    h: 0,
    dpr: 1,
    basePeriod: 8,
    nextFire: [],
    lastFire: [],
    pendingVisuals: [],
    particles: [],
    dust: [],
    startedAt: 0,
    paused: true,
    wheel: makeSeedWheel(),
    pendulum: makeSeedPendulum(),
    bars: makeSeedBars(),
    stringNet: null,
    pendulumFan: null,
    spiralArp: null,
    radialSweep: null,
    mandalaMatrix: null,
    metatronLattice: null,
    fractalNebula: null,
    radialResonator: null,
    phaseAlignRings: null,
    voidSheets: null,
    custom: null,
  });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const grainPatternRef = useRef<CanvasPattern | null>(null);
  const hoverRingIdRef = useRef<string | null>(null);
  const hoverOpacityRef = useRef<number>(0);
  const lastHoverRef = useRef<string | null>(null);
  const [hoverRing, setHoverRing] = useState<string | null>(null);

  /* ---- Phase-Alignment cycle (baseLaps / macroCycleSeconds / noteCount) ---
   * Resolved every frame from: dock override ?? active scene default ??
   * built-in default (10, 30, 8). Kept in a ref for the render loop and
   * scheduler globals; the dock reads live values via subscribeCycleOverride.
   * --------------------------------------------------------------------- */
  const cycleOverrideRef = useRef<CycleOverride>(
    typeof window === "undefined"
      ? { baseLaps: null, macroCycleSeconds: null, noteCount: null }
      : loadCycleOverride(),
  );
  const [cycleTick, setCycleTick] = useState(0);
  useEffect(() => {
    const unsubOv = subscribeCycleOverride((o) => {
      cycleOverrideRef.current = o;
      setCycleTick((t) => t + 1);
    });
    const unsubScene = subscribeActiveScene(() => setCycleTick((t) => t + 1));
    return () => {
      unsubOv();
      unsubScene();
    };
  }, []);
  const resolveGlobalCycle = useCallback(() => {
    const ov = cycleOverrideRef.current;
    const s = getActiveScene();
    return {
      baseLaps: ov.baseLaps ?? s?.base_laps ?? 10,
      macroCycleSeconds: ov.macroCycleSeconds ?? s?.macro_cycle_seconds ?? 30,
      noteCount: ov.noteCount ?? s?.note_count ?? 8,
    };
  }, []);

  /* ---- Phase-Zero scheduler binding ---------------------------------
   * The scheduler ticks on its own (25 ms setInterval) and pulls events
   * via `activeScene.eventsIn(t0, t1)`. We re-bind whenever the active
   * scene changes; legacy scenes (no `eventsIn`) leave the scheduler
   * dormant so the imperative `dispatchTriggers` path keeps owning audio.
   * --------------------------------------------------------------- */
  useEffect(() => {
    engineScheduler.start();
    return () => engineScheduler.stop();
  }, []);
  useEffect(() => {
    const a = audioRef.current;
    const e = engineRef.current;
    if (!a) {
      engineScheduler.setActive(null);
      return;
    }
    const bind = <S,>(impl: import("@/lib/engine/sceneTypes").Scene<S>, getter: () => S | null) => {
      if (!impl.eventsIn) {
        engineScheduler.setActive(null);
        return;
      }
      engineScheduler.setActive({
        scene: impl as unknown as import("@/lib/engine/sceneTypes").Scene<unknown>,
        state: () => getter(),
        globals: () => {
          const k = knobsRef.current;
          const c = canvasRef.current;
          const cyc = resolveGlobalCycle();
          return {
            W: c?.clientWidth ?? 0,
            H: c?.clientHeight ?? 0,
            bpm: bpmRef.current,
            speed: k.speed,
            density: k.multiply,
            pitchSemis: k.pitch,
            audioNow: a.ctx.currentTime,
            globalTime: engineClock.t(),
            baseLaps: cyc.baseLaps,
            macroCycleSeconds: cyc.macroCycleSeconds,
            noteCount: cyc.noteCount,
          };
        },
        audioCtx: a.ctx,
        audioDest: a.preFx,
        pack: () => packRef.current,
      });
    };
    if (scene === "stringNet") bind(stringNetworkScene, () => e.stringNet);
    else if (scene === "pendulumFan") bind(pendulumFanScene, () => e.pendulumFan);
    else if (scene === "spiralArp") bind(spiralArpScene, () => e.spiralArp);
    else if (scene === "radialSweep") bind(radialSweepScene, () => e.radialSweep);
    else if (scene === "mandalaMatrix") bind(mandalaMatrixScene, () => e.mandalaMatrix);
    else if (scene === "metatronLattice") bind(metatronLatticeScene, () => e.metatronLattice);
    else if (scene === "fractalNebula") bind(fractalNebulaScene, () => e.fractalNebula);
    else if (scene === "radialResonator") bind(radialResonatorScene, () => e.radialResonator);
    else if (scene === "phaseAlignRings") bind(phaseAlignRingsScene, () => e.phaseAlignRings);
    else if (scene === "voidSheets") bind(voidSheetsScene, () => e.voidSheets);
    else if (scene === "custom") bind(customScene, () => e.custom);
    else engineScheduler.setActive(null);
  }, [scene, playing, topo]);

  /* ---- Session URL: share + restore ---- */
  const buildSessionState = useCallback(
    (): SessionState => ({
      v: 1,
      s: scene,
      bpm,
      knobs: knobsToSession(knobs),
      fx: fxToSession(fxState),
      pack: selectedPack,
      neural: neuralToSession(neural),
      composer: composerToSession(composer),
      wheel: wheelToSession(engineRef.current.wheel),
      pendulum: pendulumToSession(engineRef.current.pendulum),
      bars: barsToSession(engineRef.current.bars),
      engine: {
        // stringNet is now Phase-Zero (pure function of globalTime);
        // its position is reconstructed from `engineClock.t()` and
        // doesn't need per-share state. Field omitted on purpose.
        // pendulumFan: Phase-Zero — derived from engineClock.
        // spiralArp: Phase-Zero — derived from engineClock.
        // radialSweep: Phase-Zero — derived from engineClock.
      },
    }),
    [scene, bpm, knobs, fxState, selectedPack, neural, composer, topo],
  );

  const restoreSessionState = useCallback((state: SessionState) => {
    setScene(state.s);
    setBpm(state.bpm);
    setKnobs(knobsFromSession(state.knobs));
    setFxState(fxFromSession(state.fx));
    setSelectedPack(state.pack);
    setNeural(neuralFromSession(state.neural));
    saveNeuralSettings(neuralFromSession(state.neural));
    setComposer(composerFromSession(state.composer));
    saveComposerSettings(composerFromSession(state.composer));
    engineRef.current.wheel = wheelFromSession(state.wheel);
    engineRef.current.pendulum = pendulumFromSession(state.pendulum);
    engineRef.current.bars = barsFromSession(state.bars);
    // Engine scenes are deterministic from density+bpm: clear them so
    // runScene re-inits on the next frame, then patch in saved phase
    // counters once the new state object exists.
    engineRef.current.stringNet = null;
    engineRef.current.pendulumFan = null;
    engineRef.current.spiralArp = null;
    engineRef.current.radialSweep = null;
    engineRef.current.mandalaMatrix = null;
    engineRef.current.metatronLattice = null;
    engineRef.current.fractalNebula = null;
    engineRef.current.radialResonator = null;
    engineRef.current.phaseAlignRings = null;
    engineRef.current.voidSheets = null;
    engineRef.current.custom = null;
    const eng = state.engine;
    if (eng) {
      // Defer until after first runScene init populates the state.
      requestAnimationFrame(() => {
        const ref = engineRef.current;
        // stringNet: legacy `clock` field ignored (Phase-Zero scenes
        // derive position from engineClock).
        // pendulumFan: legacy `clock` field ignored (Phase-Zero).
        // spiralArp: legacy `clock` field ignored (Phase-Zero).
        // radialSweep: legacy fields ignored (Phase-Zero).
        void ref;
      });
    }
    bumpTopo();
  }, []);

  // Read hash on mount and restore session if present.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash.startsWith("#s=")) return;
    const encoded = hash.slice(3);
    const state = decodeSession(encoded);
    if (state) {
      restoreSessionState(state);
    }
  }, [restoreSessionState]);

  // One-shot audition handshake from My Studio → Scenes.
  // The Studio writes { scene, pack } into sessionStorage before navigating
  // here; we apply it once and clear so a normal reload won't re-trigger.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem("phaseZeroAudition");
    if (!raw) return;
    window.sessionStorage.removeItem("phaseZeroAudition");
    try {
      const a = JSON.parse(raw) as {
        scene?: SceneKind;
        pack?: string;
        densityOverride?: number | null;
        speedMultiplier?: number;
        pitchOffset?: number;
        slotMap?: number[];
        ink?: number;
      };
      if (a.scene) setScene(a.scene);
      if (a.pack) setSelectedPack(a.pack);
      setKnobs((k) => {
        const next = { ...k };
        if (typeof a.densityOverride === "number" && a.densityOverride >= 2) {
          next.multiply = a.densityOverride;
        }
        if (typeof a.speedMultiplier === "number") {
          // Global slowdown: cap any scripted speed override at the new max (0.25×).
          next.speed = Math.min(0.25, Math.max(0.0625, a.speedMultiplier));
        }
        if (typeof a.pitchOffset === "number") next.pitch = a.pitchOffset;
        return next;
      });
      // Apply the per-event overlay (slot remap + ink). Pitch already
      // goes through knobs.pitch above, so leave overlay.pitchSemis at 0.
      if (a.slotMap || typeof a.ink === "number") {
        const slotMap =
          a.slotMap && a.slotMap.length === 6
            ? (a.slotMap as [number, number, number, number, number, number])
            : undefined;
        setSceneOverlay({
          ...(slotMap ? { slotMap } : {}),
          ink: typeof a.ink === "number" ? a.ink : 1,
          pitchSemis: 0,
        });
      } else {
        setSceneOverlay(null);
      }
    } catch {
      /* ignore malformed audition payload */
    }
  }, []);

  // Write hash when state changes (debounced).
  const hashDebounceRef = useRef<number | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hashDebounceRef.current) window.clearTimeout(hashDebounceRef.current);
    hashDebounceRef.current = window.setTimeout(() => {
      const state = buildSessionState();
      const encoded = encodeSession(state);
      const url = new URL(window.location.href);
      url.hash = `#s=${encoded}`;
      window.history.replaceState(null, "", url.toString());
    }, 600);
    return () => {
      if (hashDebounceRef.current) window.clearTimeout(hashDebounceRef.current);
    };
  }, [buildSessionState]);

  const handleShare = useCallback(async () => {
    const state = buildSessionState();
    const ok = await copyShareUrl(state);
    setShareToast(ok ? "Session link copied to clipboard" : "Could not copy link");
    window.setTimeout(() => setShareToast(null), 2200);
  }, [buildSessionState]);

  /* ---- Audio graph init ---- */
  const ensureAudio = useCallback((): AudioGraph => {
    if (audioRef.current) return audioRef.current;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    // 48 kHz + interactive latency for a noticeably cleaner top end.
    let ctx: AudioContext;
    try {
      ctx = new Ctx({ sampleRate: 48000, latencyHint: "interactive" });
    } catch {
      ctx = new Ctx();
    }

    const master = ctx.createGain();
    master.gain.value = knobsRef.current.mainVol * 0.7;

    const preFx = ctx.createGain();
    preFx.gain.value = 1;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = knobsRef.current.fx1;
    filter.Q.value = 0.6;

    // tone: high-shelf right after filter
    const shelf = ctx.createBiquadFilter();
    shelf.type = "highshelf";
    shelf.frequency.value = 4000;
    shelf.gain.value = 0;

    /* ---- True stereo chorus: dual delay lines, quadrature LFOs, hard-panned ---- */
    const chorusSplit = ctx.createChannelSplitter(2);
    const chorusMerge = ctx.createChannelMerger(2);
    const chorusDelayL = ctx.createDelay(0.05);
    const chorusDelayR = ctx.createDelay(0.05);
    chorusDelayL.delayTime.value = 0.011;
    chorusDelayR.delayTime.value = 0.017;
    const chorusLFO_A = ctx.createOscillator();
    const chorusLFO_B = ctx.createOscillator();
    chorusLFO_A.frequency.value = 0.35;
    chorusLFO_B.frequency.value = 0.35;
    // Phase B by 90° via cosine wavetable
    const cosTable = ctx.createPeriodicWave(new Float32Array([0, 0]), new Float32Array([0, 1]));
    chorusLFO_B.setPeriodicWave(cosTable);
    const chorusDepthA = ctx.createGain();
    chorusDepthA.gain.value = 0.004;
    const chorusDepthB = ctx.createGain();
    chorusDepthB.gain.value = 0.004;
    chorusLFO_A.connect(chorusDepthA);
    chorusDepthA.connect(chorusDelayL.delayTime);
    chorusLFO_B.connect(chorusDepthB);
    chorusDepthB.connect(chorusDelayR.delayTime);
    chorusLFO_A.start();
    chorusLFO_B.start();
    const chorusMix = ctx.createGain();
    chorusMix.gain.value = 0.08;

    /* ---- Ping-pong delay (true stereo) ---- */
    const delayL = ctx.createDelay(2.5);
    const delayR = ctx.createDelay(2.5);
    delayL.delayTime.value = knobsRef.current.revSize;
    delayR.delayTime.value = knobsRef.current.revSize * 1.5;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.36;
    const wet = ctx.createGain();
    wet.gain.value = knobsRef.current.revMix * 0.35;
    const dryToMaster = ctx.createGain();
    dryToMaster.gain.value = 0.78;

    /* ---- Convolution reverb (procedural stereo IR) ---- */
    const irSeconds = 3.2;
    const convolver = ctx.createConvolver();
    convolver.normalize = true;
    {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * irSeconds);
      const ir = ctx.createBuffer(2, len, sr);
      const dL = ir.getChannelData(0);
      const dR = ir.getChannelData(1);
      // Exponentially decaying noise — classic ambient hall IR
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.pow(1 - i / len, 2.6) * Math.exp(-t * 1.4);
        // Slight stereo decorrelation
        dL[i] = (Math.random() * 2 - 1) * env;
        dR[i] = (Math.random() * 2 - 1) * env;
      }
      convolver.buffer = ir;
    }
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = 1;
    // Pre-delay + damping LP before convolver for a smoother tail
    const reverbPredelay = ctx.createDelay(0.2);
    reverbPredelay.delayTime.value = 0.02;
    const reverbDamp = ctx.createBiquadFilter();
    reverbDamp.type = "lowpass";
    reverbDamp.frequency.value = 5200;
    reverbDamp.Q.value = 0.5;
    const reverbWet = ctx.createGain();
    reverbWet.gain.value = knobsRef.current.revMix * 0.45;

    // grain: secondary delay tap
    const grainDelay = ctx.createDelay(0.4);
    grainDelay.delayTime.value = 0.06;
    const grainFeedback = ctx.createGain();
    grainFeedback.gain.value = 0.0;
    const grainMix = ctx.createGain();
    grainMix.gain.value = 0.0;

    // bus trim + master limiter give headroom for parallel sends
    const busTrim = ctx.createGain();
    busTrim.gain.value = 0.26;
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 42;
    highpass.Q.value = 0.7;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.knee.value = 4;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;

    /* ---- Routing ---- */
    preFx.connect(filter);
    filter.connect(shelf);

    // Dry
    shelf.connect(dryToMaster);

    // Stereo chorus: split → modulated delays → merge → mix
    shelf.connect(chorusSplit);
    chorusSplit.connect(chorusDelayL, 0);
    chorusSplit.connect(chorusDelayR, 1);
    chorusDelayL.connect(chorusMerge, 0, 0);
    chorusDelayR.connect(chorusMerge, 0, 1);
    chorusMerge.connect(chorusMix);
    chorusMix.connect(dryToMaster);

    dryToMaster.connect(busTrim);

    // Ping-pong delay: cross-fed L/R
    shelf.connect(delayL);
    delayL.connect(delayFeedback);
    delayFeedback.connect(delayR);
    delayR.connect(delayFeedback); // soft cross-feedback
    const ppMerge = ctx.createChannelMerger(2);
    delayL.connect(ppMerge, 0, 0);
    delayR.connect(ppMerge, 0, 1);
    ppMerge.connect(wet);
    wet.connect(busTrim);

    // Convolution reverb send
    shelf.connect(reverbSend);
    reverbSend.connect(reverbPredelay);
    reverbPredelay.connect(reverbDamp);
    reverbDamp.connect(convolver);
    convolver.connect(reverbWet);
    reverbWet.connect(busTrim);

    shelf.connect(grainDelay);
    grainDelay.connect(grainFeedback);
    grainFeedback.connect(grainDelay);
    grainDelay.connect(grainMix);
    grainMix.connect(busTrim);

    busTrim.connect(master);
    master.connect(highpass);
    highpass.connect(limiter);
    limiter.connect(ctx.destination);

    audioRef.current = {
      ctx,
      master,
      busTrim,
      highpass,
      limiter,
      preFx,
      filter,
      shelf,
      chorusMix,
      chorusRate: chorusLFO_A.frequency,
      delayL,
      delayR,
      delayFeedback,
      wet,
      dryToMaster,
      grainDelay,
      grainFeedback,
      grainMix,
      convolver,
      reverbWet,
      reverbSend,
      irSeconds,
      // Internal handles for fxState (kept on the object for chorus depth + LFO B rate)
      _chorusRateB: chorusLFO_B.frequency,
      _chorusDepthA: chorusDepthA,
      _chorusDepthB: chorusDepthB,
      _reverbDamp: reverbDamp,
      _reverbPredelay: reverbPredelay,
    };
    return audioRef.current!;
  }, []);

  /* ---- Sync knobs -> audio params ---- */
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const t = a.ctx.currentTime;
    a.master.gain.setTargetAtTime(knobs.mainVol * 0.7, t, 0.04);
    a.filter.frequency.setTargetAtTime(knobs.fx1, t, 0.04);
    a.delayL.delayTime.setTargetAtTime(knobs.revSize, t, 0.05);
    a.delayR.delayTime.setTargetAtTime(knobs.revSize * 1.5, t, 0.05);
    a.wet.gain.setTargetAtTime(knobs.revMix * 0.35, t, 0.05);
    a.reverbWet.gain.setTargetAtTime(knobs.revMix * 0.45, t, 0.05);
    a.chorusMix.gain.setTargetAtTime(0.04 + (knobs.fx2 / 40) * 0.18, t, 0.05);
    const depth = 0.0015 + (knobs.fx2 / 40) * 0.006;
    (a as unknown as { _chorusDepthA: GainNode })._chorusDepthA.gain.setTargetAtTime(
      depth,
      t,
      0.05,
    );
    (a as unknown as { _chorusDepthB: GainNode })._chorusDepthB.gain.setTargetAtTime(
      depth,
      t,
      0.05,
    );
  }, [knobs]);

  /* ---- Sync FX state -> audio params (wins over knobs in wheel mode) ---- */
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    applyFxState(a, fxState);
  }, [fxState]);

  /* ---- Custom pack fetching + warming ---- */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [mine, published] = await Promise.all([
          fetchCustomPacks().catch(() => []),
          fetchPublishedPacks().catch(() => []),
        ]);
        // Merge, dedupe by id, prefer published entry
        const byId = new Map<string, (typeof published)[number]>();
        for (const p of mine) byId.set(p.id, p);
        for (const p of published) byId.set(p.id, p);
        if (!cancelled) setCustomPacks(Array.from(byId.values()));
      } catch (err) {
        console.warn("[packs] custom fetch failed", err);
      }
    };
    load();
    // Re-fetch when packs drawer opens so newly-published packs appear without reload.
    return () => {
      cancelled = true;
    };
  }, []);

  // Pre-decode samples for the active custom pack as soon as it's selected.
  useEffect(() => {
    if (activePack.kind !== "custom") return;
    const a = audioRef.current;
    if (!a) return;
    warmCustomPack(a.ctx, activePack).catch(() => {});
  }, [activePack]);

  /* ---- RAF render loop ---- */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const onResize = () => {
      const c = canvasRef.current;
      if (!c) return;
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

    // WebGL fire-spark overlay lives as a sibling of the main canvas,
    // covers it 1:1, and blends additively via CSS mix-blend-mode.
    const parent = canvasRef.current?.parentElement ?? null;
    const fireLayer = parent ? createFireLayer(parent) : null;

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
      fireLayer?.render(engineClock.t());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      fireLayer?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Renderer ---- */
  const render = (dt: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx2d = c.getContext("2d");
    if (!ctx2d) return;
    const e = engineRef.current;
    const a = audioRef.current;

    const W = e.w,
      H = e.h;
    ctx2d.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);

    // Always: art surface (transparent + bloom + grain), UNLESS the
    // active scene owns its own pre-clear (e.g. "custom" Scene Builder
    // trail decay). In that case skip the default clear/bloom/grain so
    // long-exposure trails survive frame-to-frame.
    if (sceneRef.current === "custom") {
      customScene.preClear?.(ctx2d, {
        W,
        H,
        bpm: 0,
        speed: 0,
        density: 0,
        pitchSemis: 0,
        audioNow: 0,
        globalTime: 0,
        baseLaps: 0,
        macroCycleSeconds: 0,
        noteCount: 0,
      });
    } else {
      paintArtBackground(ctx2d, W, H, grainPatternRef);
    }

    const playing = !!(a && playingRef.current);
    const scene = sceneRef.current;
    ctx2d.globalCompositeOperation = "lighter";
    if (scene === "wheel") {
      if (playing) {
        updateWheel(
          e.wheel,
          dt,
          a!,
          bpmRef.current,
          voicesRef.current,
          knobsRef.current,
          packRef.current,
          W,
          H,
        );
      } else {
        decayWheelFlashes(e.wheel, dt);
      }
      drawWheelScene(ctx2d, W, H, e.wheel, voicesRef.current, dt, hoverRingIdRef.current);
    } else if (scene === "pendulum") {
      if (playing) {
        updatePendulum(e.pendulum, dt, a!, bpmRef.current, knobsRef.current, packRef.current, W, H);
      } else {
        decayPendulumFlashes(e.pendulum, dt);
      }
      drawPendulumScene(ctx2d, W, H, e.pendulum, hoverRingIdRef.current);
    } else if (scene === "bars") {
      if (playing) {
        updateBars(e.bars, dt, a!, bpmRef.current, knobsRef.current, packRef.current, W, H);
      } else {
        decayBarsFlashes(e.bars, dt);
      }
      drawBarsScene(ctx2d, W, H, e.bars, hoverRingIdRef.current);
    } else {
      // Engine scenes (Scene interface). New scenes share one dispatch path.
      const k = knobsRef.current;
      const gT = engineClock.t();
      const cyc = resolveGlobalCycle();
      const globals = {
        W,
        H,
        bpm: bpmRef.current,
        speed: k.speed,
        density: k.multiply,
        pitchSemis: k.pitch,
        audioNow: a ? a.ctx.currentTime : 0,
        globalTime: gT,
        baseLaps: cyc.baseLaps,
        macroCycleSeconds: cyc.macroCycleSeconds,
        noteCount: cyc.noteCount,
      };
      const runScene = <S,>(
        impl: typeof stringNetworkScene extends import("@/lib/engine/sceneTypes").Scene<infer _>
          ? import("@/lib/engine/sceneTypes").Scene<S>
          : never,
        getState: () => S | null,
        setState: (s: S) => void,
      ) => {
        let st = getState();
        if (!st) {
          st = impl.init(globals);
          setState(st);
        }
        // Phase-Zero render: visuals derive purely from globalTime, audio
        // is owned by the scheduler. `sample` may hot-reseed on density
        // changes — call it every frame before `draw`.
        impl.sample?.(st, gT, globals);
        impl.draw(st, ctx2d, globals);
      };
      if (scene === "stringNet") {
        runScene(stringNetworkScene, () => e.stringNet, (s) => (e.stringNet = s));
      } else if (scene === "pendulumFan") {
        runScene(pendulumFanScene, () => e.pendulumFan, (s) => (e.pendulumFan = s));
      } else if (scene === "spiralArp") {
        runScene(spiralArpScene, () => e.spiralArp, (s) => (e.spiralArp = s));
      } else if (scene === "radialSweep") {
        runScene(radialSweepScene, () => e.radialSweep, (s) => (e.radialSweep = s));
      } else if (scene === "mandalaMatrix") {
        runScene(mandalaMatrixScene, () => e.mandalaMatrix, (s) => (e.mandalaMatrix = s));
      } else if (scene === "metatronLattice") {
        runScene(metatronLatticeScene, () => e.metatronLattice, (s) => (e.metatronLattice = s));
      } else if (scene === "fractalNebula") {
        runScene(fractalNebulaScene, () => e.fractalNebula, (s) => (e.fractalNebula = s));
      } else if (scene === "radialResonator") {
        runScene(radialResonatorScene, () => e.radialResonator, (s) => (e.radialResonator = s));
      } else if (scene === "phaseAlignRings") {
        runScene(phaseAlignRingsScene, () => e.phaseAlignRings, (s) => (e.phaseAlignRings = s));
      } else if (scene === "voidSheets") {
        runScene(voidSheetsScene, () => e.voidSheets, (s) => (e.voidSheets = s));
      } else if (scene === "custom") {
        runScene(customScene, () => e.custom, (s) => (e.custom = s));
      }
    }
    updateBursts(dt);
    drawBursts(ctx2d);
    updateFlares(dt);
    drawFlares(ctx2d, W, H);
    updateShockwaves(dt);
    drawShockwaves(ctx2d, W, H);
    updateInkBleeds(dt);
    drawInkBleeds(ctx2d);
    ctx2d.globalCompositeOperation = "source-over";
  };

  /* ---- Transport ---- */
  const togglePlay = async () => {
    const a = ensureAudio();
    engineClock.attachAudio(a.ctx);
    applyFxState(a, fxState);
    if (a.ctx.state === "suspended") await a.ctx.resume();
    if (playingRef.current) resetComposerSources();
    if (playingRef.current) engineClock.pause();
    else {
      // Always start a play session from the Big Bang formation so every
      // note rests on its trigger point and fires together on click.
      engineClock.resetPhaseZero();
      engineClock.resume();
    }
    engineScheduler.resync();
    setPlaying((p) => !p);
  };

  const setKnob = (key: keyof Knobs, val: number) => setKnobs((k) => ({ ...k, [key]: val }));

  const isWheel = scene === "wheel";

  /* ---- Universal Big Bang on shape change ----
   * Whenever the composition shape changes (scene, note count, scale, root,
   * or any composer slot), snap scene-time back to t=0 so every node returns
   * to its rest formation and the next play click is a Big Bang.
   */
  const shapeSig =
    `${scene}|${knobs.multiply}|${composer.scale}|${composer.root}|` +
    composer.slots
      .map((s) => `${s.k}/${s.n}/${s.rotation}/${s.noteMode}`)
      .join(",");
  useEffect(() => {
    engineClock.resetPhaseZero();
    engineScheduler.resync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeSig]);

  /* ---- Wheel pointer interaction ---- */
  const onCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (sceneRef.current !== "wheel") return;
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const handled = wheelHandleClick(engineRef.current.wheel, px, py, rect.width, rect.height);
    if (handled) bumpTopo();
  };

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (sceneRef.current !== "wheel") return;
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const cx = rect.width / 2,
      cy = rect.height / 2;
    const r = Math.hypot(px - cx, py - cy);
    const wh = engineRef.current.wheel;
    let hit: string | null = null;
    let bestD = 14;
    for (const ring of wh.rings) {
      const R = (ring.radiusFactor * Math.min(rect.width, rect.height)) / 2;
      const d = Math.abs(r - R);
      if (d < bestD) {
        bestD = d;
        hit = ring.id;
      }
    }
    hoverRingIdRef.current = hit;
    setHoverRing((prev) => (prev === hit ? prev : hit));
  };
  const onCanvasPointerLeave = () => {
    hoverRingIdRef.current = null;
    setHoverRing(null);
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
      beats: 4,
      subdivision: 4,
      direction: wh.rings.length % 2 === 0 ? 1 : -1,
      phase: 0,
      voiceSlot: slot,
      notes: [],
      flash: 0,
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
    const presets = [
      Math.PI / 2,
      0,
      Math.PI / 4,
      (3 * Math.PI) / 4,
      Math.PI / 6,
      (5 * Math.PI) / 6,
    ];
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
    if (l) {
      l.angle = angle;
      bumpTopo();
    }
  };
  const clearLines = () => {
    const wh = engineRef.current.wheel;
    wh.lines = [];
    bumpTopo();
  };
  const updateRing = (id: string, patch: Partial<WheelRing>) => {
    const wh = engineRef.current.wheel;
    const r = wh.rings.find((x) => x.id === id);
    if (!r) return;
    Object.assign(r, patch);
    bumpTopo();
  };

  /* ---- Pendulum mutators ---- */
  const addBob = () => {
    const p = engineRef.current.pendulum;
    const idx = p.bobs.length % PEND_RATIOS.length;
    const slot = p.bobs.length % 6;
    p.bobs.push({
      id: uid("p"),
      ratioIndex: idx,
      slotIndex: slot,
      pitchIndex: 7 - p.bobs.length * 2,
      phase: Math.random(),
      prevSign: 1,
      flash: 0,
    });
    bumpTopo();
  };
  const clearBobs = () => {
    engineRef.current.pendulum.bobs = [];
    bumpTopo();
  };

  /* ---- Bars mutators ---- */
  const addLane = () => {
    const b = engineRef.current.bars;
    const idx = b.lanes.length % BAR_RATIOS.length;
    const slot = b.lanes.length % 6;
    b.lanes.push({
      id: uid("b"),
      ratioIndex: idx,
      slotIndex: slot,
      pitchIndex: 12 - b.lanes.length * 3,
      phase: Math.random() * 0.4,
      flash: 0,
      lastTriggerY: 1,
    });
    bumpTopo();
  };
  const clearLanes = () => {
    engineRef.current.bars.lanes = [];
    bumpTopo();
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col relative pr-stage"
      style={{ color: "var(--pr-text)" }}
    >
      <PerfProbeMount />
      <PhaseReadout
        scene={scene}
        wheel={engineRef.current.wheel}
        pendulum={engineRef.current.pendulum}
        bars={engineRef.current.bars}
        bpm={bpm}
        hoverRingId={hoverRing}
        topo={topo}
      />
      <AdminTrigger />
      {/* CANVAS */}
      <main className="flex-1 relative" style={{ minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          data-scene-canvas
          className="absolute inset-0 w-full h-full block"
          style={{ background: "transparent", cursor: isWheel ? "crosshair" : "default" }}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerLeave={onCanvasPointerLeave}
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
            onHoverRing={(id) => {
              hoverRingIdRef.current = id;
              setHoverRing(id);
            }}
          />
        )}
      </main>
      <PhaseDock
        playing={playing}
        onTogglePlay={togglePlay}
        scene={scene}
        onScene={setScene}
        multiply={knobs.multiply}
        onMultiply={(n) => setKnobs((k) => ({ ...k, multiply: n }))}
        notesCount={resolveNotesCount(scene, knobs.multiply, resolveGlobalCycle().noteCount)}
        cycleOverride={cycleOverrideRef.current}
        cycleActiveScene={{
          baseLaps: getActiveScene()?.base_laps ?? 10,
          macroCycleSeconds: getActiveScene()?.macro_cycle_seconds ?? 30,
          noteCount: getActiveScene()?.note_count ?? 8,
        }}
        onCycleOverride={(o) => saveCycleOverride(o)}
        bpm={bpm}
        onBpm={setBpm}
        speed={knobs.speed}
        onSpeed={(n) => {
          engineClock.setSpeed(n);
          setKnobs((k) => ({ ...k, speed: n }));
        }}
        fx={fxState}
        onFx={setFxState}
        packs={allPacks}
        packId={selectedPack}
        onPackId={setSelectedPack}
        neural={neural}
        onNeural={(s) => {
          setNeural(s);
          saveNeuralSettings(s);
        }}
        composer={composer}
        onComposer={(s) => {
          setComposer(s);
          saveComposerSettings(s);
        }}
        authed={!!auth.user}
        email={auth.user?.email ?? null}
        onSignOut={() => {
          supabase.auth.signOut();
        }}
        onShare={handleShare}
        onBigBang={() => engineClock.resetPhaseZero()}
      />
      {shareToast && (
        <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2 pointer-events-none">
          <div className="px-4 py-2 rounded-full border border-white/10 bg-[hsl(220_22%_7%/0.88)] backdrop-blur-2xl text-[11px] uppercase tracking-[0.16em] text-white/80 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.65)]">
            {shareToast}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Wheel — update, render, hit-testing, overlays
 * ============================================================ */

const TAU = Math.PI * 2;

function norm2pi(a: number) {
  return ((a % TAU) + TAU) % TAU;
}

// Returns smallest forward distance from prev to target (prev → +ω → target).
function fwdDist(prev: number, target: number) {
  return (((target - prev) % TAU) + TAU) % TAU;
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
  wh: WheelState,
  dt: number,
  audio: AudioGraph,
  bpm: number,
  voices: VoiceSel,
  knobs: Knobs,
  pack: RuntimePack,
  W = 0,
  H = 0,
) {
  const now = audio.ctx.currentTime;
  const REFRACTORY = 0.16; // prevents frame jitter and ambient voice pileups

  decayWheelFlashes(wh, dt);

  for (let ri = 0; ri < wh.rings.length; ri++) {
    const ring = wh.rings[ri];
    const period = ringPeriodSec(ring, bpm);
    const omega = TAU / Math.max(0.001, period); // rad/s
    const sign = ring.direction;
    const prevPhase = ring.phase;
    const nextPhase = prevPhase + sign * omega * dt;
    ring.phase = nextPhase;
    const movingForward = nextPhase >= prevPhase;

    const voiceLegacy = resolveVoice(ring.voiceSlot, voices);

    for (const note of ring.notes) {
      const prevWorld = norm2pi(note.angle + prevPhase);
      const newWorld = norm2pi(note.angle + nextPhase);

      // For each line, two target angles: angle and angle+π
      for (const line of wh.lines) {
        for (let s = 0; s < 2; s++) {
          const target = norm2pi(line.angle + s * Math.PI);
          let crossed = false;
          if (movingForward) {
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

            if (voiceLegacy !== "none") {
              const fallback = vertexFreq(note.pitchIndex, 0);
              const sourceId = `wheel:${ring.id}:${note.id}`;
              const { play, freq } = composerAdvance(sourceId, ri, fallback);
              if (!play) continue; // rest → skip audio + visual flash
              const out = freq * Math.pow(2, knobs.pitch / 12);
              triggerPackVoice(audio.ctx, audio.preFx, pack, ri, out, now);
            }
            note.flash = 1;
            ring.flash = Math.max(ring.flash, 0.7);
            line.flash = 1;
            // record spark location for visual (approx at target angle, radius of ring)
            // we don't have W/H here; store in normalized polar (target, ringId)
            line.sparks.push({ x: target, y: ring.radiusFactor, t: 0.6 });
            if (W > 0 && H > 0) {
              const rr = ringRadiusPx(ring, W, H);
              const fx = (W / 2 + Math.cos(target) * rr) / W;
              const fy = (H / 2 + Math.sin(target) * rr) / H;
              {
                const hue = ri * 0.37 + 0.1;
                flashBus.flash(fx, fy, 0.85, hue);
                spawnBurst(fx * W, fy * H, { hue, energy: 0.85 });
              }
            }
          }
        }
      }
      note.prevWorld = newWorld;
    }
  }
}

function wheelHandleClick(wh: WheelState, px: number, py: number, W: number, H: number): boolean {
  const cx = W / 2,
    cy = H / 2;
  const dx = px - cx,
    dy = py - cy;
  const r = Math.hypot(dx, dy);
  const ang = norm2pi(Math.atan2(dy, dx));

  // 1) try to remove an existing note (within 14px)
  for (const ring of wh.rings) {
    const ringR = ringRadiusPx(ring, W, H);
    for (let i = ring.notes.length - 1; i >= 0; i--) {
      const n = ring.notes[i];
      const wn = norm2pi(n.angle + ring.phase);
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
    if (d < 14 && d < bestDist) {
      best = ring;
      bestIdx = idx;
      bestDist = d;
    }
  });
  if (best) {
    const ring = best as WheelRing;
    const localAngle = norm2pi(ang - ring.phase);
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
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  wh: WheelState,
  voices: VoiceSel,
  _dt: number = 0,
  hoverRingId: string | null = null,
) {
  const cx = W / 2,
    cy = H / 2;
  const maxR = Math.min(W, H) / 2;
  const t = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;

  // 1) rings — restrained hairlines + slow rotating sheen ("barely breathing")
  for (const ring of wh.rings) {
    const R = ringRadiusPx(ring, W, H);
    const hovered = ring.id === hoverRingId;
    const base = hovered ? 0.2 : 0.06;
    ctx.strokeStyle = `rgba(255,255,255,${(base + ring.flash * 0.35).toFixed(3)})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();

    // Slow tidal sheen — wide bright arc drifts around the ring, never fully dark.
    // Deterministic per-ring phase so rings don't shimmer in lockstep.
    const ringPhase = hashPhase(ring.id);
    const SEG = 24;
    const sweep = TAU / SEG;
    const sheenPeak = hovered ? 0.32 : 0.22;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < SEG; i++) {
      const a0 = i * sweep;
      const s = 0.5 + 0.5 * Math.sin(a0 - t * 0.18 + ringPhase);
      const alpha = sheenPeak * (s * s);
      if (alpha < 0.005) continue;
      ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, R, a0, a0 + sweep + 0.002);
      ctx.stroke();
    }

    // Trigger bloom — full ring glow that decays with ring.flash
    if (ring.flash > 0.02) {
      ctx.save();
      ctx.shadowColor = "rgba(255,255,255,0.9)";
      ctx.shadowBlur = 18;
      ctx.strokeStyle = `rgba(255,255,255,${(0.35 * ring.flash).toFixed(3)})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 2) trigger lines — hairline chord + traveling highlight + flash bloom
  for (const line of wh.lines) {
    const x1 = cx + Math.cos(line.angle) * maxR * 0.96;
    const y1 = cy + Math.sin(line.angle) * maxR * 0.96;
    const x2 = cx - Math.cos(line.angle) * maxR * 0.96;
    const y2 = cy - Math.sin(line.angle) * maxR * 0.96;
    // Whole-chord breath — line itself gently brightens and dims on a slow sine.
    const linePhase = hashPhase(String(line.angle.toFixed(4)));
    const lineBreath = 0.5 + 0.5 * Math.sin(t * 0.32 + linePhase); // ~6.3s period
    const lineAlpha = 0.08 + lineBreath * 0.12 + line.flash * 0.3;
    ctx.strokeStyle = `rgba(255,255,255,${lineAlpha.toFixed(3)})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Trigger flash — whole-line bloom while line.flash decays
    if (line.flash > 0.02) {
      ctx.save();
      ctx.shadowColor = "rgba(255,255,255,0.9)";
      ctx.shadowBlur = 14;
      ctx.strokeStyle = `rgba(255,255,255,${(0.55 * line.flash).toFixed(3)})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }
    // ink-bleed ripple at each crossing (Fluid Inversion)
    for (const s of line.sparks) {
      const sx = cx + Math.cos(s.x) * s.y * (Math.min(W, H) / 2);
      const sy = cy + Math.sin(s.x) * s.y * (Math.min(W, H) / 2);
      // s.t starts at 0.6 (life). Convert to elapsed k in [0..1] (life 0.5s scaled).
      const elapsed = 0.6 - s.t;
      const k = Math.max(0, Math.min(1, elapsed / 0.5));
      const radius = 40 * (1 - Math.pow(1 - k, 3)); // exp ease-out
      const alpha = Math.pow(1 - k, 2.2) * 0.55;
      if (alpha < 0.01) continue;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(2, radius));
      g.addColorStop(0, `rgba(255,255,255,0)`);
      g.addColorStop(0.55, `rgba(255,255,255,${(alpha * 0.9).toFixed(3)})`);
      g.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(2, radius), 0, TAU);
      ctx.fill();
    }
  }

  // 3) notes — soft discs + kinetic trails
  for (const ring of wh.rings) {
    const R = ringRadiusPx(ring, W, H);
    const color = voiceSlotColor(ring.voiceSlot, true);
    for (const n of ring.notes) {
      const w = norm2pi(n.angle + ring.phase);
      const nx = cx + Math.cos(w) * R;
      const ny = cy + Math.sin(w) * R;
      const inten = n.flash;
      // Resting breath — each note pulses with its own phase so they're never in lockstep.
      const nPhase = hashPhase(n.id);
      const breath = 0.5 + 0.5 * Math.sin(t * 0.6 + nPhase);
      const breathR = 1 + 0.18 * (breath * 2 - 1);
      const breathA = 0.75 + 0.35 * (breath * 2 - 1);

      // kinetic trail (6 samples behind the note)
      const trail = getTrail(n);
      // draw oldest → newest
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        const tk = (i + 1) / (trail.length + 1);
        const tr = 1.4 + tk * 2.2;
        const ta = 0.04 + tk * 0.08;
        ctx.fillStyle = color.replace("a", ta.toFixed(3));
        ctx.beginPath();
        ctx.arc(p.x, p.y, tr, 0, TAU);
        ctx.fill();
      }
      // sample current position into trail (cap length)
      trail.push({ x: nx, y: ny });
      if (trail.length > 6) trail.shift();

      // soft note disc (with gentle breath)
      const baseR = (3.5 + inten * 5) * breathR;
      const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, baseR + 10);
      g.addColorStop(0, color.replace("a", breathA.toFixed(3)));
      g.addColorStop(0.45, color.replace("a", (0.3 + inten * 0.4).toFixed(3)));
      g.addColorStop(1, color.replace("a", "0"));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(nx, ny, baseR + 10, 0, TAU);
      ctx.fill();

      // Slow breath halo — quiet glow that swells with each note's own phase.
      {
        const haloR = baseR * 2.2 + 8;
        const ha = 0.06 + 0.06 * breath;
        const bg = ctx.createRadialGradient(nx, ny, 0, nx, ny, haloR);
        bg.addColorStop(0, color.replace("a", ha.toFixed(3)));
        bg.addColorStop(1, color.replace("a", "0"));
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(nx, ny, haloR, 0, TAU);
        ctx.fill();
      }

      // trigger halo — wide additive bloom decaying with n.flash
      if (inten > 0.02) {
        const haloR = baseR * 3.2 + 14;
        const hg2 = ctx.createRadialGradient(nx, ny, 0, nx, ny, haloR);
        hg2.addColorStop(0, color.replace("a", (0.5 * inten).toFixed(3)));
        hg2.addColorStop(0.5, color.replace("a", (0.18 * inten).toFixed(3)));
        hg2.addColorStop(1, color.replace("a", "0"));
        ctx.fillStyle = hg2;
        ctx.beginPath();
        ctx.arc(nx, ny, haloR, 0, TAU);
        ctx.fill();
      }
    }
  }
}

// Deterministic phase in [0, TAU) from an arbitrary id string.
function hashPhase(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (((h >>> 0) % 10000) / 10000) * TAU;
}

/* ============================================================
 * Art surface helpers (modular for future sequencers)
 * ============================================================ */

const noteTrails = new WeakMap<WheelNote, { x: number; y: number }[]>();
function getTrail(n: WheelNote): { x: number; y: number }[] {
  let t = noteTrails.get(n);
  if (!t) {
    t = [];
    noteTrails.set(n, t);
  }
  return t;
}

function buildGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const size = 256;
  const off = document.createElement("canvas");
  off.width = size;
  off.height = size;
  const octx = off.getContext("2d");
  if (!octx) return null;
  const img = octx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 10; // ~4% alpha grain
  }
  octx.putImageData(img, 0, 0);
  return ctx.createPattern(off, "repeat");
}

function paintArtBackground(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  patternRef: { current: CanvasPattern | null },
) {
  // Canvas is transparent — the teal page field shows through the glass card.
  ctx.clearRect(0, 0, W, H);
  // Soft inner bloom for depth inside the card
  const vg = ctx.createRadialGradient(
    W * 0.62,
    H * 0.42,
    Math.min(W, H) * 0.05,
    W * 0.62,
    H * 0.42,
    Math.max(W, H) * 0.7,
  );
  vg.addColorStop(0, "rgba(255,255,255,0.07)");
  vg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  // Subtle grain
  if (!patternRef.current) patternRef.current = buildGrainPattern(ctx);
  if (patternRef.current) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = patternRef.current;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// (ghost readout removed — numeric info now lives in the left-side PhaseReadout pile)

/* ============================================================
 * Pendulum scene — Galileo-style hanging bobs
 * ============================================================ */

function decayPendulumFlashes(pend: PendulumState, dt: number) {
  const k = 1 - Math.exp(-dt * 3.2);
  for (const b of pend.bobs) b.flash = Math.max(0, b.flash - k);
}

function updatePendulum(
  pend: PendulumState,
  dt: number,
  audio: AudioGraph,
  bpm: number,
  knobs: Knobs,
  pack: RuntimePack,
  W = 0,
  H = 0,
) {
  decayPendulumFlashes(pend, dt);
  const now = audio.ctx.currentTime;
  const n = pend.bobs.length;
  const ax = W / 2,
    ay = H * 0.16;
  const maxLen = H * 0.62,
    minLen = H * 0.3;
  pend.bobs.forEach((b, i) => {
    const period = pendPeriodSec(b, bpm);
    const inc = dt / Math.max(0.001, period);
    b.phase = (b.phase + inc) % 1;
    // SHM displacement: sin(2π·phase). Trigger on zero-cross (sign flip).
    const s = Math.sin(b.phase * Math.PI * 2);
    const sign: 1 | -1 = s >= 0 ? 1 : -1;
    if (sign !== b.prevSign) {
      const fallback = pitchToFreq(b.pitchIndex);
      const sourceId = `pend:${b.id}`;
      const { play, freq } = composerAdvance(sourceId, b.slotIndex, fallback);
      b.prevSign = sign;
      if (!play) return;
      const out = freq * Math.pow(2, knobs.pitch / 12);
      triggerPackVoice(audio.ctx, audio.preFx, pack, b.slotIndex, out, now + 0.005);
      b.flash = 1;
      if (W > 0 && H > 0) {
        const t = n <= 1 ? 0.5 : i / (n - 1);
        const len = minLen + (maxLen - minLen) * t;
        const ang = Math.sin(b.phase * Math.PI * 2) * 0.55;
        const bx = ax + Math.sin(ang) * len;
        const by = ay + Math.cos(ang) * len;
        {
          const hue = i * 0.41 + 0.6;
          flashBus.flash(bx / W, by / H, 0.8, hue);
          spawnBurst(bx, by, { hue, energy: 0.7 });
        }
      }
    }
  });
}

function drawPendulumScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  pend: PendulumState,
  hoverId: string | null,
) {
  const ax = W / 2;
  const ay = H * 0.16;
  const maxLen = H * 0.62;
  const minLen = H * 0.3;
  const n = pend.bobs.length;

  // anchor bar
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(ax - 220, ay);
  ctx.lineTo(ax + 220, ay);
  ctx.stroke();

  pend.bobs.forEach((b, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const len = minLen + (maxLen - minLen) * t;
    // swing amplitude in radians (small angle illusion, looks meditative)
    const amp = 0.55;
    const ang = Math.sin(b.phase * Math.PI * 2) * amp;
    const bx = ax + Math.sin(ang) * len;
    const by = ay + Math.cos(ang) * len;
    const hot = hoverId === b.id;

    // string
    ctx.strokeStyle = hot ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.22)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();

    // bob glow
    const baseR = 6 + b.flash * 10;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, 60);
    const a = 0.35 + b.flash * 0.55;
    g.addColorStop(0, `rgba(180, 220, 255, ${a})`);
    g.addColorStop(0.4, `rgba(120, 180, 230, ${a * 0.4})`);
    g.addColorStop(1, "rgba(120,180,230,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, 60, 0, Math.PI * 2);
    ctx.fill();

    // crisp ring
    ctx.strokeStyle = `rgba(220,235,255,${0.55 + b.flash * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bx, by, baseR, 0, Math.PI * 2);
    ctx.stroke();
  });
}

/* ============================================================
 * Bars scene — vertical lanes with falling playheads
 * ============================================================ */

function decayBarsFlashes(bars: BarsState, dt: number) {
  const k = 1 - Math.exp(-dt * 3.2);
  for (const l of bars.lanes) l.flash = Math.max(0, l.flash - k);
}

function updateBars(
  bars: BarsState,
  dt: number,
  audio: AudioGraph,
  bpm: number,
  knobs: Knobs,
  pack: RuntimePack,
  W = 0,
  H = 0,
) {
  decayBarsFlashes(bars, dt);
  const now = audio.ctx.currentTime;
  const n = bars.lanes.length;
  const padX = W * 0.12;
  const usable = W - padX * 2;
  const step = n > 1 ? usable / (n - 1) : 0;
  const bot = H * 0.84;
  bars.lanes.forEach((l, i) => {
    const period = barPeriodSec(l, bpm);
    const prev = l.phase;
    l.phase = (l.phase + dt / Math.max(0.001, period)) % 1;
    if (l.phase < prev) {
      // wrapped → trigger
      const fallback = pitchToFreq(l.pitchIndex);
      const sourceId = `bars:${l.id}`;
      const { play, freq } = composerAdvance(sourceId, l.slotIndex, fallback);
      if (!play) return;
      const out = freq * Math.pow(2, knobs.pitch / 12);
      triggerPackVoice(audio.ctx, audio.preFx, pack, l.slotIndex, out, now + 0.005);
      l.flash = 1;
      l.lastTriggerY = 1;
      if (W > 0 && H > 0) {
        const x = padX + step * i;
        {
          const hue = i * 0.29 + 0.25;
          flashBus.flash(x / W, bot / H, 0.8, hue);
          spawnBurst(x, bot, { hue, energy: 0.75 });
        }
      }
    }
  });
}

function drawBarsScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  bars: BarsState,
  hoverId: string | null,
) {
  const n = bars.lanes.length;
  if (n === 0) return;
  const padX = W * 0.12;
  const top = H * 0.16;
  const bot = H * 0.84;
  const usable = W - padX * 2;
  const step = usable / (n - 1 || 1);

  // baseline + ceiling hairlines
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(padX - 30, bot);
  ctx.lineTo(W - padX + 30, bot);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(padX - 30, top);
  ctx.lineTo(W - padX + 30, top);
  ctx.stroke();

  const pts: { x: number; y: number; flash: number; hot: boolean; id: string }[] = [];

  bars.lanes.forEach((l, i) => {
    const x = n === 1 ? W / 2 : padX + step * i;
    // lane track
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bot);
    ctx.stroke();

    const y = top + (bot - top) * l.phase;
    const hot = hoverId === l.id;
    pts.push({ x, y: bot, flash: l.flash, hot, id: l.id });

    // playhead glow
    const g = ctx.createRadialGradient(x, y, 0, x, y, 40);
    g.addColorStop(0, "rgba(200,225,255,0.55)");
    g.addColorStop(1, "rgba(200,225,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hot ? "rgba(255,255,255,0.85)" : "rgba(220,235,255,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.stroke();

    // bottom strike node
    const sR = 4 + l.flash * 12;
    const sa = 0.35 + l.flash * 0.55;
    const sg = ctx.createRadialGradient(x, bot, 0, x, bot, 70);
    sg.addColorStop(0, `rgba(180,220,255,${sa})`);
    sg.addColorStop(1, "rgba(120,180,230,0)");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(x, bot, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(220,235,255,${0.5 + l.flash * 0.5})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, bot, sR, 0, Math.PI * 2);
    ctx.stroke();
  });

  // zigzag connector along bottom nodes
  if (pts.length > 1) {
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const offY = i % 2 === 0 ? -8 : 8;
      if (i === 0) ctx.moveTo(p.x, p.y + offY);
      else ctx.lineTo(p.x, p.y + offY);
    }
    ctx.stroke();
  }
}

/* ---- Wheel DOM overlays ---- */

function WheelOverlays({
  wheel,
  topo,
  canvasW,
  canvasH,
  onAddRing,
  onAddLine,
  onRemoveRing,
  onRemoveLine,
  onSetLineAngle,
  onUpdateRing,
  onHoverRing,
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
  onHoverRing?: (id: string | null) => void;
}) {
  // touch topo so eslint doesn't whine and to force re-render
  void topo;
  void onAddRing;
  void onAddLine;

  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const maxR = Math.min(canvasW, canvasH) / 2;

  return (
    <>
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
            onHover={(h) => onHoverRing?.(h ? r.id : null)}
          />
        );
      })}

      {/* Line handles at the +angle endpoint */}
      {wheel.lines.map((l) => (
        <LineHandle
          key={l.id}
          line={l}
          cx={cx}
          cy={cy}
          maxR={maxR}
          onSetAngle={(a) => onSetLineAngle(l.id, a)}
          onRemove={() => onRemoveLine(l.id)}
        />
      ))}
    </>
  );
}

function RingChip({
  ring,
  left,
  top,
  onRemove,
  onUpdate,
  onHover,
}: {
  ring: WheelRing;
  left: number;
  top: number;
  onRemove: () => void;
  onUpdate: (patch: Partial<WheelRing>) => void;
  onHover?: (hover: boolean) => void;
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

  const dot =
    ring.voiceSlot === "melo"
      ? "oklch(0.82 0.18 195)"
      : ring.voiceSlot === "bass"
        ? "oklch(0.72 0.22 310)"
        : "oklch(0.86 0.16 85)";

  const cycleSlot = () => {
    const i = VOICE_SLOTS.indexOf(ring.voiceSlot);
    onUpdate({ voiceSlot: VOICE_SLOTS[(i + 1) % VOICE_SLOTS.length] });
  };

  return (
    <div
      className="absolute flex items-center gap-1.5 px-1.5 py-0.5 rounded-sm text-[10px] tracking-wider select-none transition-opacity"
      style={{
        left,
        top,
        background: "transparent",
        color: "rgba(255,255,255,0.45)",
        fontFamily: "var(--pr-mono)",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        opacity: 0.6,
      }}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      <button
        title="cycle voice"
        onClick={cycleSlot}
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: dot }}
      />
      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setEditing(false);
              setVal(`${ring.beats}/${ring.subdivision}`);
            }
          }}
          className="w-12 bg-transparent outline-none border-b"
          style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.8)" }}
        />
      ) : (
        <button
          className="hover:text-white"
          onClick={() => {
            setVal(`${ring.beats}/${ring.subdivision}`);
            setEditing(true);
          }}
        >
          {ring.beats}/{ring.subdivision}
        </button>
      )}
      <button
        title="toggle direction"
        onClick={() => onUpdate({ direction: (ring.direction === 1 ? -1 : 1) as 1 | -1 })}
        className="hover:text-white"
      >
        {ring.direction === 1 ? "↻" : "↺"}
      </button>
      <span className="opacity-50">·</span>
      <button className="hover:text-white" onClick={cycleSlot}>
        {ring.voiceSlot}
      </button>
      <button className="hover:text-white" onClick={onRemove} title="remove ring">
        ×
      </button>
    </div>
  );
}

function LineHandle({
  line,
  cx,
  cy,
  maxR,
  onSetAngle,
  onRemove,
}: {
  line: WheelLine;
  cx: number;
  cy: number;
  maxR: number;
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
          left: hx - 8,
          top: hy - 8,
          width: 16,
          height: 16,
          borderRadius: 999,
          background: "transparent",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)",
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

/* ============================================================
 * Floating glass dock (Wheel art mode)
 * ============================================================ */

/* ============================================================
 * PhaseChrome — page-level HUD: wordmark, live clock, rail, meta
 * ============================================================ */

function PhaseReadout({
  scene,
  wheel,
  pendulum,
  bars,
  bpm,
  hoverRingId,
  topo,
}: {
  scene: SceneKind;
  wheel: WheelState;
  pendulum: PendulumState;
  bars: BarsState;
  bpm: number;
  hoverRingId: string | null;
  topo: number;
}) {
  void topo;
  let rows: { id: string; label: string; period: number }[] = [];
  if (scene === "wheel") {
    rows = wheel.rings.map((r) => ({
      id: r.id,
      label: `${r.beats}/${r.subdivision}`,
      period: ringPeriodSec(r, bpm),
    }));
  } else if (scene === "pendulum") {
    rows = pendulum.bobs.map((b, i) => ({
      id: b.id,
      label: `P${i + 1}`,
      period: pendPeriodSec(b, bpm),
    }));
  } else {
    rows = bars.lanes.map((l) => {
      const r = BAR_RATIOS[l.ratioIndex % BAR_RATIOS.length];
      return { id: l.id, label: `${r.num}/${r.den}`, period: barPeriodSec(l, bpm) };
    });
  }
  return (
    <div className="pointer-events-none absolute left-7 z-10" style={{ top: 260 }}>
      <div className="pr-label text-white/30 mb-2">READOUT · {scene.toUpperCase()}</div>
      <div className="flex flex-col gap-1 tabular-nums">
        {rows.map((r) => {
          const active = r.id === hoverRingId;
          return (
            <div
              key={r.id}
              className="pr-label transition-opacity"
              style={{ color: active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.32)" }}
            >
              {r.label} · {r.period.toFixed(2)}S
            </div>
          );
        })}
        <div className="pr-label text-white/30 mt-2">{bpm} BPM</div>
      </div>
    </div>
  );
}

type PanelId = "fx" | "packs" | "about" | "visuals";
function PhaseChrome({
  scene,
  onScene,
  fxOpen,
  packsOpen,
  aboutOpen,
  visualsOpen,
  onOpenPanel,
  onCloseAll,
}: {
  scene: SceneKind;
  onScene: (s: SceneKind) => void;
  fxOpen: boolean;
  packsOpen: boolean;
  aboutOpen: boolean;
  visualsOpen: boolean;
  onOpenPanel: (p: PanelId) => void;
  onCloseAll: () => void;
}) {
  const { user, isAdmin } = useAuth();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const pad = (n: number) => n.toString().padStart(2, "0");
  let time = "";
  let date = "";
  if (now) {
    const h24 = now.getHours();
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h = ((h24 + 11) % 12) + 1;
    time = `${pad(h)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${ampm}`;
    const months = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ];
    date = `${months[now.getMonth()]} ${pad(now.getDate())}, ${now.getFullYear()}`;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* Wordmark — top-left */}
      <div className="absolute top-6 left-7 flex items-center gap-2 pointer-events-auto">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          className="text-white/85"
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" strokeLinecap="round" />
        </svg>
        <div
          className="text-white/90"
          style={{ fontFamily: "var(--pr-mono)", fontSize: 14, letterSpacing: "0.04em" }}
        >
          Phase<span className="text-white/45 text-[10px] align-super">®</span>
        </div>
      </div>

      {/* Clock + HUD icons — top-right */}
      <div className="absolute top-6 right-8 flex flex-col items-end gap-2 pointer-events-auto">
        <div className="pr-label text-white/80 tabular-nums">{time}</div>
        <div className="pr-label text-white/45 tabular-nums">{date}</div>
        <div className="flex items-center gap-2 mt-1">
          <button className="pr-hud-ring" title="ambient">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4a8 8 0 100 16V4z" />
            </svg>
          </button>
          <button className="pr-hud-ring" title="phase">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13" />
            </svg>
          </button>
        </div>
      </div>

      {/* Left rail nav */}
      <nav className="absolute top-32 left-7 flex flex-col gap-0.5 pointer-events-auto">
        <div className="pr-label text-white/30 mb-1">SCENE</div>
        <button
          className="pr-rail-link"
          data-active={
            scene === "wheel" && !fxOpen && !packsOpen && !aboutOpen ? "true" : undefined
          }
          onClick={() => {
            onScene("wheel");
            onCloseAll();
          }}
        >
          Wheel
        </button>
        <button
          className="pr-rail-link"
          data-active={
            scene === "pendulum" && !fxOpen && !packsOpen && !aboutOpen ? "true" : undefined
          }
          onClick={() => {
            onScene("pendulum");
            onCloseAll();
          }}
        >
          Pendulum
        </button>
        <button
          className="pr-rail-link"
          data-active={scene === "bars" && !fxOpen && !packsOpen && !aboutOpen ? "true" : undefined}
          onClick={() => {
            onScene("bars");
            onCloseAll();
          }}
        >
          Bars
        </button>
        <div className="pr-label text-white/30 mt-3 mb-1">PANELS</div>
        <button
          className="pr-rail-link"
          data-active={fxOpen ? "true" : undefined}
          onClick={() => onOpenPanel("fx")}
        >
          FX
        </button>
        <button
          className="pr-rail-link"
          data-active={packsOpen ? "true" : undefined}
          onClick={() => onOpenPanel("packs")}
        >
          Packs
        </button>
        <button
          className="pr-rail-link"
          data-active={aboutOpen ? "true" : undefined}
          onClick={() => onOpenPanel("about")}
        >
          About
        </button>
        <button
          className="pr-rail-link"
          data-active={visualsOpen ? "true" : undefined}
          onClick={() => onOpenPanel("visuals")}
        >
          Visuals
        </button>
        {!user ? (
          <Link to="/auth" className="pr-rail-link">
            Sign in
          </Link>
        ) : (
          <button
            className="pr-rail-link"
            onClick={async () => {
              const { supabase } = await import("@/integrations/supabase/client");
              await supabase.auth.signOut();
            }}
          >
            Sign out
          </button>
        )}
      </nav>

      {/* Bottom-left tagline */}
      <div className="absolute bottom-6 left-7 pointer-events-auto">
        <div className="pr-label text-white/55 leading-[1.7]">
          GENERATIVE
          <br />
          POLYRHYTHMIC
          <br />
          AMBIENT INSTRUMENT.
        </div>
      </div>

      {/* Bottom-right meta */}
      <div className="absolute bottom-6 right-8 text-right pointer-events-auto">
        <div className="pr-label text-white/55">© 2026 PHASE, INC.</div>
        <div className="pr-label text-white/35 mt-1">X / GITHUB</div>
      </div>
    </div>
  );
}

function ArtDock({
  scene,
  playing,
  bpm,
  onTogglePlay,
  onAddNode,
  onAddLine,
  onClearLines,
  onBpm,
  fxOpen,
  onToggleFx,
  packsOpen,
  onTogglePacks,
}: {
  scene: SceneKind;
  playing: boolean;
  bpm: number;
  onTogglePlay: () => void;
  onAddNode: () => void;
  onAddLine: () => void;
  onClearLines: () => void;
  onBpm: (v: number) => void;
  fxOpen: boolean;
  onToggleFx: () => void;
  packsOpen: boolean;
  onTogglePacks: () => void;
}) {
  const addLabel = scene === "wheel" ? "add circle" : scene === "pendulum" ? "add bob" : "add lane";
  const clearLabel =
    scene === "wheel" ? "clear lines" : scene === "pendulum" ? "clear bobs" : "clear lanes";
  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-5 py-2.5 rounded-full border border-white/10 backdrop-blur-xl bg-neutral-950/40 pr-mono"
      style={{
        boxShadow:
          "0 18px 60px rgba(0,0,0,0.55), inset 0 1px 0 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.02)",
        zIndex: 5,
      }}
    >
      <DockBtn label={playing ? "pause" : "play"} onClick={onTogglePlay} active={playing}>
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </DockBtn>
      <span className="h-4 w-px bg-white/10" />
      <DockBtn label={addLabel} onClick={onAddNode}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" strokeLinecap="round" />
        </svg>
      </DockBtn>
      {scene === "wheel" && (
        <DockBtn label="add line" onClick={onAddLine}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M4 20L20 4" />
          </svg>
        </DockBtn>
      )}
      <DockBtn label={clearLabel} onClick={onClearLines}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M6 6l12 12M6 18L18 6" />
        </svg>
      </DockBtn>
      <span className="h-4 w-px bg-white/10" />
      <DockBtn label="fx" onClick={onToggleFx} active={fxOpen}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M4 7h10M18 7h2" />
          <circle cx="16" cy="7" r="1.6" fill="currentColor" />
          <path d="M4 12h4M12 12h8" />
          <circle cx="10" cy="12" r="1.6" fill="currentColor" />
          <path d="M4 17h12M20 17h0" />
          <circle cx="18" cy="17" r="1.6" fill="currentColor" />
        </svg>
      </DockBtn>
      <DockBtn label="packs" onClick={onTogglePacks} active={packsOpen}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 8l8-4 8 4-8 4-8-4z" />
          <path d="M4 12l8 4 8-4" />
          <path d="M4 16l8 4 8-4" />
        </svg>
      </DockBtn>
      <span className="h-4 w-px bg-white/10" />
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={20}
          max={180}
          step={1}
          value={bpm}
          onChange={(e) => onBpm(parseInt(e.target.value, 10))}
          className="pr-hairline-slider"
          style={{ width: 120 }}
          title={`${bpm} bpm`}
        />
        <div className="pr-label tabular-nums text-white/55">
          {bpm}
          <span className="ml-1 text-white/30">bpm</span>
        </div>
      </div>
    </div>
  );
}

function DockBtn({
  children,
  onClick,
  label,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        "h-7 w-7 grid place-items-center rounded-full transition-colors " +
        (active ? "text-white" : "text-white/60 hover:text-white")
      }
    >
      {children}
    </button>
  );
}

/* ============================================================
 * FX Drawer — expanding glass panel for sound effects
 * ============================================================ */

function FxDrawer({
  open,
  state,
  onChange,
}: {
  open: boolean;
  state: FxState;
  onChange: (next: FxState) => void;
}) {
  const patch = <K extends keyof FxState>(k: K, p: Partial<FxState[K]>) =>
    onChange({ ...state, [k]: { ...state[k], ...p } });

  return (
    <div
      data-state={open ? "open" : "closed"}
      className="fx-drawer absolute left-1/2 bottom-[88px] rounded-2xl border border-white/10 backdrop-blur-xl bg-neutral-950/40 pr-mono"
      style={{
        width: "min(720px, calc(100vw - 48px))",
        height: 260,
        boxShadow:
          "0 24px 70px rgba(0,0,0,0.65), inset 0 1px 0 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.03)",
        zIndex: 4,
      }}
    >
      <div className="pr-stagger h-full grid grid-cols-4 divide-x divide-white/[0.07]">
        <FxChannel
          title="reverb"
          types={["room", "hall", "plate", "cosmic"] as ReverbType[]}
          activeType={state.reverb.type}
          onType={(t) => patch("reverb", { type: t as ReverbType })}
          bypass={state.reverb.bypass}
          onBypass={() => patch("reverb", { bypass: !state.reverb.bypass })}
          sliders={[
            {
              label: "mix",
              value: state.reverb.mix,
              min: 0,
              max: 1,
              step: 0.01,
              display: (v) => Math.round(v * 100).toString(),
              onChange: (v) => patch("reverb", { mix: v }),
            },
            {
              label: "size",
              value: state.reverb.size,
              min: 0.05,
              max: 1.2,
              step: 0.01,
              display: (v) => v.toFixed(2),
              onChange: (v) => patch("reverb", { size: v }),
            },
          ]}
        />
        <FxChannel
          title="chorus"
          types={Object.keys(CHORUS_PRESETS) as ChorusType[]}
          activeType={state.chorus.type}
          onType={(t) =>
            patch("chorus", { type: t as ChorusType, rate: CHORUS_PRESETS[t as ChorusType].rate })
          }
          bypass={state.chorus.bypass}
          onBypass={() => patch("chorus", { bypass: !state.chorus.bypass })}
          sliders={[
            {
              label: "mix",
              value: state.chorus.mix,
              min: 0,
              max: 1,
              step: 0.01,
              display: (v) => Math.round(v * 100).toString(),
              onChange: (v) => patch("chorus", { mix: v }),
            },
            {
              label: "rate",
              value: state.chorus.rate,
              min: 0.1,
              max: 2,
              step: 0.01,
              display: (v) => `${v.toFixed(2)}hz`,
              onChange: (v) => patch("chorus", { rate: v }),
            },
          ]}
        />
        <FxChannel
          title="grain"
          types={Object.keys(GRAIN_PRESETS) as GrainType[]}
          activeType={state.grain.type}
          onType={(t) => patch("grain", { type: t as GrainType })}
          bypass={state.grain.bypass}
          onBypass={() => patch("grain", { bypass: !state.grain.bypass })}
          sliders={[
            {
              label: "mix",
              value: state.grain.mix,
              min: 0,
              max: 1,
              step: 0.01,
              display: (v) => Math.round(v * 100).toString(),
              onChange: (v) => patch("grain", { mix: v }),
            },
            {
              label: "density",
              value: state.grain.density,
              min: 0,
              max: 1,
              step: 0.01,
              display: (v) => Math.round(v * 100).toString(),
              onChange: (v) => patch("grain", { density: v }),
            },
          ]}
        />
        <FxChannel
          title="tone"
          types={Object.keys(TONE_PRESETS) as ToneType[]}
          activeType={state.tone.type}
          onType={(t) =>
            patch("tone", {
              type: t as ToneType,
              cutoff: TONE_PRESETS[t as ToneType].cutoff,
              tilt: TONE_PRESETS[t as ToneType].tilt,
            })
          }
          bypass={state.tone.bypass}
          onBypass={() => patch("tone", { bypass: !state.tone.bypass })}
          sliders={[
            {
              label: "cutoff",
              value: state.tone.cutoff,
              min: 200,
              max: 8000,
              step: 10,
              display: (v) => `${(v / 1000).toFixed(1)}k`,
              onChange: (v) => patch("tone", { cutoff: v }),
            },
            {
              label: "tilt",
              value: state.tone.tilt,
              min: -8,
              max: 8,
              step: 0.1,
              display: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`,
              onChange: (v) => patch("tone", { tilt: v }),
            },
          ]}
        />
      </div>
    </div>
  );
}

type SliderSpec = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: (v: number) => string;
  onChange: (v: number) => void;
};

function FxChannel({
  title,
  types,
  activeType,
  onType,
  bypass,
  onBypass,
  sliders,
}: {
  title: string;
  types: string[];
  activeType: string;
  onType: (t: string) => void;
  bypass: boolean;
  onBypass: () => void;
  sliders: SliderSpec[];
}) {
  return (
    <div className={"flex flex-col px-4 py-4 gap-3 " + (bypass ? "opacity-50" : "opacity-100")}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] tracking-[0.22em] uppercase text-white/70">{title}</div>
        <button
          onClick={onBypass}
          title={bypass ? "enable" : "bypass"}
          className="h-2 w-2 rounded-full transition-colors"
          style={{
            background: bypass ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.85)",
            boxShadow: bypass ? "none" : "0 0 8px rgba(255,255,255,0.4)",
          }}
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => onType(t)}
            className={
              "px-1.5 py-0.5 rounded-sm text-[9.5px] tracking-[0.14em] uppercase transition-colors " +
              (t === activeType
                ? "bg-white/15 text-white"
                : "bg-white/5 text-white/55 hover:text-white hover:bg-white/10")
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 mt-1">
        {sliders.map((s) => (
          <div key={s.label} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[9px] tracking-[0.18em] uppercase text-white/40">
              <span>{s.label}</span>
              <span className="tabular-nums text-white/70">{s.display(s.value)}</span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={s.value}
              onChange={(e) => s.onChange(parseFloat(e.target.value))}
              className="pr-hairline-slider w-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
/* ============================================================
 * Packs Drawer — sound preset picker (expands upward from dock)
 * ============================================================ */

function PacksDrawer({
  open,
  packs,
  selected,
  onSelect,
  onAudition,
}: {
  open: boolean;
  packs: RuntimePack[];
  selected: string;
  onSelect: (id: string) => void;
  onAudition: (pack: RuntimePack, slotIndex: number) => void;
}) {
  return (
    <div
      data-state={open ? "open" : "closed"}
      className="fx-drawer absolute left-1/2 bottom-[88px] rounded-2xl border border-white/10 backdrop-blur-xl bg-neutral-950/40 pr-mono"
      style={{
        width: "min(720px, calc(100vw - 48px))",
        boxShadow:
          "0 24px 70px rgba(0,0,0,0.65), inset 0 1px 0 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.03)",
        zIndex: 4,
      }}
    >
      <div className="px-5 pt-4 pb-2 flex items-baseline justify-between">
        <div className="text-[10px] tracking-[0.22em] uppercase text-white/70">sound packs</div>
        <div className="text-[9px] tracking-[0.18em] uppercase text-white/35">
          ring index → voice · hover to audition
        </div>
      </div>
      <div className="pr-stagger px-3 pb-4 grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
        {packs.map((pack) => {
          const active = pack.id === selected;
          const slotNames: { name: string; idx: number }[] =
            pack.kind === "builtin"
              ? pack.pack.voices.map((v, i) => ({ name: v.name, idx: i }))
              : pack.slots.map((s, i) => ({ name: s?.label ?? (s ? "Sample" : "—"), idx: i }));
          return (
            <button
              key={pack.id}
              onClick={() => onSelect(pack.id)}
              className={
                "text-left rounded-xl px-3 py-3 transition-all border " +
                (active
                  ? "border-white/30 bg-white/[0.06]"
                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]")
              }
              style={{
                boxShadow: active
                  ? "inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 24px rgba(255,255,255,0.04)"
                  : "none",
              }}
            >
              <div className="flex items-center justify-between mb-0.5">
                <div className="text-[12px] tracking-[0.22em] text-white/90">{pack.name}</div>
                <div className="flex items-center gap-1.5">
                  {pack.kind === "custom" && (
                    <span className="text-[8px] tracking-[0.22em] uppercase text-white/40">
                      user
                    </span>
                  )}
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.18)",
                      boxShadow: active ? "0 0 8px rgba(255,255,255,0.5)" : "none",
                    }}
                  />
                </div>
              </div>
              <div className="text-[10px] text-white/45 mb-2.5">{pack.blurb}</div>
              <div className="grid grid-cols-2 gap-1">
                {slotNames.map(({ name, idx }) => (
                  <div
                    key={idx}
                    onMouseEnter={(e) => {
                      e.stopPropagation();
                      onAudition(pack, idx);
                    }}
                    className="text-[9.5px] tracking-[0.08em] uppercase px-1.5 py-1 rounded-sm text-white/55 bg-white/[0.03] hover:bg-white/[0.09] hover:text-white/90 cursor-pointer truncate"
                    title={name}
                  >
                    <span className="text-white/30 mr-1 tabular-nums">{idx + 1}</span>
                    {name}
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
 * About Drawer — project info window
 * ============================================================ */

function AboutDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sections: { label: string; body: string }[] = [
    {
      label: "concept",
      body: "Phase is a generative polyrhythmic instrument. Concentric rings rotate at independent rates; whenever a ring crosses a radial line, a note sounds. Compositions emerge from the slow drift of mathematics into and out of phase.",
    },
    {
      label: "engine",
      body: "All sound is synthesised live in the browser through the Web Audio API — additive partials, FM operators and filtered noise routed through reverb, chorus, grain and tone. No samples. No network. Just numbers becoming air.",
    },
    {
      label: "interaction",
      body: "Click the canvas to add rings and lines. Hover any ring to inspect its period. Use the dock to load a sound pack, sculpt the FX chain or set the project tempo. Hold space to pause time.",
    },
    {
      label: "credits",
      body: "Designed and engineered as a study in ambient interfaces. Typography in JetBrains Mono. Colour space in OKLCH. Built with TanStack Start.",
    },
  ];
  return (
    <div
      data-state={open ? "open" : "closed"}
      className="fx-drawer absolute left-1/2 bottom-[88px] rounded-2xl border border-white/10 backdrop-blur-xl bg-neutral-950/40 pr-mono"
      style={{
        width: "min(560px, calc(100vw - 48px))",
        boxShadow:
          "0 24px 70px rgba(0,0,0,0.65), inset 0 1px 0 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.03)",
        zIndex: 4,
      }}
    >
      <div className="px-5 pt-4 pb-3 flex items-baseline justify-between border-b border-white/[0.06]">
        <div className="text-[10px] tracking-[0.22em] uppercase text-white/70">about · phase</div>
        <button
          onClick={onClose}
          className="text-[9px] tracking-[0.22em] uppercase text-white/40 hover:text-white/90 transition-colors"
          aria-label="close"
        >
          close
        </button>
      </div>
      <div className="pr-stagger px-5 py-4 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
        {sections.map((s) => (
          <div key={s.label} className="flex flex-col gap-1.5">
            <div className="text-[9px] tracking-[0.22em] uppercase text-white/40">{s.label}</div>
            <p className="text-[11.5px] leading-[1.65] text-white/75">{s.body}</p>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
          <span className="text-[9px] tracking-[0.22em] uppercase text-white/35">v 0.4 · 2026</span>
          <span className="text-[9px] tracking-[0.22em] uppercase text-white/35">
            © phase, inc.
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Visuals Drawer — neural noise background controls
 * ============================================================ */

function VisualsDrawer({ open }: { open: boolean }) {
  const [s, setS] = useState<NeuralSettings>(() => loadNeuralSettings());
  useEffect(() => subscribeNeuralSettings(setS), []);
  const update = (patch: Partial<NeuralSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveNeuralSettings(next);
  };
  // swatch preview color
  const swatch = (c: [number, number, number]) =>
    `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;

  return (
    <div
      data-state={open ? "open" : "closed"}
      className="fx-drawer absolute left-1/2 bottom-[88px] rounded-2xl border border-white/10 backdrop-blur-xl bg-neutral-950/40 pr-mono"
      style={{
        width: "min(640px, calc(100vw - 48px))",
        height: 260,
        boxShadow:
          "0 24px 70px rgba(0,0,0,0.65), inset 0 1px 0 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.03)",
        zIndex: 4,
      }}
    >
      <div className="pr-stagger h-full grid grid-cols-2 divide-x divide-white/[0.07]">
        {/* Presets */}
        <div className="flex flex-col px-5 py-4 gap-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] tracking-[0.22em] uppercase text-white/70">palette</div>
            <div className="text-[9px] tracking-[0.18em] uppercase text-white/35">
              {s.opacity > 0 ? "live" : "off"}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 flex-1 overflow-auto">
            {NEURAL_PRESETS.map((p) => {
              const active = p.id === s.presetId;
              return (
                <button
                  key={p.id}
                  onClick={() => update({ presetId: p.id })}
                  className={
                    "flex items-center gap-2 px-2.5 py-2 rounded-sm text-left transition-colors " +
                    (active
                      ? "bg-white/15 text-white"
                      : "bg-white/[0.04] text-white/65 hover:bg-white/10 hover:text-white")
                  }
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full shrink-0"
                    style={{
                      background: p.colorB
                        ? `linear-gradient(135deg, ${swatch(p.color)}, ${swatch(p.colorB)})`
                        : swatch(p.color),
                      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)",
                    }}
                  />
                  <span className="text-[10px] tracking-[0.16em] uppercase">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sliders */}
        <div className="flex flex-col px-5 py-4 gap-4">
          <div className="text-[10px] tracking-[0.22em] uppercase text-white/70">field</div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[9px] tracking-[0.18em] uppercase text-white/40">
              <span>opacity</span>
              <span className="tabular-nums text-white/70">{Math.round(s.opacity * 100)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={0.6}
              step={0.01}
              value={s.opacity}
              onChange={(e) => update({ opacity: parseFloat(e.target.value) })}
              className="pr-hairline-slider w-full"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[9px] tracking-[0.18em] uppercase text-white/40">
              <span>speed</span>
              <span className="tabular-nums text-white/70">{s.speed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.01}
              value={s.speed}
              onChange={(e) => update({ speed: parseFloat(e.target.value) })}
              className="pr-hairline-slider w-full"
            />
          </div>

          <p className="text-[10px] leading-[1.55] text-white/40 mt-1">
            Subtle WebGL field that breathes behind everything. Cursor brightens it locally; every
            triggered note blooms a quiet flash at its position.
          </p>
        </div>
      </div>
    </div>
  );
}
