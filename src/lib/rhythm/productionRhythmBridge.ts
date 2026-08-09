import { engineClock } from "@/lib/engine/clock";
import type {
  AuthoritativeRhythmEvent,
  ExactMacroPosition,
  RhythmTimelineSnapshot,
} from "./authoritativeTimeline";
import { compositionTimelineDefinition, type CompositionSnapshot } from "./compositionSnapshot";
import {
  addTransportSeconds,
  compareTransportSeconds,
  createLiveTimelineAdapter,
  exactTransportSeconds,
  multiplyTransportSeconds,
  normalizeTransportInput,
  subtractTransportSeconds,
  transportSecondsFromNumber,
  type ExactTransportSeconds,
  type LiveTimelineAdapter,
  type TransportPositionInput,
} from "./liveTimelineAdapter";

export type ProductionRhythmAuthority = Readonly<{
  composition: CompositionSnapshot;
  timeline: LiveTimelineAdapter;
}>;

/** Canonical event handed to the single production scheduler and its sinks. */
export type ProductionTimelineEvent = Readonly<{
  id: string;
  compositionId: string;
  compositionRevision: number;
  voiceId: string;
  voiceOrder: number;
  voiceCount: number;
  voiceEventIndex: bigint;
  eventInMacroCycle: number;
  exactMacroPosition: ExactMacroPosition;
  compositionTransportOccurrence: ExactTransportSeconds;
  suppliedTransportOccurrence: ExactTransportSeconds;
  authoritativeEvent: AuthoritativeRhythmEvent;
}>;

/** Exact payload future production Trigger Engines consume. */
export type ProductionTriggerEngineInput = Readonly<{
  composition: CompositionSnapshot;
  suppliedTransportPosition: ExactTransportSeconds;
  compositionTransportPosition: ExactTransportSeconds;
  snapshot: RhythmTimelineSnapshot;
  events: readonly ProductionTimelineEvent[];
}>;

type PendingCompositionRevision = Readonly<{
  authority: ProductionRhythmAuthority;
  activatesAt: ExactTransportSeconds;
}>;

export type CompositionRevisionSession = Readonly<{
  active: ProductionRhythmAuthority;
  activeFrom: ExactTransportSeconds;
  pending: PendingCompositionRevision | null;
}>;

export type CompositionSessionAdvance = Readonly<{
  session: CompositionRevisionSession;
  input: ProductionTriggerEngineInput;
}>;

export function createProductionRhythmAuthority(
  composition: CompositionSnapshot,
): ProductionRhythmAuthority {
  const timeline = createLiveTimelineAdapter({
    composition: compositionTimelineDefinition(composition),
    macroCycleDuration: composition.macroCycleDuration,
  });
  return Object.freeze({ composition, timeline });
}

/** Read the existing singleton transport; this function does not own or advance time. */
export function readEngineClockTransportPosition(): ExactTransportSeconds {
  return transportSecondsFromNumber(engineClock.t());
}

export function reconstructProductionInput(
  authority: ProductionRhythmAuthority,
  suppliedPosition: TransportPositionInput,
): ProductionTriggerEngineInput {
  const position = normalizeTransportInput(suppliedPosition);
  return Object.freeze({
    composition: authority.composition,
    suppliedTransportPosition: position,
    compositionTransportPosition: position,
    snapshot: authority.timeline.snapshotAt(position),
    events: Object.freeze([]),
  });
}

export function reconstructFromEngineClock(
  authority: ProductionRhythmAuthority,
): ProductionTriggerEngineInput {
  return reconstructProductionInput(authority, readEngineClockTransportPosition());
}

export function createCompositionRevisionSession(
  composition: CompositionSnapshot,
  startsAt: TransportPositionInput = exactTransportSeconds(0n),
): CompositionRevisionSession {
  return Object.freeze({
    active: createProductionRhythmAuthority(composition),
    activeFrom: normalizeTransportInput(startsAt),
    pending: null,
  });
}

/** Queue a structural revision for the active composition's next exact Phase Zero. */
export function queueCompositionRevision(
  session: CompositionRevisionSession,
  composition: CompositionSnapshot,
  queuedAtInput: TransportPositionInput,
): CompositionRevisionSession {
  if (composition.id !== session.active.composition.id) {
    throw new Error("A queued structural revision must retain the composition id.");
  }
  const latestRevision =
    session.pending?.authority.composition.revision ?? session.active.composition.revision;
  if (composition.revision <= latestRevision) {
    throw new Error("A queued structural revision must increase the numeric revision.");
  }
  const queuedAt = normalizeTransportInput(queuedAtInput);
  if (compareTransportSeconds(queuedAt, session.activeFrom) < 0) {
    throw new Error("A revision cannot be queued before the active composition origin.");
  }

  const localPosition = subtractTransportSeconds(queuedAt, session.activeFrom);
  const duration = session.active.composition.macroCycleDuration;
  const completedMacroCycles =
    (localPosition.secondsNumerator * duration.secondsDenominator) /
    (localPosition.secondsDenominator * duration.secondsNumerator);
  const activatesAt = addTransportSeconds(
    session.activeFrom,
    multiplyTransportSeconds(duration, completedMacroCycles + 1n),
  );

  return Object.freeze({
    ...session,
    pending: Object.freeze({
      authority: createProductionRhythmAuthority(composition),
      activatesAt,
    }),
  });
}

