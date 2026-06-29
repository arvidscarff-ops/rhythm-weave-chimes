// Tiny pub/sub for "note triggered" flashes the NeuralNoise background reacts to.
// Position is in normalized viewport coordinates (0..1, top-left origin).

export type NeuralFlash = {
  x: number;
  y: number;
  intensity: number; // 0..1
  t: number;         // performance.now() at emission
  /** Optional 0..1 note hue so subscribers can match the played note's color. */
  hue?: number;
};

type Listener = (f: NeuralFlash) => void;

const listeners = new Set<Listener>();

/**
 * Big Bang coalescing window. When many notes fire within COALESCE_MS,
 * we emit ONE combined flash (centroid position, capped intensity) instead
 * of N stacking ones — keeps individual triggers lively but prevents the
 * full-screen white bloom during synchronous chords.
 */
const COALESCE_MS = 60;
let coalesce: {
  timer: ReturnType<typeof setTimeout> | null;
  sumX: number;
  sumY: number;
  sumI: number;
  hue: number | undefined;
  count: number;
} | null = null;

function emit(f: NeuralFlash) {
  listeners.forEach((cb) => cb(f));
}

function flushCoalesce() {
  if (!coalesce || coalesce.count === 0) {
    coalesce = null;
    return;
  }
  const c = coalesce;
  coalesce = null;
  const x = c.sumX / c.count;
  const y = c.sumY / c.count;
  // Damped intensity: 1 trigger ≈ base; many triggers ≈ asymptote near 0.45.
  const base = c.sumI / c.count;
  const intensity = Math.min(0.5, base * (1 / Math.sqrt(c.count)) + 0.04 * Math.log2(1 + c.count));
  emit({
    x,
    y,
    intensity,
    t: typeof performance !== "undefined" ? performance.now() : 0,
    hue: c.hue,
  });
}

export const flashBus = {
  subscribe(cb: Listener) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  flash(x: number, y: number, intensity = 0.7, hue?: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const cx = Math.max(0, Math.min(1, x));
    const cy = Math.max(0, Math.min(1, y));
    const ci = Math.max(0, Math.min(1, intensity));
    const ch = typeof hue === "number" && Number.isFinite(hue) ? ((hue % 1) + 1) % 1 : undefined;
    if (!coalesce) {
      coalesce = { timer: null, sumX: cx, sumY: cy, sumI: ci, hue: ch, count: 1 };
      coalesce.timer = setTimeout(flushCoalesce, COALESCE_MS);
    } else {
      coalesce.sumX += cx;
      coalesce.sumY += cy;
      coalesce.sumI += ci;
      coalesce.count += 1;
      if (ch !== undefined && coalesce.hue === undefined) coalesce.hue = ch;
    }
  },
};