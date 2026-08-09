import {
  projectFrameSource,
  projectVoice,
  type TriggerFamilyAuthorityInput,
  type TriggerFamilyFrameSource,
} from "./triggerFamilyConsumer";

export type StringNetworkPoint = Readonly<{ x: number; y: number }>;

export type StringVoiceGeometry = Readonly<{
  voiceId: string;
  hue: number;
  from: StringNetworkPoint;
  to: StringNetworkPoint;
  bow: number;
  order: number;
}>;

export type StringVoiceState = StringVoiceGeometry &
  Readonly<{
    phaseForRendering: number;
    control: StringNetworkPoint;
    point: StringNetworkPoint;
    authoritativeEventIds: readonly string[];
    hasPhaseZeroEvent: boolean;
  }>;

export type StringNetworkFamilyFrame = Readonly<{
  source: TriggerFamilyFrameSource;
  strings: readonly StringVoiceState[];
}>;

const ANCHORS = {
  northwest: { x: -0.72, y: -0.4 },
  north: { x: -0.08, y: -0.76 },
  northeast: { x: 0.7, y: -0.34 },
  southeast: { x: 0.66, y: 0.5 },
  south: { x: 0.04, y: 0.76 },
  southwest: { x: -0.68, y: 0.46 },
} as const;

const STRING_PATHS = [
  { from: ANCHORS.northwest, to: ANCHORS.southeast, bow: -0.14 },
  { from: ANCHORS.north, to: ANCHORS.southwest, bow: 0.18 },
  { from: ANCHORS.northeast, to: ANCHORS.south, bow: -0.16 },
  { from: ANCHORS.southeast, to: ANCHORS.north, bow: 0.12 },
  { from: ANCHORS.south, to: ANCHORS.northwest, bow: -0.2 },
  { from: ANCHORS.southwest, to: ANCHORS.northeast, bow: 0.15 },
] as const;

const STRING_EVENT_COUNTS = [4, 5, 6, 8, 10, 12] as const;

/** Six curved anchor paths preserved from the Reset R4.3 experiment. */
export const R4_STRING_NETWORK_GEOMETRY: readonly StringVoiceGeometry[] = Object.freeze(
  STRING_EVENT_COUNTS.map((eventCount, order) =>
    Object.freeze({
      voiceId: `rate-${eventCount}`,
      hue: 176 + order * 18,
      ...STRING_PATHS[order],
      order,
    }),
  ),
);

export function stringControlPoint(
  geometry: Pick<StringVoiceGeometry, "from" | "to" | "bow">,
): StringNetworkPoint {
  const dx = geometry.to.x - geometry.from.x;
  const dy = geometry.to.y - geometry.from.y;
  return Object.freeze({
    x: (geometry.from.x + geometry.to.x) * 0.5 - dy * geometry.bow,
    y: (geometry.from.y + geometry.to.y) * 0.5 + dx * geometry.bow,
  });
}

export function stringPointAtPhase(
  geometry: Pick<StringVoiceGeometry, "from" | "to" | "bow">,
  phaseForRendering: number,
): StringNetworkPoint {
  const wrappedPhase = ((phaseForRendering % 1) + 1) % 1;
  const travel = (1 - Math.cos(wrappedPhase * Math.PI * 2)) * 0.5;
  const inverse = 1 - travel;
  const control = stringControlPoint(geometry);

  return Object.freeze({
    x:
      inverse * inverse * geometry.from.x +
      2 * inverse * travel * control.x +
      travel * travel * geometry.to.x,
    y:
      inverse * inverse * geometry.from.y +
      2 * inverse * travel * control.y +
      travel * travel * geometry.to.y,
  });
}

/** Derive String Network geometry exclusively from injected authority. */
export function deriveStringNetworkFrame(
  input: TriggerFamilyAuthorityInput,
): StringNetworkFamilyFrame {
  const strings = R4_STRING_NETWORK_GEOMETRY.map((definition) => {
    const voice = projectVoice(input, definition.voiceId);
    return Object.freeze({
      ...definition,
      phaseForRendering: voice.phaseForRendering,
      control: stringControlPoint(definition),
      point: stringPointAtPhase(definition, voice.phaseForRendering),
      authoritativeEventIds: voice.authoritativeEventIds,
      hasPhaseZeroEvent: voice.hasPhaseZeroEvent,
    });
  });

  return Object.freeze({
    source: projectFrameSource(input.snapshot),
    strings: Object.freeze(strings),
  });
}
