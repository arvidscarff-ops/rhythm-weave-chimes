import type { CrossingRoute } from "../crossing/routes";
import {
  createProductionCompositionSnapshot,
  isProductionPhaseAlignedEngineId,
  type ProductionCompositionInput,
  type ProductionPhaseAlignedEngineId,
} from "../rhythm/productionComposition";
import type { CompositionSnapshot } from "../rhythm/compositionSnapshot";
import { normalizeTransportInput, exactTransportSeconds } from "../rhythm/liveTimelineAdapter";

export const FIRST_CROSSING_BINDING_SCHEMA_VERSION = 1 as const;

export type FirstCrossingSelectionStatus = "accepted" | "provisional";
export type FirstCrossingContentSource = "production" | "development";

export type FirstCrossingContentReference = Readonly<{
  id: string;
  revision: number;
  status: FirstCrossingSelectionStatus;
}>;

export type FirstCrossingBinding = Readonly<{
  schemaVersion: typeof FIRST_CROSSING_BINDING_SCHEMA_VERSION;
  id: string;
  revision: number;
  label: string;
  status: FirstCrossingSelectionStatus;
  routeDefinitionId: string;
  /** Existing production composition constructor input; not a parallel music schema. */
  composition: ProductionCompositionInput;
  triggerEnginePresentation: FirstCrossingContentReference;
  sound: Readonly<{
    pack: FirstCrossingContentReference;
    scale: FirstCrossingContentReference;
  }>;
  environment: FirstCrossingContentReference;
  transmissionSet?: FirstCrossingContentReference;
}>;

export type FirstCrossingReferenceKind =
  | "trigger-engine-presentation"
  | "sound-pack"
  | "scale"
  | "environment-preset"
  | "transmission-set";

export type ResolvedFirstCrossingContentReference = Readonly<{
  kind: FirstCrossingReferenceKind;
  id: string;
  revision: number;
  source: FirstCrossingContentSource;
}>;

export type ResolvedTriggerEnginePresentation = ResolvedFirstCrossingContentReference &
  Readonly<{
    kind: "trigger-engine-presentation";
    compatibleCompositionEngines: readonly ProductionPhaseAlignedEngineId[];
  }>;

export type ResolvedFirstCrossingRoute = Readonly<{
  definition: Readonly<CrossingRoute>;
  source: FirstCrossingContentSource;
}>;

export type FirstCrossingBindingResolvers = Readonly<{
  resolveRouteDefinition(id: string): ResolvedFirstCrossingRoute | undefined;
  resolveTriggerEnginePresentation(
    reference: FirstCrossingContentReference,
  ): ResolvedTriggerEnginePresentation | undefined;
  resolveContentReference(
    kind: Exclude<FirstCrossingReferenceKind, "trigger-engine-presentation">,
    reference: FirstCrossingContentReference,
  ): ResolvedFirstCrossingContentReference | undefined;
}>;

export type ResolvedFirstCrossingBinding = Readonly<{
  authored: FirstCrossingBinding;
  route: ResolvedFirstCrossingRoute;
  compositionSnapshot: CompositionSnapshot;
  triggerEnginePresentation: ResolvedTriggerEnginePresentation;
  sound: Readonly<{
    pack: ResolvedFirstCrossingContentReference;
    scale: ResolvedFirstCrossingContentReference;
  }>;
  environment: ResolvedFirstCrossingContentReference;
  transmissionSet: ResolvedFirstCrossingContentReference | null;
}>;

export type FirstCrossingBindingValidationIssue = Readonly<{
  path: string;
  message: string;
}>;

const ROOT_KEYS = new Set([
  "schemaVersion",
  "id",
  "revision",
  "label",
  "status",
  "routeDefinitionId",
  "composition",
  "triggerEnginePresentation",
  "sound",
  "environment",
  "transmissionSet",
]);
const COMPOSITION_KEYS = new Set([
  "compositionId",
  "revision",
  "engineId",
  "macroCycleDuration",
  "baseLaps",
  "density",
  "noteCount",
]);
const REFERENCE_KEYS = new Set(["id", "revision", "status"]);
const SOUND_KEYS = new Set(["pack", "scale"]);
const EXACT_SECONDS_KEYS = new Set(["secondsNumerator", "secondsDenominator"]);
const ID_PATTERN = /^[A-Za-z0-9_]+(?:[.:-][A-Za-z0-9_]+)*$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function addIssue(
  issues: FirstCrossingBindingValidationIssue[],
  path: string,
  message: string,
): void {
  issues.push(Object.freeze({ path, message }));
}