/**
 * Advance a pure revision session over [previous, current). Every position is
 * supplied by the caller; this object has no clock, timer, or transport loop.
 */
export function advanceCompositionRevisionSession(
  session: CompositionRevisionSession,
  previousInput: TransportPositionInput,
  currentInput: TransportPositionInput,
): CompositionSessionAdvance {
  const previous = normalizeTransportInput(previousInput);
  const current = normalizeTransportInput(currentInput);
  if (compareTransportSeconds(previous, current) > 0) {
    throw new Error("Composition sessions require monotonic supplied transport positions.");
  }
  if (compareTransportSeconds(previous, session.activeFrom) < 0) {
    throw new Error("Composition session window begins before the active composition origin.");
  }

  const pending = session.pending;
  if (!pending || compareTransportSeconds(current, pending.activatesAt) < 0) {
    const localPrevious = subtractTransportSeconds(previous, session.activeFrom);
    const localCurrent = subtractTransportSeconds(current, session.activeFrom);
    return Object.freeze({
      session,
      input: buildInput(
        session.active,
        current,
        localCurrent,
        envelopeEvents(
          session.active,
          session.activeFrom,
          session.active.timeline.eventsBetween(localPrevious, localCurrent),
        ),
      ),
    });
  }

  const oldWindowEnd = pending.activatesAt;
  const oldEvents =
    compareTransportSeconds(previous, oldWindowEnd) < 0
      ? envelopeEvents(
          session.active,
          session.activeFrom,
          session.active.timeline.eventsBetween(
            subtractTransportSeconds(previous, session.activeFrom),
            subtractTransportSeconds(oldWindowEnd, session.activeFrom),
          ),
        )
      : Object.freeze([]);
  const newWindowStart =
    compareTransportSeconds(previous, pending.activatesAt) < 0
      ? exactTransportSeconds(0n)
      : subtractTransportSeconds(previous, pending.activatesAt);
  const newWindowEnd = subtractTransportSeconds(current, pending.activatesAt);
  const newEvents = envelopeEvents(
    pending.authority,
    pending.activatesAt,
    pending.authority.timeline.eventsBetween(newWindowStart, newWindowEnd),
  );
  const nextSession = Object.freeze({
    active: pending.authority,
    activeFrom: pending.activatesAt,
    pending: null,
  });

  return Object.freeze({
    session: nextSession,
    input: buildInput(
      pending.authority,
      current,
      newWindowEnd,
      Object.freeze([...oldEvents, ...newEvents]),
    ),
  });
}

function buildInput(
  authority: ProductionRhythmAuthority,
  suppliedPosition: ExactTransportSeconds,
  compositionPosition: ExactTransportSeconds,
  events: readonly ProductionTimelineEvent[],
): ProductionTriggerEngineInput {
  return Object.freeze({
    composition: authority.composition,
    suppliedTransportPosition: suppliedPosition,
    compositionTransportPosition: compositionPosition,
    snapshot: authority.timeline.snapshotAt(compositionPosition),
    events,
  });
}

function envelopeEvents(
  authority: ProductionRhythmAuthority,
  compositionOrigin: ExactTransportSeconds,
  events: readonly AuthoritativeRhythmEvent[],
): readonly ProductionTimelineEvent[] {
  const duration = authority.composition.macroCycleDuration;
  return Object.freeze(
    events.map((event) => {
      const compositionTransportOccurrence = exactTransportSeconds(
        event.macroPosition.numerator * duration.secondsNumerator,
        event.macroPosition.denominator * duration.secondsDenominator,
      );
      return Object.freeze({
        id: event.id,
        compositionId: event.compositionId,
        compositionRevision: event.compositionVersion,
        voiceId: event.voiceId,
        voiceOrder: event.voiceOrder,
        voiceCount: authority.composition.voices.length,
        voiceEventIndex: event.voiceEventIndex,
        eventInMacroCycle: event.eventInMacroCycle,
        exactMacroPosition: event.macroPosition,
        compositionTransportOccurrence,
        suppliedTransportOccurrence: addTransportSeconds(
          compositionOrigin,
          compositionTransportOccurrence,
        ),
        authoritativeEvent: event,
      });
    }),
  );
}
