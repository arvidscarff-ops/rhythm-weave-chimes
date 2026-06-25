// Tiny pub/sub for "note triggered" flashes the NeuralNoise background reacts to.
// Position is in normalized viewport coordinates (0..1, top-left origin).

export type NeuralFlash = {
  x: number;
  y: number;
  intensity: number; // 0..1
  t: number;         // performance.now() at emission
};

type Listener = (f: NeuralFlash) => void;

const listeners = new Set<Listener>();

export const flashBus = {
  subscribe(cb: Listener) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  flash(x: number, y: number, intensity = 0.7) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const f: NeuralFlash = {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      intensity: Math.max(0, Math.min(1, intensity)),
      t: typeof performance !== "undefined" ? performance.now() : 0,
    };
    listeners.forEach((cb) => cb(f));
  },
};