function validateExactKeys(
  issues: FirstCrossingBindingValidationIssue[],
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key))
      addIssue(issues, `${path}.${key}`, "is not part of the binding contract");
  }
}

function scanForbiddenRuntimeFields(
  issues: FirstCrossingBindingValidationIssue[],
  value: unknown,
  path: string,
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForbiddenRuntimeFields(issues, entry, `${path}[${index}]`));
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  for (const [key, child] of Object.entries(record)) {
    if (key === "runId")
      addIssue(issues, `${path}.${key}`, "runtime run identity cannot enter authored data");
    scanForbiddenRuntimeFields(issues, child, `${path}.${key}`);
  }
}

function validateIdentifier(
  issues: FirstCrossingBindingValidationIssue[],
  value: unknown,
  path: string,
): void {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    addIssue(issues, path, "must be a non-empty stable identifier");
  }
}

function validateRevision(
  issues: FirstCrossingBindingValidationIssue[],
  value: unknown,
  path: string,
): void {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    addIssue(issues, path, "must be a positive safe integer");
  }
}

function validateStatus(
  issues: FirstCrossingBindingValidationIssue[],
  value: unknown,
  path: string,
): void {
  if (value !== "accepted" && value !== "provisional") {
    addIssue(issues, path, "must be accepted or provisional");
  }
}

function validateReference(
  issues: FirstCrossingBindingValidationIssue[],
  value: unknown,
  path: string,
): void {
  const record = asRecord(value);
  if (!record) {
    addIssue(issues, path, "must be an object");
    return;
  }
  validateExactKeys(issues, record, REFERENCE_KEYS, path);
  validateIdentifier(issues, record.id, `${path}.id`);
  validateRevision(issues, record.revision, `${path}.revision`);
  validateStatus(issues, record.status, `${path}.status`);
}

function validateComposition(issues: FirstCrossingBindingValidationIssue[], value: unknown): void {
  const record = asRecord(value);
  if (!record) {
    addIssue(issues, "binding.composition", "must be an object");
    return;
  }
  validateExactKeys(issues, record, COMPOSITION_KEYS, "binding.composition");
  validateIdentifier(issues, record.compositionId, "binding.composition.compositionId");
  if (!Number.isSafeInteger(record.revision) || (record.revision as number) < 0) {
    addIssue(
      issues,
      "binding.composition.revision",
      "must follow the existing non-negative CompositionSnapshot revision contract",
    );
  }
  if (typeof record.engineId !== "string" || !isProductionPhaseAlignedEngineId(record.engineId)) {
    addIssue(
      issues,
      "binding.composition.engineId",
      "must identify a migrated production Phase-Alignment engine",
    );
  }
  if (!Number.isSafeInteger(record.baseLaps) || (record.baseLaps as number) <= 0) {
    addIssue(issues, "binding.composition.baseLaps", "must be a positive safe integer");
  }
  if (
    typeof record.density !== "number" ||
    !Number.isFinite(record.density) ||
    record.density <= 0
  ) {
    addIssue(issues, "binding.composition.density", "must be finite and greater than zero");
  }
  if (!Number.isSafeInteger(record.noteCount) || (record.noteCount as number) <= 0) {
    addIssue(issues, "binding.composition.noteCount", "must be a positive safe integer");
  }
  const duration = record.macroCycleDuration;
  if (typeof duration === "object" && duration !== null && !Array.isArray(duration)) {
    validateExactKeys(
      issues,
      duration as Record<string, unknown>,
      EXACT_SECONDS_KEYS,
      "binding.composition.macroCycleDuration",
    );
  }
  try {
    createProductionCompositionSnapshot(record as unknown as ProductionCompositionInput);
  } catch (error) {
    addIssue(
      issues,
      "binding.composition",
      error instanceof Error ? error.message : "does not resolve to a CompositionSnapshot",
    );
  }
}

