import {
  hydrateFirstCrossingCoordinator,
  type FirstCrossingCoordinator,
  type FirstCrossingCoordinatorDependencies,
  type FirstCrossingCoordinatorSnapshotV1,
} from "./firstCrossingCoordinator";
import type { ResolvedFirstCrossingBinding } from "./firstCrossingBinding";

export const FIRST_CROSSING_RUN_SNAPSHOT_VERSION = 1 as const;

export type FirstCrossingBindingReference = Readonly<{
  id: string;
  revision: number;
}>;

export type FirstCrossingRunSnapshotV1 = Readonly<{
  schemaVersion: typeof FIRST_CROSSING_RUN_SNAPSHOT_VERSION;
  bindingRef: FirstCrossingBindingReference;
  runId: string;
  coordinatorSnapshot: FirstCrossingCoordinatorSnapshotV1;
}>;

export type FirstCrossingBindingResolver = (
  reference: FirstCrossingBindingReference,
) => ResolvedFirstCrossingBinding | undefined;

export type HydratedFirstCrossingRun = Readonly<{
  binding: ResolvedFirstCrossingBinding;
  coordinator: FirstCrossingCoordinator;
  snapshot: FirstCrossingRunSnapshotV1;
}>;

function bindingReference(binding: ResolvedFirstCrossingBinding): FirstCrossingBindingReference {
  return Object.freeze({
    id: binding.authored.id,
    revision: binding.authored.revision,
  });
}

function assertRunMatchesBinding(
  binding: ResolvedFirstCrossingBinding,
  runId: string,
  coordinatorSnapshot: FirstCrossingCoordinatorSnapshotV1,
): void {
  if (coordinatorSnapshot.identity.runId !== runId) {
    throw new Error("First Crossing runId does not match its coordinator snapshot.");
  }
  if (coordinatorSnapshot.identity.routeDefinitionId !== binding.route.definition.id) {
    throw new Error("First Crossing run route does not match its resolved binding revision.");
  }
}

/**
 * Persist only runtime identity/state plus the exact authored binding pointer.
 * Composition, sound, environment, and transmission choices are resolved from
 * that immutable binding revision rather than copied into mutable run state.
 */
export function createFirstCrossingRunSnapshot(
  binding: ResolvedFirstCrossingBinding,
  coordinatorSnapshot: FirstCrossingCoordinatorSnapshotV1,
): FirstCrossingRunSnapshotV1 {
  const runId = coordinatorSnapshot.identity.runId;
  assertRunMatchesBinding(binding, runId, coordinatorSnapshot);
  return Object.freeze({
    schemaVersion: FIRST_CROSSING_RUN_SNAPSHOT_VERSION,
    bindingRef: bindingReference(binding),
    runId,
    coordinatorSnapshot,
  });
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`First Crossing run ${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

export function hydrateFirstCrossingRun(
  input: unknown,
  resolveBinding: FirstCrossingBindingResolver,
  dependencies: FirstCrossingCoordinatorDependencies = {},
): HydratedFirstCrossingRun {
  const root = asRecord(input, "snapshot");
  if (root.schemaVersion !== FIRST_CROSSING_RUN_SNAPSHOT_VERSION) {
    throw new Error(
      `Unsupported First Crossing run snapshot version: ${String(root.schemaVersion)}.`,
    );
  }
  if (typeof root.runId !== "string" || root.runId.trim().length === 0) {
    throw new Error("First Crossing runId must be a non-empty string.");
  }
  const rawReference = asRecord(root.bindingRef, "bindingRef");
  if (
    typeof rawReference.id !== "string" ||
    rawReference.id.trim().length === 0 ||
    !Number.isSafeInteger(rawReference.revision) ||
    (rawReference.revision as number) < 1
  ) {
    throw new Error("First Crossing run bindingRef must identify an exact binding revision.");
  }
  const reference = Object.freeze({
    id: rawReference.id,
    revision: rawReference.revision as number,
  });
  const binding = resolveBinding(reference);
  if (
    !binding ||
    binding.authored.id !== reference.id ||
    binding.authored.revision !== reference.revision
  ) {
    throw new Error(`First Crossing binding ${reference.id}@${reference.revision} is unavailable.`);
  }

  const coordinator = hydrateFirstCrossingCoordinator(root.coordinatorSnapshot, dependencies);
  const coordinatorSnapshot = coordinator.snapshot();
  assertRunMatchesBinding(binding, root.runId, coordinatorSnapshot);
  const snapshot = createFirstCrossingRunSnapshot(binding, coordinatorSnapshot);
  return Object.freeze({ binding, coordinator, snapshot });
}
