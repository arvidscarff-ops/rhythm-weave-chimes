import type { SceneKind } from "@/routes/index.tsx";
import type { FxState, ReverbType, ChorusType, GrainType, ToneType } from "@/lib/fx/fxState";
import type { NeuralSettings } from "@/lib/neural/palette";
import type { ComposerSettings, SlotSettings } from "@/lib/music/composer";
import type { RootName, ScaleId } from "@/lib/music/scales";
import type {
  WheelState,
  WheelRing,
  WheelLine,
  WheelNote,
  PendulumState,
  PendulumBob,
  BarsState,
  BarLane,
} from "@/routes/index.tsx";

export type SessionState = {
  v: 1;
  s: SceneKind;
  bpm: number;
  knobs: {
    mv: number; // mainVol
    p: number; // pitch
    rm: number; // revMix
    rs: number; // revSize
    sp: number; // speed
    mu: number; // multiply
    f1: number; // fx1
    f2: number; // fx2
  };
  fx: {
    r: { t: ReverbType; m: number; s: number; b: boolean };
    c: { t: ChorusType; m: number; r: number; b: boolean };
    g: { t: GrainType; m: number; d: number; b: boolean };
    t: { t: ToneType; c: number; ti: number; b: boolean };
  };
  pack: string;
  neural: { p: string; o: number; s: number };
  composer: { e: boolean; r: RootName; sc: ScaleId; slots: SlotSettings[] };
  wheel: {
    rings: {
      rf: number;
      b: number;
      sd: number;
      d: 1 | -1;
      vs: "melo" | "bass" | "atmo";
      n: [angle: number, pi: number][];
    }[];
    lines: { a: number }[];
  };
  pendulum: { bobs: [ratioIndex: number, slotIndex: number, pitchIndex: number, phase: number][] };
  bars: { lanes: [ratioIndex: number, slotIndex: number, pitchIndex: number, phase: number][] };
};

const VOICE_SLOT_ORDER: ("melo" | "bass" | "atmo")[] = ["melo", "bass", "atmo"];

function encodeBase64(str: string): string {
  try {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return "";
  }
}

function decodeBase64(input: string): string | null {
  try {
    const base64 =
      input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
    return atob(base64);
  } catch {
    return null;
  }
}

export function encodeSession(state: SessionState): string {
  return encodeBase64(JSON.stringify(state));
}