export function validateFirstCrossingBinding(
  input: unknown,
): readonly FirstCrossingBindingValidationIssue[] {
  const issues: FirstCrossingBindingValidationIssue[] = [];
  const root = asRecord(input);
  if (!root) {
    return Object.freeze([Object.freeze({ path: "binding", message: "must be an object" })]);
  }
  validateExactKeys(issues, root, ROOT_KEYS, "binding");
  scanForbiddenRuntimeFields(issues, root, "binding");
  if (root.schemaVersion !== FIRST_CROSSING_BINDING_SCHEMA_VERSION) {
    addIssue(issues, "binding.schemaVersion", "is unsupported");
  }
  validateIdentifier(issues, root.id, "binding.id");
  validateRevision(issues, root.revision, "binding.revision");
  if (typeof root.label !== "string" || root.label.trim().length === 0) {
    addIssue(issues, "binding.label", "must be a non-empty authored label");
  }
  validateStatus(issues, root.status, "binding.status");
  validateIdentifier(issues, root.routeDefinitionId, "binding.routeDefinitionId");
  validateComposition(issues, root.composition);
  validateReference(issues, root.triggerEnginePresentation, "binding.triggerEnginePresentation");
  const sound = asRecord(root.sound);
  if (!sound) {
    addIssue(issues, "binding.sound", "must be an object");
  } else {
    validateExactKeys(issues, sound, SOUND_KEYS, "binding.sound");
    validateReference(issues, sound.pack, "binding.sound.pack");
    validateReference(issues, sound.scale, "binding.sound.scale");
  }
  validateReference(issues, root.environment, "binding.environment");
  if (root.transmissionSet !== undefined) {
    validateReference(issues, root.transmissionSet, "binding.transmissionSet");
  }
  return Object.freeze(issues);
}

function assertValidBinding(input: unknown): asserts input is FirstCrossingBinding {
  const issues = validateFirstCrossingBinding(input);
  if (issues.length === 0) return;
  throw new Error(
    `Invalid FirstCrossingBinding: ${issues.map(({ path, message }) => `${path} ${message}`).join("; ")}`,
  );
}

function freezeReference(reference: FirstCrossingContentReference): FirstCrossingContentReference {
  return Object.freeze({
    id: reference.id,
    revision: reference.revision,
    status: reference.status,
  });
}

function freezeComposition(input: ProductionCompositionInput): ProductionCompositionInput {
  const duration = normalizeTransportInput(input.macroCycleDuration);
  return Object.freeze({
    compositionId: input.compositionId,
    revision: input.revision,
    engineId: input.engineId,
    macroCycleDuration: exactTransportSeconds(
      duration.secondsNumerator,
      duration.secondsDenominator,
    ),
    baseLaps: input.baseLaps,
    density: input.density,
    noteCount: input.noteCount,
  });
}

/** Validate, detach from caller-owned objects, and deeply freeze authored binding state. */
export function defineFirstCrossingBinding(input: unknown): FirstCrossingBinding {
  assertValidBinding(input);
  return Object.freeze({
    schemaVersion: FIRST_CROSSING_BINDING_SCHEMA_VERSION,
    id: input.id,
    revision: input.revision,
    label: input.label,
    status: input.status,
    routeDefinitionId: input.routeDefinitionId,
    composition: freezeComposition(input.composition),
    triggerEnginePresentation: freezeReference(input.triggerEnginePresentation),
    sound: Object.freeze({
      pack: freezeReference(input.sound.pack),
      scale: freezeReference(input.sound.scale),
    }),
    environment: freezeReference(input.environment),
    ...(input.transmissionSet ? { transmissionSet: freezeReference(input.transmissionSet) } : {}),
  });
}

function freezeResolvedReference(
  expectedKind: FirstCrossingReferenceKind,
  reference: FirstCrossingContentReference,
  resolved: ResolvedFirstCrossingContentReference | undefined,
): ResolvedFirstCrossingContentReference {
  if (!resolved) {
    throw new Error(
      `FirstCrossingBinding cannot resolve ${expectedKind} ${reference.id}@${reference.revision}.`,
    );
  }
  if (
    resolved.kind !== expectedKind ||
    resolved.id !== reference.id ||
    resolved.revision !== reference.revision ||
    (resolved.source !== "production" && resolved.source !== "development")
  ) {
    throw new Error(
      `FirstCrossingBinding resolver returned an incoherent ${expectedKind} reference.`,
    );
  }
  if (resolved.source === "development" && reference.status !== "provisional") {
    throw new Error(
      `Development-only ${expectedKind} ${reference.id} must remain explicitly provisional.`,
    );
  }
  return Object.freeze({
    kind: resolved.kind,
    id: resolved.id,
    revision: resolved.revision,
    source: resolved.source,
  });
}

