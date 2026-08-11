import type { CrossingPhaseThresholds } from "../crossing/crossingRuntime";
import type { TransmissionRuntimeConfig } from "../transmissions/transmissionRuntime";
import type { FirstCrossingCoordinatorConfig } from "./firstCrossingCoordinator";
import type { ResolvedFirstCrossingBinding } from "./firstCrossingBinding";

export type FirstCrossingRuntimePolicy = Readonly<{
  thresholds: CrossingPhaseThresholds;
  transmissions: Omit<TransmissionRuntimeConfig, "runId" | "routeDefinitionId">;
}>;

/**
 * Adapt an authored, resolved binding into one fresh runtime configuration.
 * Runtime identity and lifecycle policy stay caller-owned and never enter the
 * reusable binding or the coordinator's persisted authored state.
 */
export function coordinatorConfigFromFirstCrossingBinding(
  binding: ResolvedFirstCrossingBinding,
  runId: string,
  runtime: FirstCrossingRuntimePolicy,
): FirstCrossingCoordinatorConfig {
  if (typeof runId !== "string" || runId.trim().length === 0) {
    throw new Error("First Crossing runtime runId must be a non-empty string.");
  }

  const transmissionReference = binding.transmissionSet;
  if (transmissionReference) {
    if (runtime.transmissions.definitionSetId !== transmissionReference.id) {
      throw new Error(
        `Transmission runtime set ${runtime.transmissions.definitionSetId} does not match binding reference ${transmissionReference.id}.`,
      );
    }
  } else if (runtime.transmissions.definitions.length > 0) {
    throw new Error("A binding without a transmission set cannot inject transmission content.");
  }

  return Object.freeze({
    runId,
    routeDefinitionId: binding.route.definition.id,
    durationSeconds: binding.route.definition.defaultDurationSeconds,
    thresholds: Object.freeze({ ...runtime.thresholds }),
    transmissions: Object.freeze({
      definitionSetId: runtime.transmissions.definitionSetId,
      seed: runtime.transmissions.seed,
      definitions: Object.freeze(
        runtime.transmissions.definitions.map((definition) => Object.freeze({ ...definition })),
      ),
      admissionChance: runtime.transmissions.admissionChance,
      minGapSeconds: runtime.transmissions.minGapSeconds,
    }),
  });
}
