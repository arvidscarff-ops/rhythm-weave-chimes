import { FIRST_CROSSING_ROUTE } from "../crossing/routes";
import { FALLBACK_SCALE_ID } from "../music/scaleIds";
import { PACK_IDS, type PackId } from "../sound/packIds";
import {
  defineFirstCrossingBinding,
  resolveFirstCrossingBinding,
  type FirstCrossingBindingResolvers,
  type FirstCrossingContentReference,
  type FirstCrossingReferenceKind,
  type ResolvedFirstCrossingBinding,
  type ResolvedFirstCrossingContentReference,
} from "./firstCrossingBinding";

export const PROVISIONAL_FIRST_CROSSING_ENVIRONMENT_ID =
  "first-crossing-extreme-altitude-clouds" as const;
export const PROVISIONAL_FIRST_CROSSING_TRANSMISSION_SET_ID =
  "journey-lab-transmissions-v1" as const;

function descriptor(
  kind: Exclude<FirstCrossingReferenceKind, "trigger-engine-presentation">,
  reference: FirstCrossingContentReference,
  source: ResolvedFirstCrossingContentReference["source"],
): ResolvedFirstCrossingContentReference {
  return Object.freeze({ kind, id: reference.id, revision: reference.revision, source });
}

/**
 * Small, explicit proof catalog. Development entries can resolve only when the
 * binding marks them provisional; this is not a new mutable content registry.
 */
export const PROVISIONAL_FIRST_CROSSING_RESOLVERS: FirstCrossingBindingResolvers = Object.freeze({
  resolveRouteDefinition(id) {
    if (id !== FIRST_CROSSING_ROUTE.id) return undefined;
    return Object.freeze({ definition: FIRST_CROSSING_ROUTE, source: "development" as const });
  },
  resolveTriggerEnginePresentation(reference) {
    if (reference.id !== "phaseAlignRings" || reference.revision !== 1) return undefined;
    return Object.freeze({
      kind: "trigger-engine-presentation" as const,
      id: reference.id,
      revision: reference.revision,
      source: "production" as const,
      compatibleCompositionEngines: Object.freeze(["phaseAlignRings" as const]),
    });
  },
  resolveContentReference(kind, reference) {
    if (reference.revision !== 1) return undefined;
    if (kind === "sound-pack" && PACK_IDS.includes(reference.id as PackId)) {
      return descriptor(kind, reference, "production");
    }
    if (kind === "scale" && reference.id === FALLBACK_SCALE_ID) {
      return descriptor(kind, reference, "development");
    }
    if (
      kind === "environment-preset" &&
      reference.id === PROVISIONAL_FIRST_CROSSING_ENVIRONMENT_ID
    ) {
      return descriptor(kind, reference, "development");
    }
    if (
      kind === "transmission-set" &&
      reference.id === PROVISIONAL_FIRST_CROSSING_TRANSMISSION_SET_ID
    ) {
      return descriptor(kind, reference, "development");
    }
    return undefined;
  },
});

export const PROVISIONAL_FIRST_CROSSING_BINDING = defineFirstCrossingBinding({
  schemaVersion: 1,
  id: "first-crossing-development-proof",
  revision: 1,
  label: "First Crossing development proof",
  status: "provisional",
  routeDefinitionId: FIRST_CROSSING_ROUTE.id,
  composition: {
    compositionId: "first-crossing:phase-align-rings",
    revision: 1,
    engineId: "phaseAlignRings",
    macroCycleDuration: 30,
    baseLaps: 10,
    density: 5,
    noteCount: 8,
  },
  triggerEnginePresentation: {
    id: "phaseAlignRings",
    revision: 1,
    status: "provisional",
  },
  sound: {
    pack: { id: "moss", revision: 1, status: "provisional" },
    scale: { id: FALLBACK_SCALE_ID, revision: 1, status: "provisional" },
  },
  environment: {
    id: PROVISIONAL_FIRST_CROSSING_ENVIRONMENT_ID,
    revision: 1,
    status: "provisional",
  },
  transmissionSet: {
    id: PROVISIONAL_FIRST_CROSSING_TRANSMISSION_SET_ID,
    revision: 1,
    status: "provisional",
  },
});

export function resolveProvisionalFirstCrossingBinding(): ResolvedFirstCrossingBinding {
  return resolveFirstCrossingBinding(
    PROVISIONAL_FIRST_CROSSING_BINDING,
    PROVISIONAL_FIRST_CROSSING_RESOLVERS,
  );
}
