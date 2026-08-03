import {
  AuthoritativeEnginePrototype,
  type AuthoritativeFrameRenderer,
} from "./AuthoritativeEnginePrototype";
import {
  orbitalMacroSeconds,
  orbitalPointAtPhase,
  R4_ORBITAL_GEOMETRY,
} from "@/lib/rhythm/orbitalFamily";
import { r4OrbitalRuntime } from "@/lib/rhythm/orbitalRuntime";
import { ticksToSeconds } from "@/lib/rhythm/referenceAuthority";

const EVENT_VISUAL_SECONDS = 1.2;

export function R4OrbitalPrototype() {
  return (
    <AuthoritativeEnginePrototype
      runtime={r4OrbitalRuntime}
      stageLabel="Reset R4.2 · radial family candidate"
      title="Orbital Sweep"
      description="Eight voices share four restrained orbits and one exact north gate. The event defines contact; the canvas only reveals it."
      canvasLabel="Eight Orbital Sweep voices derived from one authoritative musical position"
      closureSeconds={orbitalMacroSeconds()}
      drawFrame={drawOrbitalFrame}
      footerNote="Provisional family candidate · four truthful orbits · no collision-derived notes"
    />
  );
}

const drawOrbitalFrame: AuthoritativeFrameRenderer = (
  context,
  width,
  height,
  snapshot,
  events,
  reducedMotion,
) => {
  const centerX = width * 0.5;
  const centerY = Math.max(210, Math.min(height * 0.43, height - 245));
  const maximumRadius = Math.max(110, Math.min(width * 0.29, height * 0.36, 285));

  const background = context.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    Math.max(width, height) * 0.72,
  );
  background.addColorStop(0, "#173a42");
  background.addColorStop(0.22, "#0c252d");
  background.addColorStop(0.58, "#081a21");
  background.addColorStop(1, "#040d12");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const recentByVoice = new Map<string, (typeof events)[number]>();
  const voiceById = new Map(snapshot.voices.map((voice) => [voice.id, voice]));
  for (const event of events) recentByVoice.set(event.voiceId, event);

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";

  const uniqueRadii = [...new Set(R4_ORBITAL_GEOMETRY.map((geometry) => geometry.radius))];
  for (const radiusNorm of uniqueRadii) {
    context.strokeStyle = "oklch(0.76 0.06 215 / 0.18)";
    context.lineWidth = 0.75;
    context.beginPath();
    context.arc(centerX, centerY, radiusNorm * maximumRadius, 0, Math.PI * 2);
    context.stroke();
  }

  context.strokeStyle = "oklch(0.9 0.06 205 / 0.25)";
  context.lineWidth = 0.8;
  context.beginPath();
  context.moveTo(centerX, centerY - maximumRadius * 0.92);
  context.lineTo(centerX, centerY);
  context.stroke();

  for (const geometry of R4_ORBITAL_GEOMETRY) {
    const voice = voiceById.get(geometry.voiceId);
    if (!voice) continue;

    const event = recentByVoice.get(voice.id);
    const eventAge = event
      ? Math.max(0, ticksToSeconds(snapshot.positionTick - event.tick))
      : EVENT_VISUAL_SECONDS;
    const eventEnergy = Math.max(0, 1 - eventAge / EVENT_VISUAL_SECONDS);
    const hue = voice.hue;
    const point = orbitalPointAtPhase(
      geometry,
      reducedMotion ? Math.round(voice.phase * 24) / 24 : voice.phase,
    );
    const nodeX = centerX + point.x * maximumRadius;
    const nodeY = centerY + point.y * maximumRadius;
    const gateY = centerY - geometry.radius * maximumRadius;

    context.strokeStyle = `oklch(0.78 0.09 ${hue} / 0.17)`;
    context.lineWidth = 0.65;
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(nodeX, nodeY);
    context.stroke();

    context.strokeStyle = `oklch(0.9 0.13 ${hue} / ${0.18 + eventEnergy * 0.62})`;
    context.lineWidth = 1 + eventEnergy * 1.5;
    context.beginPath();
    context.arc(centerX, gateY, 5 + eventEnergy * 4, 0, Math.PI * 2);
    context.stroke();

    const nodeRadius = 15 + eventEnergy * 9;
    const nodeGlow = context.createRadialGradient(nodeX, nodeY, 0, nodeX, nodeY, nodeRadius);
    nodeGlow.addColorStop(0, `oklch(0.97 0.12 ${hue} / 0.94)`);
    nodeGlow.addColorStop(0.24, `oklch(0.84 0.17 ${hue} / 0.72)`);
    nodeGlow.addColorStop(1, `oklch(0.64 0.13 ${hue} / 0)`);
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
        return Math.max(0, 1 - age / 1.5);
      }),
  );
  const coreRadius = 20 + phaseZeroEnergy * 28;
  const core = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius);
  core.addColorStop(0, `rgba(220, 255, 249, ${0.6 + phaseZeroEnergy * 0.34})`);
  core.addColorStop(0.18, `rgba(92, 218, 211, ${0.25 + phaseZeroEnergy * 0.36})`);
  core.addColorStop(1, "rgba(70, 180, 190, 0)");
  context.fillStyle = core;
  context.beginPath();
  context.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
  context.fill();

  context.restore();
};
