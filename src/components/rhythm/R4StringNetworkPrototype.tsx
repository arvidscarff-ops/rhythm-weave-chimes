import {
  AuthoritativeEnginePrototype,
  type AuthoritativeFrameRenderer,
} from "./AuthoritativeEnginePrototype";
import {
  R4_STRING_NETWORK_GEOMETRY,
  stringControlPoint,
  stringNetworkMacroSeconds,
  stringPointAtPhase,
  type StringNetworkPoint,
} from "@/lib/rhythm/stringNetworkFamily";
import { r4StringNetworkRuntime } from "@/lib/rhythm/stringNetworkRuntime";
import { ticksToSeconds } from "@/lib/rhythm/referenceAuthority";

const EVENT_VISUAL_SECONDS = 1.2;

export function R4StringNetworkPrototype() {
  return (
    <AuthoritativeEnginePrototype
      runtime={r4StringNetworkRuntime}
      stageLabel="Reset R4.3 · linear family candidate"
      title="Resonant String Network"
      description="Six voices travel between fixed anchors on curved strings. Every return is authored by musical time; intersections remain silent."
      canvasLabel="Six Resonant String Network voices derived from one authoritative musical position"
      closureSeconds={stringNetworkMacroSeconds()}
      drawFrame={drawStringNetworkFrame}
      footerNote="Provisional family candidate · six truthful strings · no proximity-derived notes"
    />
  );
}

const drawStringNetworkFrame: AuthoritativeFrameRenderer = (
  context,
  width,
  height,
  snapshot,
  events,
  reducedMotion,
) => {
  const centerX = width * 0.5;
  const centerY = Math.max(210, Math.min(height * 0.43, height - 245));
  const scale = Math.max(120, Math.min(width * 0.43, height * 0.34, 330));

  const background = context.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    Math.max(width, height) * 0.75,
  );
  background.addColorStop(0, "#202e39");
  background.addColorStop(0.24, "#101d27");
  background.addColorStop(0.62, "#08131b");
  background.addColorStop(1, "#040a0f");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const recentByVoice = new Map<string, (typeof events)[number]>();
  const voiceById = new Map(snapshot.voices.map((voice) => [voice.id, voice]));
  for (const event of events) recentByVoice.set(event.voiceId, event);

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";

  for (const geometry of R4_STRING_NETWORK_GEOMETRY) {
    const voice = voiceById.get(geometry.voiceId);
    if (!voice) continue;

    const event = recentByVoice.get(voice.id);
    const eventAge = event
      ? Math.max(0, ticksToSeconds(snapshot.positionTick - event.tick))
      : EVENT_VISUAL_SECONDS;
    const eventEnergy = Math.max(0, 1 - eventAge / EVENT_VISUAL_SECONDS);
    const hue = voice.hue;
    const phase = reducedMotion ? Math.round(voice.phase * 24) / 24 : voice.phase;
    const point = stringPointAtPhase(geometry, phase);
    const control = stringControlPoint(geometry);
    const from = toCanvasPoint(geometry.from, centerX, centerY, scale);
    const to = toCanvasPoint(geometry.to, centerX, centerY, scale);
    const controlPoint = toCanvasPoint(control, centerX, centerY, scale);
    const particle = toCanvasPoint(point, centerX, centerY, scale);

    context.strokeStyle = `oklch(0.79 0.11 ${hue} / ${0.16 + eventEnergy * 0.18})`;
    context.lineWidth = 0.8 + eventEnergy * 0.7;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.quadraticCurveTo(controlPoint.x, controlPoint.y, to.x, to.y);
    context.stroke();

    const anchorRadius = 7 + eventEnergy * 5;
    const anchorGlow = context.createRadialGradient(
      from.x,
      from.y,
      0,
      from.x,
      from.y,
      anchorRadius * 2.4,
    );
    anchorGlow.addColorStop(0, `oklch(0.94 0.13 ${hue} / ${0.55 + eventEnergy * 0.36})`);
    anchorGlow.addColorStop(0.28, `oklch(0.76 0.15 ${hue} / ${0.2 + eventEnergy * 0.35})`);
    anchorGlow.addColorStop(1, `oklch(0.58 0.13 ${hue} / 0)`);
    context.fillStyle = anchorGlow;
    context.beginPath();
    context.arc(from.x, from.y, anchorRadius * 2.4, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = `oklch(0.91 0.1 ${hue} / 0.26)`;
    context.lineWidth = 0.75;
    context.beginPath();
    context.arc(to.x, to.y, 4, 0, Math.PI * 2);
    context.stroke();

    const particleRadius = 14 + eventEnergy * 8;
    const particleGlow = context.createRadialGradient(
      particle.x,
      particle.y,
      0,
      particle.x,
      particle.y,
      particleRadius,
    );
    particleGlow.addColorStop(0, `oklch(0.98 0.11 ${hue} / 0.96)`);
    particleGlow.addColorStop(0.22, `oklch(0.86 0.18 ${hue} / 0.72)`);
    particleGlow.addColorStop(1, `oklch(0.62 0.13 ${hue} / 0)`);
    context.fillStyle = particleGlow;
    context.beginPath();
    context.arc(particle.x, particle.y, particleRadius, 0, Math.PI * 2);
    context.fill();
  }

  const phaseZeroEnergy = Math.max(
    0,
    ...events
      .filter((event) => event.isPhaseZero)
      .map((event) => {
        const age = ticksToSeconds(snapshot.positionTick - event.tick);
        return Math.max(0, 1 - age / 1.5);
      }),
  );
  if (phaseZeroEnergy > 0) {
    context.strokeStyle = `rgba(203, 250, 255, ${phaseZeroEnergy * 0.42})`;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(centerX, centerY, scale * (0.14 + phaseZeroEnergy * 0.22), 0, Math.PI * 2);
    context.stroke();
  }

  context.restore();
};

function toCanvasPoint(
  point: StringNetworkPoint,
  centerX: number,
  centerY: number,
  scale: number,
): StringNetworkPoint {
  return {
    x: centerX + point.x * scale,
    y: centerY + point.y * scale,
  };
}
