/**
 * Access boundary between production Trigger Engines and historical rhythm
 * experiments. Legacy engines are intentionally reachable only from their
 * development quarantine and must never be used as production templates.
 */
export const LEGACY_RHYTHM_SCENE_IDS = ["wheel", "pendulum", "bars"] as const;

export const PRODUCTION_RHYTHM_SCENE_IDS = [
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
] as const;

export type LegacyRhythmSceneId = (typeof LEGACY_RHYTHM_SCENE_IDS)[number];
export type ProductionRhythmSceneId = (typeof PRODUCTION_RHYTHM_SCENE_IDS)[number];
export type RhythmSceneId = LegacyRhythmSceneId | ProductionRhythmSceneId;
export type RhythmSceneAccess = "production" | "legacy";

export const DEFAULT_PRODUCTION_RHYTHM_SCENE: ProductionRhythmSceneId = "stringNet";
export const DEFAULT_LEGACY_RHYTHM_SCENE: LegacyRhythmSceneId = "wheel";

const LEGACY_SCENE_SET = new Set<string>(LEGACY_RHYTHM_SCENE_IDS);
const PRODUCTION_SCENE_SET = new Set<string>(PRODUCTION_RHYTHM_SCENE_IDS);

export function isLegacyRhythmSceneId(scene: string): scene is LegacyRhythmSceneId {
  return LEGACY_SCENE_SET.has(scene);
}

export function isProductionRhythmSceneId(scene: string): scene is ProductionRhythmSceneId {
  return PRODUCTION_SCENE_SET.has(scene);
}

export function isRhythmSceneAllowed(scene: string, access: RhythmSceneAccess): boolean {
  return access === "legacy" ? isLegacyRhythmSceneId(scene) : isProductionRhythmSceneId(scene);
}

/**
 * Resolve all scene-entry paths—including restored links and Studio audition
 * handoffs—through one explicit quarantine boundary.
 */
export function resolveRhythmSceneAccess(scene: string, access: RhythmSceneAccess): RhythmSceneId {
  if (isRhythmSceneAllowed(scene, access)) return scene as RhythmSceneId;
  return access === "legacy" ? DEFAULT_LEGACY_RHYTHM_SCENE : DEFAULT_PRODUCTION_RHYTHM_SCENE;
}
