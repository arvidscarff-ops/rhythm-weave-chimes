import {
  AuthoritativeEnginePrototype,
  type AuthoritativeFrameRenderer,
} from "./AuthoritativeEnginePrototype";
import {
  pendulumDistanceAtPhase,
  pendulumMacroSeconds,
  R4_PENDULUM_STRANDS,
  R4_PENDULUM_TARGET_DISTANCE,
} from "@/lib/rhythm/pendulumFamily";
import { ticksToSeconds } from "@/lib/rhythm/referenceAuthority";
import { r4PendulumRuntime } from "@/lib/rhythm/pendulumRuntime";

const EVENT_VISUAL_SECONDS = 1.35;

export function R4PendulumPrototype() {
  return (
    <AuthoritativeEnginePrototype
      runtime={r4PendulumRuntime}
      stageLabel="Reset R4.1 · initial engine family"
      title="Harmonic Pendulum"
      description="Preserved fan geometry, now driven by one exact event authority. Contact represents the note—it never causes it."
      canvasLabel="Nine Pendulum Fan voices derived from one authoritative musical position"
      closureSeconds={pendulumMacroSeconds()}
      drawFrame={drawPendulumFrame}
      footerNote="Provisional fixture · remount preserves canonical position · hidden-tab product policy remains unresolved"
    />
  );
}

const drawPendulumFrame: AuthoritativeFrameRenderer = (
  context,
  width,
  height,
  snapshot,
  events,
  reducedMotion,
) => {
  const background = context.createRadialGradient(
    width * 0.5,
    height * 0.28,
    0,
    width * 0.5,
    height * 0.42,
    Math.max(width, height) * 0.78,
  );
  background.addColorStop(0, "#16434a");
  background.addColorStop(0.4, "#0b2830");
  background.addColorStop(1, "#051116");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const anchorX = width * 0.5;
  const anchorY = Math.max(120, height * 0.15);
  const stringLength = Math.max(190, Math.min(height * 0.61, width * 0.58, 520));
  const recentByVoice = new Map<string, (typeof events)[number]>();
  const voiceById = new Map(snapshot.voices.map((voice) => [voice.id, voice]));
  for (const event of events) recentByVoice.set(event.voiceId, event);

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";

  for (const strand of R4_PENDULUM_STRANDS) {
    const voice = voiceById.get(strand.voiceId);
    if (!voice) continue;

    const hue = voice.hue;
    const tipX = anchorX + Math.sin(strand.angle) * stringLength;
    const tipY = anchorY + Math.cos(strand.angle) * stringLength;
    const targetX = anchorX + Math.sin(strand.angle) * stringLength * R4_PENDULUM_TARGET_DISTANCE;
    const targetY = anchorY + Math.cos(strand.angle) * stringLength * R4_PENDULUM_TARGET_DISTANCE;

    const event = recentByVoice.get(voice.id);
    const eventAge = event
      ? Math.max(0, ticksToSeconds(snapshot.positionTick - event.tick))
      : EVENT_VISUAL_SECONDS;
    const eventEnergy = Math.max(0, 1 - eventAge / EVENT_VISUAL_SECONDS);

    context.strokeStyle = `oklch(0.78 0.08 ${hue} / ${0.2 + strand.order * 0.009})`;
    context.lineWidth = 0.8;
    context.beginPath();
    context.moveTo(anchorX, anchorY);
    context.lineTo(tipX, tipY);
    context.stroke();

    context.strokeStyle = `oklch(0.88 0.12 ${hue} / ${0.2 + eventEnergy * 0.68})`;
    context.lineWidth = 1 + eventEnergy * 1.8;
    context.beginPath();
    context.arc(targetX, targetY, 6 + eventEnergy * 5, 0, Math.PI * 2);
    context.stroke();

    const targetGlow = context.createRadialGradient(
      targetX,
      targetY,
      0,
      targetX,
      targetY,
      35 + eventEnergy * 15,
    );
    targetGlow.addColorStop(0, `oklch(0.94 0.13 ${hue} / ${0.08 + eventEnergy * 0.68})`);
    targetGlow.addColorStop(1, `oklch(0.68 0.12 ${hue} / 0)`);
    context.fillStyle = targetGlow;
    context.beginPath();
    context.arc(targetX, targetY, 35 + eventEnergy * 15, 0, Math.PI * 2);
    context.fill();

    const distance = reducedMotion
      ? 0.59 + voice.phase * 0.13
      : pendulumDistanceAtPhase(voice.phase);
    const nodeX = anchorX + Math.sin(strand.angle) * stringLength * distance;
    const nodeY = anchorY + Math.cos(strand.angle) * stringLength * distance;
    const nodeRadius = reducedMotion ? 12 : 17 + eventEnergy * 9;
    const nodeGlow = context.createRadialGradient(nodeX, nodeY, 0, nodeX, nodeY, nodeRadius);
    nodeGlow.addColorStop(0, `oklch(0.97 0.11 ${hue} / 0.94)`);
    nodeGlow.addColorStop(0.2, `oklch(0.86 0.16 ${hue} / 0.76)`);
    nodeGlow.addColorStop(1, `oklch(0.66 0.14 ${hue} / 0)`);
    context.fillStyle = nodeGlow;
    context.beginPath();
    context.arc(nodeX, nodeY, nodeRadius, 0, Math.PI * 2);
    context.fill();
  }

  const phaseZeroEnergy = Math.max(
    0,
    ...events
      .filter((event) => event.isPhaseZero)
      .map((event) => {
        const age = ticksToSeconds(snapshot.positionTick - event.tick);
        return Math.max(0, 1 - age / 1.6);
      }),
  );
  const anchorGlow = context.createRadialGradient(
    anchorX,
    anchorY,
    0,
    anchorX,
    anchorY,
    24 + phaseZeroEnergy * 32,
  );
  anchorGlow.addColorStop(0, `rgba(226, 255, 249, ${0.72 + phaseZeroEnergy * 0.24})`);
  anchorGlow.addColorStop(1, "rgba(120, 230, 221, 0)");
  context.fillStyle = anchorGlow;
  context.beginPath();
  context.arc(anchorX, anchorY, 24 + phaseZeroEnergy * 32, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = `rgba(220, 255, 249, ${0.2 + phaseZeroEnergy * 0.58})`;
  context.lineWidth = 1 + phaseZeroEnergy * 2;
  context.beginPath();
  context.arc(anchorX, anchorY, 9 + phaseZeroEnergy * 8, 0, Math.PI * 2);
  context.stroke();
  context.restore();
};
