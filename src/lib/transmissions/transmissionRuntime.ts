/**
 * SYS-010 — pure deterministic transmission lifecycle authority.
 *
 * The runtime consumes monotonic crossing progress and freeze-aware active
 * journey time. It owns no clock, pause/visibility policy, crossing progress,
 * audio, rendering, musical transport, loop, callback bus, or random stream.
 */

import { stableUnitRoll } from "./rng";
import type {
  ActiveTransmissionSnapshot,
  TransmissionCrossingInput,
  TransmissionDefinition,
  TransmissionEpisodeSnapshot,
  TransmissionRuntimeEvent,
} from "./transmissionTypes";

export const TRANSMISSION_RUNTIME_SNAPSHOT_VERSION = 1 as const;

export type TransmissionRuntimeConfig = Readonly<{
  runId: string;
  routeDefinitionId: string;
  definitionSetId: string;
  seed: string;
  definitions: readonly TransmissionDefinition[];
  admissionChance: number;
  minGapSeconds: number;
}>;

export type FrozenTransmissionRuntimeConfig = Readonly<{
  runId: string;
  routeDefinitionId: string;
  definitionSetId: string;
  seed: string;
  definitions: readonly TransmissionDefinition[];
  admissionChance: number;
  minGapSeconds: number;
}>;

export type TransmissionRuntimeSnapshotV1 = Readonly<{
  schemaVersion: typeof TRANSMISSION_RUNTIME_SNAPSHOT_VERSION;
  config: FrozenTransmissionRuntimeConfig;
  hasAcceptedUpdate: boolean;
  previousProgress: number;
  activeElapsedSeconds: number;
  crossingPhase: TransmissionCrossingInput["phase"];
  arrived: boolean;
  evaluatedEpisodes: readonly TransmissionEpisodeSnapshot[];
  startedEpisodeIds: readonly string[];
  playedTransmissionIds: readonly string[];
  current: ActiveTransmissionSnapshot | null;
  remainingSeconds: number | null;
  lastCompletedAtActiveSeconds: number | null;
  arrivalFadeRequestedForStartEventId: string | null;
}>;

export type TransmissionUpdateResult = Readonly<{
  snapshot: TransmissionRuntimeSnapshotV1;
  events: readonly TransmissionRuntimeEvent[];
}>;

export type TransmissionRuntime = Readonly<{
  readonly config: FrozenTransmissionRuntimeConfig;
  update(input: TransmissionCrossingInput): TransmissionUpdateResult;
  peek(): TransmissionRuntimeSnapshotV1;
  snapshot(): TransmissionRuntimeSnapshotV1;
}>;

type MutableState = {
  hasAcceptedUpdate: boolean;
  previousProgress: number;
  activeElapsedSeconds: number;
  crossingPhase: TransmissionCrossingInput["phase"];
  arrived: boolean;
  evaluatedEpisodes: Map<string, TransmissionEpisodeSnapshot>;
  startedEpisodeIds: Set<string>;
  playedTransmissionIds: Set<string>;
  current: ActiveTransmissionSnapshot | null;
  lastCompletedAtActiveSeconds: number | null;
  arrivalFadeRequestedForStartEventId: string | null;
};

type TimelineBoundary = Readonly<{
  atActiveSeconds: number;
  progress: number;
  kind: "entry" | "exit" | "arrival";
  definitionId?: string;
}>;

const EPSILON = 1e-9;

function assertIdentifier(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Transmission runtime ${field} must be a non-empty string.`);
  }
}

function assertFinite(value: unknown, field: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Transmission runtime ${field} must be finite.`);
  }
}

