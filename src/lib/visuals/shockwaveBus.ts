// Emits expanding dot-ring shockwaves at note trigger sites.
// Coordinates are normalized 0..1 inside the scene canvas (same frame as flashBus).

export type Shockwave = {
  x: number;
  y: number;
  hue: number;     // 0..1 ring index hint, used for subtle tint
  intensity: number;
  born: number;    // performance.now()
};

type Listener = (s: Shockwave) => void;

const listeners = new Set<Listener>();

export const shockwaveBus = {
  subscribe(cb: Listener) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  emit(x: number, y: number, opts: { hue?: number; intensity?: number } = {}) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const s: Shockwave = {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      hue: Math.max(0, Math.min(1, opts.hue ?? 0)),
      intensity: Math.max(0, Math.min(1, opts.intensity ?? 0.8)),
      born: typeof performance !== "undefined" ? performance.now() : 0,
    };
    listeners.forEach((cb) => cb(s));
  },
};