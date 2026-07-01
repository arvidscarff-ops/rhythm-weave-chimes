export type Humanization = {
  velocityPct: number; // 0..1 (fraction, so 0.1 = ±10%)
  cutoffHz: [number, number] | null; // null = no filter
  detuneCents: number; // ± cents
  panPct: number; // 0..1 (fraction of ±1 pan)
};

export const DEFAULT_HUMANIZATION: Humanization = {
  velocityPct: 0,
  cutoffHz: null,
  detuneCents: 0,
  panPct: 0,
};

export function parseHumanization(v: unknown): Humanization | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const h: Humanization = { ...DEFAULT_HUMANIZATION };
  if (typeof o.velocityPct === "number") h.velocityPct = clamp01(o.velocityPct);
  if (typeof o.detuneCents === "number") h.detuneCents = clampNum(o.detuneCents, 0, 200);
  if (typeof o.panPct === "number") h.panPct = clamp01(o.panPct);
  if (Array.isArray(o.cutoffHz) && o.cutoffHz.length === 2) {
    const [a, b] = o.cutoffHz as [unknown, unknown];
    if (typeof a === "number" && typeof b === "number") {
      h.cutoffHz = [Math.min(a, b), Math.max(a, b)];
    }
  }
  return h;
}

export function resolveHumanization(
  pack: Humanization | null,
  slot: Humanization | null,
): Humanization {
  const base = pack ?? DEFAULT_HUMANIZATION;
  if (!slot) return base;
  return {
    velocityPct: slot.velocityPct ?? base.velocityPct,
    cutoffHz: slot.cutoffHz ?? base.cutoffHz,
    detuneCents: slot.detuneCents ?? base.detuneCents,
    panPct: slot.panPct ?? base.panPct,
  };
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
function clampNum(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}