export function decodeSession(hash: string): SessionState | null {
  const raw = decodeBase64(hash);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionState;
    if (parsed.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildShareUrl(state: SessionState): string {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.hash = `#s=${encodeSession(state)}`;
  return url.toString();
}

export async function copyShareUrl(state: SessionState): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const url = buildShareUrl(state);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

export function knobsToSession(knobs: {
  mainVol: number;
  pitch: number;
  revMix: number;
  revSize: number;
  speed: number;
  multiply: number;
  fx1: number;
  fx2: number;
}): SessionState["knobs"] {
  return {
    mv: knobs.mainVol,
    p: knobs.pitch,
    rm: knobs.revMix,
    rs: knobs.revSize,
    sp: knobs.speed,
    mu: knobs.multiply,
    f1: knobs.fx1,
    f2: knobs.fx2,
  };
}

export function knobsFromSession(k: SessionState["knobs"]) {
  return {
    mainVol: k.mv,
    pitch: k.p,
    revMix: k.rm,
    revSize: k.rs,
    speed: k.sp,
    multiply: k.mu,
    fx1: k.f1,
    fx2: k.f2,
  };
}

export function fxToSession(fx: FxState): SessionState["fx"] {
  return {
    r: { t: fx.reverb.type, m: fx.reverb.mix, s: fx.reverb.size, b: fx.reverb.bypass },
    c: { t: fx.chorus.type, m: fx.chorus.mix, r: fx.chorus.rate, b: fx.chorus.bypass },
    g: { t: fx.grain.type, m: fx.grain.mix, d: fx.grain.density, b: fx.grain.bypass },
    t: { t: fx.tone.type, c: fx.tone.cutoff, ti: fx.tone.tilt, b: fx.tone.bypass },
  };
}

export function fxFromSession(f: SessionState["fx"]): FxState {
  return {
    reverb: { type: f.r.t, mix: f.r.m, size: f.r.s, bypass: f.r.b },
    chorus: { type: f.c.t, mix: f.c.m, rate: f.c.r, bypass: f.c.b },
    grain: { type: f.g.t, mix: f.g.m, density: f.g.d, bypass: f.g.b },
    tone: { type: f.t.t, cutoff: f.t.c, tilt: f.t.ti, bypass: f.t.b },
  };
}

export function neuralToSession(n: NeuralSettings): SessionState["neural"] {
  return { p: n.presetId, o: n.opacity, s: n.speed };
}

export function neuralFromSession(n: SessionState["neural"]): NeuralSettings {
  return { presetId: n.p, opacity: n.o, speed: n.s };
}

export function composerToSession(c: ComposerSettings): SessionState["composer"] {
  return { e: c.enabled, r: c.root, sc: c.scale, slots: c.slots };
}

export function composerFromSession(c: SessionState["composer"]): ComposerSettings {
  return { enabled: c.e, root: c.r, scale: c.sc, slots: c.slots };
}

export function wheelToSession(w: WheelState): SessionState["wheel"] {
  return {
    rings: w.rings.map((r: WheelRing) => ({
      rf: r.radiusFactor,
      b: r.beats,
      sd: r.subdivision,
      d: r.direction,
      vs: r.voiceSlot,
      n: r.notes.map((n: WheelNote) => [n.angle, n.pitchIndex] as [number, number]),
    })),
    lines: w.lines.map((l: WheelLine) => ({ a: l.angle })),
  };
}

export function wheelFromSession(w: SessionState["wheel"]): WheelState {
  let idCounter = 0;
  const uid = (p = "id") => `${p}_${++idCounter}`;
  return {
    rings: w.rings.map((r) => {
      return {
        id: uid("ring"),
        radiusFactor: r.rf,
        beats: r.b,
        subdivision: r.sd,
        direction: r.d,
        phase: 0,
        voiceSlot: r.vs,
        flash: 0,
        notes: r.n.map((n: [number, number]) => ({
          id: uid("n"),
          angle: n[0],
          pitchIndex: n[1],
          prevWorld: n[0],
          flash: 0,
        })) as WheelNote[],
      } as WheelRing;
    }),
    lines: w.lines.map(
      (l) =>
        ({
          id: uid("ln"),
          angle: l.a,
          flash: 0,
          sparks: [],
        }) as WheelLine,
    ),
    lastFire: new Map(),
  };
}

export function pendulumToSession(p: PendulumState): SessionState["pendulum"] {
  return {
    bobs: p.bobs.map(
      (b: PendulumBob) =>
        [b.ratioIndex, b.slotIndex, b.pitchIndex, b.phase] as [number, number, number, number],
    ),
  };
}

export function pendulumFromSession(p: SessionState["pendulum"]): PendulumState {
  let idCounter = 0;
  return {
    bobs: p.bobs.map(
      (b) =>
        ({
          id: `p_${++idCounter}`,
          ratioIndex: b[0],
          slotIndex: b[1],
          pitchIndex: b[2],
          phase: b[3],
          prevSign: 1,
          flash: 0,
        }) as PendulumBob,
    ),
  };
}

export function barsToSession(b: BarsState): SessionState["bars"] {
  return {
    lanes: b.lanes.map(
      (l: BarLane) =>
        [l.ratioIndex, l.slotIndex, l.pitchIndex, l.phase] as [number, number, number, number],
    ),
  };
}

export function barsFromSession(b: SessionState["bars"]): BarsState {
  let idCounter = 0;
  return {
    lanes: b.lanes.map(
      (l) =>
        ({
          id: `b_${++idCounter}`,
          ratioIndex: l[0],
          slotIndex: l[1],
          pitchIndex: l[2],
          phase: l[3],
          flash: 0,
          lastTriggerY: 1,
        }) as BarLane,
    ),
  };
}