function assertProgress(value: unknown, field: string): asserts value is number {
  assertFinite(value, field);
  if (value < 0 || value > 1) {
    throw new Error(`Transmission runtime ${field} must be within [0, 1].`);
  }
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Transmission runtime ${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function freezeDefinition(source: TransmissionDefinition): TransmissionDefinition {
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    throw new Error("Transmission definitions must be objects.");
  }
  assertIdentifier(source.id, "definition.id");
  assertIdentifier(source.label, `definition ${source.id} label`);
  assertProgress(source.windowStart, `definition ${source.id} windowStart`);
  assertProgress(source.windowEnd, `definition ${source.id} windowEnd`);
  if (!(source.windowStart < source.windowEnd)) {
    throw new Error(`Transmission definition ${source.id} requires a non-empty half-open window.`);
  }
  assertFinite(source.durationSeconds, `definition ${source.id} durationSeconds`);
  if (source.durationSeconds <= 0) {
    throw new Error(`Transmission definition ${source.id} durationSeconds must be positive.`);
  }
  assertFinite(source.weight, `definition ${source.id} weight`);
  if (source.weight <= 0) {
    throw new Error(`Transmission definition ${source.id} weight must be positive.`);
  }
  assertFinite(source.priority, `definition ${source.id} priority`);
  if (!Number.isInteger(source.priority) || source.priority < 0) {
    throw new Error(
      `Transmission definition ${source.id} priority must be a non-negative integer.`,
    );
  }
  if (typeof source.oncePerCrossing !== "boolean") {
    throw new Error(`Transmission definition ${source.id} oncePerCrossing must be boolean.`);
  }
  return Object.freeze({
    id: source.id,
    label: source.label,
    windowStart: source.windowStart,
    windowEnd: source.windowEnd,
    durationSeconds: source.durationSeconds,
    weight: source.weight,
    priority: source.priority,
    oncePerCrossing: source.oncePerCrossing,
  });
}

function freezeConfig(source: TransmissionRuntimeConfig): FrozenTransmissionRuntimeConfig {
  assertIdentifier(source.runId, "runId");
  assertIdentifier(source.routeDefinitionId, "routeDefinitionId");
  assertIdentifier(source.definitionSetId, "definitionSetId");
  assertIdentifier(source.seed, "seed");
  if (!Array.isArray(source.definitions)) {
    throw new Error("Transmission runtime definitions must be an array.");
  }
  const definitions = source.definitions.map(freezeDefinition);
  const ids = new Set<string>();
  for (const definition of definitions) {
    if (ids.has(definition.id)) {
      throw new Error(`Duplicate transmission definition id: ${definition.id}.`);
    }
    ids.add(definition.id);
  }
  assertFinite(source.admissionChance, "admissionChance");
  if (source.admissionChance < 0 || source.admissionChance > 1) {
    throw new Error("Transmission runtime admissionChance must be within [0, 1].");
  }
  assertFinite(source.minGapSeconds, "minGapSeconds");
  if (source.minGapSeconds < 0) {
    throw new Error("Transmission runtime minGapSeconds must be non-negative.");
  }
  return Object.freeze({
    runId: source.runId,
    routeDefinitionId: source.routeDefinitionId,
    definitionSetId: source.definitionSetId,
    seed: source.seed,
    definitions: Object.freeze(definitions),
    admissionChance: source.admissionChance,
    minGapSeconds: source.minGapSeconds,
  });
}

function episodeId(config: FrozenTransmissionRuntimeConfig, definitionId: string): string {
  return `${config.definitionSetId}:${definitionId}:episode-1`;
}

function eventId(config: FrozenTransmissionRuntimeConfig, episode: string, suffix: string): string {
  return `${config.runId}:${episode}:${suffix}`;
}

function interpolateTime(
  progress: number,
  previousProgress: number,
  currentProgress: number,
  previousTime: number,
  currentTime: number,
): number {
  // Current First Crossing progress is linear in accepted active journey time.
  // A future nonlinear route must supply an explicit boundary-time mapping
  // instead of treating this interpolation as a universal route contract.
  if (currentProgress === previousProgress) return currentTime;
  const ratio = (progress - previousProgress) / (currentProgress - previousProgress);
  return previousTime + Math.max(0, Math.min(1, ratio)) * (currentTime - previousTime);
}

function progressAtTime(
  time: number,
  previousProgress: number,
  currentProgress: number,
  previousTime: number,
  currentTime: number,
): number {
  if (currentTime === previousTime) return currentProgress;
  const ratio = (time - previousTime) / (currentTime - previousTime);
  return previousProgress + Math.max(0, Math.min(1, ratio)) * (currentProgress - previousProgress);
}

function createRuntime(
  sourceConfig: TransmissionRuntimeConfig,
  initialState?: MutableState,
): TransmissionRuntime {
  const config = freezeConfig(sourceConfig);
  const definitionsById = new Map(
    config.definitions.map((definition) => [definition.id, definition]),
  );
  const state: MutableState = initialState
    ? {
        ...initialState,
        evaluatedEpisodes: new Map(initialState.evaluatedEpisodes),
        startedEpisodeIds: new Set(initialState.startedEpisodeIds),
        playedTransmissionIds: new Set(initialState.playedTransmissionIds),
      }
    : {
        hasAcceptedUpdate: false,
        previousProgress: 0,
        activeElapsedSeconds: 0,
        crossingPhase: "idle",
        arrived: false,
        evaluatedEpisodes: new Map(),
        startedEpisodeIds: new Set(),
        playedTransmissionIds: new Set(),
        current: null,
        lastCompletedAtActiveSeconds: null,
        arrivalFadeRequestedForStartEventId: null,
      };

  function currentSnapshot(): TransmissionRuntimeSnapshotV1 {
    const current = state.current ? Object.freeze({ ...state.current }) : null;
    return Object.freeze({
      schemaVersion: TRANSMISSION_RUNTIME_SNAPSHOT_VERSION,
      config,
      hasAcceptedUpdate: state.hasAcceptedUpdate,
      previousProgress: state.previousProgress,
      activeElapsedSeconds: state.activeElapsedSeconds,
      crossingPhase: state.crossingPhase,
      arrived: state.arrived,
      evaluatedEpisodes: Object.freeze(
        Array.from(state.evaluatedEpisodes.values(), (episode) => Object.freeze({ ...episode })),
      ),
      startedEpisodeIds: Object.freeze(Array.from(state.startedEpisodeIds)),
      playedTransmissionIds: Object.freeze(Array.from(state.playedTransmissionIds)),
      current,
      remainingSeconds: current
        ? Math.max(0, current.completesAtActiveSeconds - state.activeElapsedSeconds)
        : null,
      lastCompletedAtActiveSeconds: state.lastCompletedAtActiveSeconds,
      arrivalFadeRequestedForStartEventId: state.arrivalFadeRequestedForStartEventId,
    });
  }

  function update(input: TransmissionCrossingInput): TransmissionUpdateResult {
    if (input.runId !== config.runId || input.routeDefinitionId !== config.routeDefinitionId) {
      throw new Error("Transmission runtime input identity does not match its configured run.");
    }
    assertProgress(input.progress, "crossing progress");
    assertFinite(input.activeElapsedSeconds, "activeElapsedSeconds");
    if (input.activeElapsedSeconds < 0) {
      throw new Error("Transmission runtime activeElapsedSeconds must be non-negative.");
    }
    if (input.progress + EPSILON < state.previousProgress) {
      throw new Error("Transmission runtime crossing progress cannot regress.");
    }
    if (input.activeElapsedSeconds + EPSILON < state.activeElapsedSeconds) {
      throw new Error("Transmission runtime activeElapsedSeconds cannot regress.");
    }
    if (
      input.progress > state.previousProgress + EPSILON &&
      input.activeElapsedSeconds <= state.activeElapsedSeconds + EPSILON
    ) {
      throw new Error("Transmission runtime progress cannot advance while active time is frozen.");
    }
    const arrivalTransition =
      input.transitions?.some((transition) => transition.id === "arrived") ?? false;
    if (arrivalTransition && input.phase !== "arrived") {
      throw new Error("Transmission arrival transition requires an arrived crossing phase.");
    }
    if (input.phase === "arrived" && input.progress !== 1) {
      throw new Error("Transmission runtime arrived phase requires route progress 1.");
    }
    if (state.arrived && input.phase !== "arrived") {
      throw new Error("Transmission runtime crossing phase cannot regress after arrival.");
    }

    const previousProgress = state.previousProgress;
    const previousTime = state.activeElapsedSeconds;
    const currentProgress = input.progress;
    const currentTime = input.activeElapsedSeconds;
    const events: TransmissionRuntimeEvent[] = [];
    const boundaries: TimelineBoundary[] = [];

    for (const definition of config.definitions) {
      const episode = episodeId(config, definition.id);
      if (!state.evaluatedEpisodes.has(episode) && definition.windowStart <= currentProgress) {
        boundaries.push({
          kind: "entry",
          definitionId: definition.id,
          progress: definition.windowStart,
          atActiveSeconds: interpolateTime(
            definition.windowStart,
            previousProgress,
            currentProgress,
            previousTime,
            currentTime,
          ),
        });
      }
      if (
        state.evaluatedEpisodes.has(episode) &&
        previousProgress < definition.windowEnd &&
        definition.windowEnd <= currentProgress
      ) {
        boundaries.push({
          kind: "exit",
          definitionId: definition.id,
          progress: definition.windowEnd,
          atActiveSeconds: interpolateTime(
            definition.windowEnd,
            previousProgress,
            currentProgress,
            previousTime,
            currentTime,
          ),
        });
      }
    }

    const arrivingNow = !state.arrived && (input.phase === "arrived" || arrivalTransition);
    if (arrivingNow) {
      boundaries.push({
        kind: "arrival",
        progress: 1,
        atActiveSeconds: interpolateTime(
          1,
          previousProgress,
          currentProgress,
          previousTime,
          currentTime,
        ),
      });
    }

    const kindOrder = { exit: 0, entry: 1, arrival: 2 } as const;
    boundaries.sort(
      (a, b) =>
        a.atActiveSeconds - b.atActiveSeconds ||
        kindOrder[a.kind] - kindOrder[b.kind] ||
        (a.definitionId ?? "").localeCompare(b.definitionId ?? ""),
    );

    function eligibleCandidates(progress: number): TransmissionDefinition[] {
      return config.definitions.filter((definition) => {
        const episode = episodeId(config, definition.id);
        const evaluation = state.evaluatedEpisodes.get(episode);
        if (!evaluation?.admitted || state.startedEpisodeIds.has(episode)) return false;
        if (definition.oncePerCrossing && state.playedTransmissionIds.has(definition.id))
          return false;
        return progress >= definition.windowStart && progress < definition.windowEnd;
      });
    }

    function attemptStart(atTime: number, progress: number, opportunityId: string): void {
      if (state.current || state.arrived) return;
      if (
        state.lastCompletedAtActiveSeconds !== null &&
        atTime + EPSILON < state.lastCompletedAtActiveSeconds + config.minGapSeconds
      ) {
        return;
      }
      const candidates = eligibleCandidates(progress);
      if (candidates.length === 0) return;
      const highestPriority = Math.max(...candidates.map((definition) => definition.priority));
      const tier = candidates
        .filter((definition) => definition.priority === highestPriority)
        .sort((a, b) => a.id.localeCompare(b.id));
      const totalWeight = tier.reduce((sum, definition) => sum + definition.weight, 0);
      const candidateKey = tier.map((definition) => episodeId(config, definition.id)).join("|");
      const target =
        stableUnitRoll(config.seed, `${config.runId}:select:${opportunityId}:${candidateKey}`) *
        totalWeight;
      let accumulated = 0;
      let chosen = tier[tier.length - 1]!;
      for (const definition of tier) {
        accumulated += definition.weight;
        if (target < accumulated) {
          chosen = definition;
          break;
        }
      }

      const episode = episodeId(config, chosen.id);
      const startId = eventId(config, episode, "started");
      state.current = Object.freeze({
        definitionId: chosen.id,
        episodeId: episode,
        startedAtActiveSeconds: atTime,
        completesAtActiveSeconds: atTime + chosen.durationSeconds,
        startEventId: startId,
      });
      state.startedEpisodeIds.add(episode);
      state.playedTransmissionIds.add(chosen.id);
      events.push(
        Object.freeze({
          id: startId,
          type: "transmissionStarted",
          definitionId: chosen.id,
          episodeId: episode,
          atActiveSeconds: atTime,
          completesAtActiveSeconds: atTime + chosen.durationSeconds,
        }),
      );
    }

    let boundaryIndex = 0;
    let cursorTime = previousTime;

    while (true) {
      const nextBoundaryTime =
        boundaries[boundaryIndex]?.atActiveSeconds ?? Number.POSITIVE_INFINITY;
      const nextCompletionTime =
        state.current?.completesAtActiveSeconds ?? Number.POSITIVE_INFINITY;
      const gapBoundary =
        !state.current && state.lastCompletedAtActiveSeconds !== null
          ? state.lastCompletedAtActiveSeconds + config.minGapSeconds
          : Number.POSITIVE_INFINITY;
      const nextGapTime =
        gapBoundary > cursorTime + EPSILON ? gapBoundary : Number.POSITIVE_INFINITY;
      const nextTime = Math.min(nextBoundaryTime, nextCompletionTime, nextGapTime, currentTime);
      if (!Number.isFinite(nextTime) || nextTime > currentTime + EPSILON) break;
      if (nextTime + EPSILON < cursorTime) {
        throw new Error("Transmission runtime internal timeline regressed.");
      }
      cursorTime = nextTime;
      const cursorProgress = progressAtTime(
        cursorTime,
        previousProgress,
        currentProgress,
        previousTime,
        currentTime,
      );

      if (state.current && state.current.completesAtActiveSeconds <= cursorTime + EPSILON) {
        const completed = state.current;
        state.current = null;
        if (state.arrivalFadeRequestedForStartEventId === completed.startEventId) {
          state.arrivalFadeRequestedForStartEventId = null;
        }
        state.lastCompletedAtActiveSeconds = completed.completesAtActiveSeconds;
        events.push(
          Object.freeze({
            id: eventId(config, completed.episodeId, "completed"),
            type: "transmissionCompleted",
            definitionId: completed.definitionId,
            episodeId: completed.episodeId,
            atActiveSeconds: completed.completesAtActiveSeconds,
          }),
        );
      }

      const boundaryGroup: TimelineBoundary[] = [];
      while (
        boundaryIndex < boundaries.length &&
        Math.abs(boundaries[boundaryIndex]!.atActiveSeconds - cursorTime) <= EPSILON
      ) {
        boundaryGroup.push(boundaries[boundaryIndex]!);
        boundaryIndex += 1;
      }

      for (const boundary of boundaryGroup.filter((item) => item.kind === "entry")) {
        const definition = definitionsById.get(boundary.definitionId!);
        if (!definition) continue;
        const episode = episodeId(config, definition.id);
        if (state.evaluatedEpisodes.has(episode)) continue;
        const admitted =
          config.admissionChance === 1 ||
          stableUnitRoll(config.seed, `${config.runId}:admit:${episode}`) < config.admissionChance;
        const evaluation = Object.freeze({
          episodeId: episode,
          definitionId: definition.id,
          admitted,
          evaluatedAtProgress: definition.windowStart,
          evaluatedAtActiveSeconds: boundary.atActiveSeconds,
        });
        state.evaluatedEpisodes.set(episode, evaluation);
        if (admitted) {
          events.push(
            Object.freeze({
              id: eventId(config, episode, "admitted"),
              type: "transmissionAdmitted",
              definitionId: definition.id,
              episodeId: episode,
              atActiveSeconds: boundary.atActiveSeconds,
            }),
          );
        }
      }

      if (boundaryGroup.some((boundary) => boundary.kind === "arrival")) {
        state.arrived = true;
        if (
          state.current &&
          state.arrivalFadeRequestedForStartEventId !== state.current.startEventId
        ) {
          state.arrivalFadeRequestedForStartEventId = state.current.startEventId;
          events.push(
            Object.freeze({
              id: `${state.current.startEventId}:arrival-fade-requested`,
              type: "transmissionArrivalFadeRequested",
              definitionId: state.current.definitionId,
              episodeId: state.current.episodeId,
              atActiveSeconds: cursorTime,
            }),
          );
        }
      }

      const opportunity = boundaryGroup.length
        ? boundaryGroup
            .map((boundary) => `${boundary.kind}:${boundary.definitionId ?? "crossing"}`)
            .join("|")
        : state.lastCompletedAtActiveSeconds !== null &&
            Math.abs(cursorTime - (state.lastCompletedAtActiveSeconds + config.minGapSeconds)) <=
              EPSILON
          ? `gap:${state.lastCompletedAtActiveSeconds}`
          : `time:${cursorTime}`;
      attemptStart(cursorTime, cursorProgress, opportunity);

      if (cursorTime >= currentTime - EPSILON) break;
      if (
        nextBoundaryTime === Number.POSITIVE_INFINITY &&
        nextCompletionTime === Number.POSITIVE_INFINITY &&
        nextGapTime === Number.POSITIVE_INFINITY
      ) {
        break;
      }
    }

    state.hasAcceptedUpdate = true;
    state.previousProgress = currentProgress;
    state.activeElapsedSeconds = currentTime;
    state.crossingPhase = input.phase;
    if (input.phase === "arrived") state.arrived = true;

    return Object.freeze({
      snapshot: currentSnapshot(),
      events: Object.freeze(events),
    });
  }

  return Object.freeze({
    config,
    update,
    peek: currentSnapshot,
    snapshot: currentSnapshot,
  });
}

export function createTransmissionRuntime(config: TransmissionRuntimeConfig): TransmissionRuntime {
  return createRuntime(config);
}

function validateSnapshot(
  snapshot: unknown,
  expectedIdentity?: Readonly<{ runId: string; routeDefinitionId: string }>,
): { config: FrozenTransmissionRuntimeConfig; state: MutableState } {
  const root = asRecord(snapshot, "snapshot");
  if (root.schemaVersion !== TRANSMISSION_RUNTIME_SNAPSHOT_VERSION) {
    throw new Error(
      `Unsupported transmission runtime snapshot version: ${String(root.schemaVersion)}.`,
    );
  }
  const configRecord = asRecord(root.config, "snapshot.config");
  const config = freezeConfig({
    runId: configRecord.runId as string,
    routeDefinitionId: configRecord.routeDefinitionId as string,
    definitionSetId: configRecord.definitionSetId as string,
    seed: configRecord.seed as string,
    definitions: configRecord.definitions as TransmissionDefinition[],
    admissionChance: configRecord.admissionChance as number,
    minGapSeconds: configRecord.minGapSeconds as number,
  });
  if (
    expectedIdentity &&
    (config.runId !== expectedIdentity.runId ||
      config.routeDefinitionId !== expectedIdentity.routeDefinitionId)
  ) {
    throw new Error("Transmission snapshot identity does not match the expected run.");
  }
  if (typeof root.hasAcceptedUpdate !== "boolean" || typeof root.arrived !== "boolean") {
    throw new Error("Transmission snapshot lifecycle flags must be boolean.");
  }
  assertProgress(root.previousProgress, "snapshot.previousProgress");
  assertFinite(root.activeElapsedSeconds, "snapshot.activeElapsedSeconds");
  if (root.activeElapsedSeconds < 0) {
    throw new Error("Transmission snapshot activeElapsedSeconds must be non-negative.");
  }
  if (!Array.isArray(root.evaluatedEpisodes) || !Array.isArray(root.startedEpisodeIds)) {
    throw new Error("Transmission snapshot episode state must be arrays.");
  }
  if (!Array.isArray(root.playedTransmissionIds)) {
    throw new Error("Transmission snapshot playedTransmissionIds must be an array.");
  }
  const validPhases = new Set(["idle", "launching", "in_transit", "approaching", "arrived"]);
  if (typeof root.crossingPhase !== "string" || !validPhases.has(root.crossingPhase)) {
    throw new Error("Transmission snapshot crossingPhase is invalid.");
  }

  const definitionsById = new Map(
    config.definitions.map((definition) => [definition.id, definition]),
  );
  const evaluatedEpisodes = new Map<string, TransmissionEpisodeSnapshot>();
  for (const raw of root.evaluatedEpisodes) {
    const record = asRecord(raw, "snapshot.evaluatedEpisode");
    const definitionId = record.definitionId as string;
    const definition = definitionsById.get(definitionId);
    if (!definition) throw new Error("Transmission snapshot references an unknown definition.");
    const expectedEpisode = episodeId(config, definitionId);
    if (record.episodeId !== expectedEpisode || typeof record.admitted !== "boolean") {
      throw new Error("Transmission snapshot episode identity or verdict is invalid.");
    }
    assertProgress(record.evaluatedAtProgress, "snapshot episode progress");
    assertFinite(record.evaluatedAtActiveSeconds, "snapshot episode active time");
    if (record.evaluatedAtProgress !== definition.windowStart) {
      throw new Error("Transmission snapshot episode progress is inconsistent with its window.");
    }
    if (
      record.evaluatedAtActiveSeconds < 0 ||
      record.evaluatedAtActiveSeconds > (root.activeElapsedSeconds as number)
    ) {
      throw new Error("Transmission snapshot episode active time is inconsistent.");
    }
    if (evaluatedEpisodes.has(expectedEpisode)) {
      throw new Error("Transmission snapshot contains duplicate evaluated episodes.");
    }
    evaluatedEpisodes.set(
      expectedEpisode,
      Object.freeze({
        episodeId: expectedEpisode,
        definitionId,
        admitted: record.admitted,
        evaluatedAtProgress: record.evaluatedAtProgress,
        evaluatedAtActiveSeconds: record.evaluatedAtActiveSeconds,
      }),
    );
  }

  const expectedEvaluated = config.definitions
    .filter(
      (definition) =>
        root.hasAcceptedUpdate && definition.windowStart <= (root.previousProgress as number),
    )
    .map((definition) => episodeId(config, definition.id));
  if (
    expectedEvaluated.length !== evaluatedEpisodes.size ||
    expectedEvaluated.some((episode) => !evaluatedEpisodes.has(episode))
  ) {
    throw new Error("Transmission snapshot evaluated episodes do not match accepted progress.");
  }

  const startedEpisodeIds = new Set<string>();
  for (const raw of root.startedEpisodeIds) {
    if (typeof raw !== "string" || startedEpisodeIds.has(raw)) {
      throw new Error("Transmission snapshot started episode ids are invalid or duplicated.");
    }
    if (!evaluatedEpisodes.get(raw)?.admitted) {
      throw new Error("Transmission snapshot cannot start a non-admitted episode.");
    }
    startedEpisodeIds.add(raw);
  }
  const playedTransmissionIds = new Set<string>();
  for (const raw of root.playedTransmissionIds) {
    if (typeof raw !== "string" || !definitionsById.has(raw) || playedTransmissionIds.has(raw)) {
      throw new Error("Transmission snapshot played transmission ids are invalid.");
    }
    playedTransmissionIds.add(raw);
  }
  const expectedPlayed = new Set(
    Array.from(startedEpisodeIds, (episode) => evaluatedEpisodes.get(episode)!.definitionId),
  );
  if (
    expectedPlayed.size !== playedTransmissionIds.size ||
    Array.from(expectedPlayed).some((id) => !playedTransmissionIds.has(id))
  ) {
    throw new Error("Transmission snapshot played ids do not match started episodes.");
  }

  let current: ActiveTransmissionSnapshot | null = null;
  if (root.current !== null) {
    const record = asRecord(root.current, "snapshot.current");
    const definitionId = record.definitionId as string;
    const episode = record.episodeId as string;
    if (
      !definitionsById.has(definitionId) ||
      !startedEpisodeIds.has(episode) ||
      evaluatedEpisodes.get(episode)?.definitionId !== definitionId
    ) {
      throw new Error("Transmission snapshot current transmission is inconsistent.");
    }
    assertFinite(record.startedAtActiveSeconds, "snapshot current start");
    assertFinite(record.completesAtActiveSeconds, "snapshot current completion");
    const currentDefinition = definitionsById.get(definitionId)!;
    if (
      record.startedAtActiveSeconds > (root.activeElapsedSeconds as number) ||
      record.completesAtActiveSeconds <= (root.activeElapsedSeconds as number) ||
      record.completesAtActiveSeconds !==
        (record.startedAtActiveSeconds as number) + currentDefinition.durationSeconds ||
      typeof record.startEventId !== "string"
    ) {
      throw new Error("Transmission snapshot current timing is inconsistent.");
    }
    current = Object.freeze({
      definitionId,
      episodeId: episode,
      startedAtActiveSeconds: record.startedAtActiveSeconds,
      completesAtActiveSeconds: record.completesAtActiveSeconds,
      startEventId: record.startEventId,
    });
  }
  if (root.lastCompletedAtActiveSeconds !== null) {
    assertFinite(root.lastCompletedAtActiveSeconds, "snapshot last completion");
    if (root.lastCompletedAtActiveSeconds > (root.activeElapsedSeconds as number)) {
      throw new Error("Transmission snapshot completion cannot be in the future.");
    }
  }
  if (
    root.arrivalFadeRequestedForStartEventId !== null &&
    (typeof root.arrivalFadeRequestedForStartEventId !== "string" ||
      !current ||
      root.arrivalFadeRequestedForStartEventId !== current.startEventId)
  ) {
    throw new Error("Transmission snapshot arrival fade latch is inconsistent.");
  }
  if ((root.crossingPhase === "arrived") !== root.arrived) {
    throw new Error("Transmission snapshot arrival state is inconsistent.");
  }
  if (
    !root.hasAcceptedUpdate &&
    (root.previousProgress !== 0 ||
      root.activeElapsedSeconds !== 0 ||
      root.crossingPhase !== "idle" ||
      root.arrived ||
      evaluatedEpisodes.size > 0 ||
      startedEpisodeIds.size > 0 ||
      current !== null)
  ) {
    throw new Error("An unstarted transmission snapshot must contain initial lifecycle state.");
  }

  return {
    config,
    state: {
      hasAcceptedUpdate: root.hasAcceptedUpdate,
      previousProgress: root.previousProgress,
      activeElapsedSeconds: root.activeElapsedSeconds,
      crossingPhase: root.crossingPhase as TransmissionCrossingInput["phase"],
      arrived: root.arrived,
      evaluatedEpisodes,
      startedEpisodeIds,
      playedTransmissionIds,
      current,
      lastCompletedAtActiveSeconds: root.lastCompletedAtActiveSeconds as number | null,
      arrivalFadeRequestedForStartEventId: root.arrivalFadeRequestedForStartEventId as
        string | null,
    },
  };
}

export function hydrateTransmissionRuntime(
  snapshot: unknown,
  expectedIdentity?: Readonly<{ runId: string; routeDefinitionId: string }>,
): TransmissionRuntime {
  const validated = validateSnapshot(snapshot, expectedIdentity);
  return createRuntime(validated.config, validated.state);
}