function freezeResolvedRoute(
  binding: FirstCrossingBinding,
  resolved: ResolvedFirstCrossingRoute | undefined,
): ResolvedFirstCrossingRoute {
  if (!resolved || resolved.definition.id !== binding.routeDefinitionId) {
    throw new Error(`FirstCrossingBinding cannot resolve route ${binding.routeDefinitionId}.`);
  }
  const route = resolved.definition;
  if (
    typeof route.originId !== "string" ||
    route.originId.trim().length === 0 ||
    typeof route.destinationId !== "string" ||
    route.destinationId.trim().length === 0 ||
    !Number.isFinite(route.defaultDurationSeconds) ||
    route.defaultDurationSeconds <= 0
  ) {
    throw new Error(`FirstCrossingBinding route ${route.id} is incoherent.`);
  }
  if (resolved.source === "development" && binding.status !== "provisional") {
    throw new Error(`Development-only route ${route.id} requires a provisional binding.`);
  }
  return Object.freeze({
    source: resolved.source,
    definition: Object.freeze({
      id: route.id,
      originId: route.originId,
      destinationId: route.destinationId,
      defaultDurationSeconds: route.defaultDurationSeconds,
    }),
  });
}

/** Pure, fail-closed resolution into existing production system identities. */
export function resolveFirstCrossingBinding(
  input: unknown,
  resolvers: FirstCrossingBindingResolvers,
): ResolvedFirstCrossingBinding {
  const authored = defineFirstCrossingBinding(input);
  const route = freezeResolvedRoute(
    authored,
    resolvers.resolveRouteDefinition(authored.routeDefinitionId),
  );
  const compositionSnapshot = createProductionCompositionSnapshot(authored.composition);
  const presentationRaw = resolvers.resolveTriggerEnginePresentation(
    authored.triggerEnginePresentation,
  );
  const presentationBase = freezeResolvedReference(
    "trigger-engine-presentation",
    authored.triggerEnginePresentation,
    presentationRaw,
  );
  if (!presentationRaw) throw new Error("Unreachable presentation resolution state.");
  if (
    !Array.isArray(presentationRaw.compatibleCompositionEngines) ||
    presentationRaw.compatibleCompositionEngines.length === 0 ||
    presentationRaw.compatibleCompositionEngines.some(
      (engineId) => !isProductionPhaseAlignedEngineId(engineId),
    )
  ) {
    throw new Error(
      `Trigger Engine presentation ${presentationBase.id} has no coherent production compatibility contract.`,
    );
  }
  const compatibleCompositionEngines = Object.freeze([
    ...presentationRaw.compatibleCompositionEngines,
  ]);
  if (!compatibleCompositionEngines.includes(authored.composition.engineId)) {
    throw new Error(
      `Trigger Engine presentation ${presentationBase.id} cannot present composition engine ${authored.composition.engineId}.`,
    );
  }
  const triggerEnginePresentation: ResolvedTriggerEnginePresentation = Object.freeze({
    ...presentationBase,
    kind: "trigger-engine-presentation",
    compatibleCompositionEngines,
  });
  const pack = freezeResolvedReference(
    "sound-pack",
    authored.sound.pack,
    resolvers.resolveContentReference("sound-pack", authored.sound.pack),
  );
  const scale = freezeResolvedReference(
    "scale",
    authored.sound.scale,
    resolvers.resolveContentReference("scale", authored.sound.scale),
  );
  const environment = freezeResolvedReference(
    "environment-preset",
    authored.environment,
    resolvers.resolveContentReference("environment-preset", authored.environment),
  );
  const transmissionSet = authored.transmissionSet
    ? freezeResolvedReference(
        "transmission-set",
        authored.transmissionSet,
        resolvers.resolveContentReference("transmission-set", authored.transmissionSet),
      )
    : null;

  if (
    authored.status === "accepted" &&
    [
      authored.triggerEnginePresentation,
      authored.sound.pack,
      authored.sound.scale,
      authored.environment,
      authored.transmissionSet,
    ].some((reference) => reference?.status === "provisional")
  ) {
    throw new Error("An accepted FirstCrossingBinding cannot contain provisional selections.");
  }

  return Object.freeze({
    authored,
    route,
    compositionSnapshot,
    triggerEnginePresentation,
    sound: Object.freeze({ pack, scale }),
    environment,
    transmissionSet,
  });
}
