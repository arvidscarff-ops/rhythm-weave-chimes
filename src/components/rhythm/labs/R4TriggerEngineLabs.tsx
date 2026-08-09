import { useCallback, useEffect, useMemo, useRef } from "react";
import { deriveOrbitalFrame, type OrbitalFamilyFrame } from "@/lib/rhythm/orbitalFamily";
import {
  derivePendulumFrame,
  R4_PENDULUM_TARGET_DISTANCE,
  type PendulumFamilyFrame,
} from "@/lib/rhythm/pendulumFamily";
import {
  deriveStringNetworkFrame,
  type StringNetworkFamilyFrame,
  type StringNetworkPoint,
} from "@/lib/rhythm/stringNetworkFamily";
import type { TriggerFamilyAuthorityInput } from "@/lib/rhythm/triggerFamilyConsumer";

type R4TriggerEngineLabsProps = Readonly<{
  authority: TriggerFamilyAuthorityInput;
}>;

/**
 * Three isolated rendering laboratories fed by the exact same immutable input.
 * No component owns musical time, schedules work, creates audio, or generates
 * events. Canvas redraws are passive projections of supplied state.
 */
export function R4TriggerEngineLabs({ authority }: R4TriggerEngineLabsProps) {
  const pendulum = useMemo(() => derivePendulumFrame(authority), [authority]);
  const orbital = useMemo(() => deriveOrbitalFrame(authority), [authority]);
  const strings = useMemo(() => deriveStringNetworkFrame(authority), [authority]);

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <PendulumLab frame={pendulum} />
      <OrbitalLab frame={orbital} />
      <StringNetworkLab frame={strings} />
    </div>
  );
}

function PendulumLab({ frame }: { frame: PendulumFamilyFrame }) {
  const drawFrame = useCallback(
    (context: CanvasRenderingContext2D, width: number, height: number) => {
      paintBackground(context, width, height, "#16434a", "#061116");
      const anchorX = width * 0.5;
      const anchorY = height * 0.12;
      const length = Math.min(width * 0.55, height * 0.78);

      context.save();
      context.globalCompositeOperation = "screen";
      context.lineCap = "round";

      for (const strand of frame.strands) {
        const targetX = anchorX + Math.sin(strand.angle) * length * R4_PENDULUM_TARGET_DISTANCE;
        const targetY = anchorY + Math.cos(strand.angle) * length * R4_PENDULUM_TARGET_DISTANCE;
        const tipX = anchorX + Math.sin(strand.angle) * length;
        const tipY = anchorY + Math.cos(strand.angle) * length;
        const nodeX = anchorX + Math.sin(strand.angle) * length * strand.distance;
        const nodeY = anchorY + Math.cos(strand.angle) * length * strand.distance;
        const active = strand.authoritativeEventIds.length > 0 ? 1 : 0;

        context.strokeStyle = `oklch(0.78 0.08 ${strand.hue} / 0.24)`;
        context.lineWidth = 0.8;
        context.beginPath();
        context.moveTo(anchorX, anchorY);
        context.lineTo(tipX, tipY);
        context.stroke();

        context.strokeStyle = `oklch(0.9 0.13 ${strand.hue} / ${0.24 + active * 0.62})`;
        context.lineWidth = 1 + active * 1.4;
        context.beginPath();
        context.arc(targetX, targetY, 4 + active * 3, 0, Math.PI * 2);
        context.stroke();

        paintNode(context, nodeX, nodeY, strand.hue, active);
      }

      paintPhaseZero(context, anchorX, anchorY, frame.source.isPhaseZero);
      context.restore();
    },
    [frame],
  );

  return (
    <LabCard
      eyebrow="Reset R4.1 · pure geometry consumer"
      title="Harmonic Pendulum"
      description="Nine fan strands. Authoritative phase places each node; visual contact cannot create a note."
      frame={frame}
      drawFrame={drawFrame}
      canvasLabel="Harmonic Pendulum geometry derived from shared authoritative phase"
      voiceCount={frame.strands.length}
      eventCount={frame.strands.reduce(
        (total, strand) => total + strand.authoritativeEventIds.length,
        0,
      )}
    />
  );
}

function OrbitalLab({ frame }: { frame: OrbitalFamilyFrame }) {
  const drawFrame = useCallback(
    (context: CanvasRenderingContext2D, width: number, height: number) => {
      paintBackground(context, width, height, "#173a42", "#040d12");
      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const scale = Math.min(width, height) * 0.54;

      context.save();
      context.globalCompositeOperation = "screen";
      context.lineCap = "round";

      for (const radius of [...new Set(frame.voices.map((voice) => voice.radius))]) {
        context.strokeStyle = "oklch(0.76 0.06 215 / 0.18)";
        context.lineWidth = 0.75;
        context.beginPath();
        context.arc(centerX, centerY, radius * scale, 0, Math.PI * 2);
        context.stroke();
      }

      context.strokeStyle = "oklch(0.9 0.06 205 / 0.25)";
      context.beginPath();
      context.moveTo(centerX, centerY - scale * 0.92);
      context.lineTo(centerX, centerY);
      context.stroke();

      for (const voice of frame.voices) {
        const active = voice.authoritativeEventIds.length > 0 ? 1 : 0;
        const nodeX = centerX + voice.point.x * scale;
        const nodeY = centerY + voice.point.y * scale;
        const gateY = centerY - voice.radius * scale;

        context.strokeStyle = `oklch(0.78 0.09 ${voice.hue} / 0.17)`;
        context.beginPath();
        context.moveTo(centerX, centerY);
        context.lineTo(nodeX, nodeY);
        context.stroke();

        context.strokeStyle = `oklch(0.9 0.13 ${voice.hue} / ${0.18 + active * 0.62})`;
        context.lineWidth = 1 + active * 1.5;
        context.beginPath();
        context.arc(centerX, gateY, 4 + active * 3, 0, Math.PI * 2);
        context.stroke();

        paintNode(context, nodeX, nodeY, voice.hue, active);
      }

      paintPhaseZero(context, centerX, centerY, frame.source.isPhaseZero);
      context.restore();
    },
    [frame],
  );

  return (
    <LabCard
      eyebrow="Reset R4.2 · pure geometry consumer"
      title="Orbital Sweep"
      description="Eight voices share four rings and one north gate. The canvas reveals authoritative events; it never detects them."
      frame={frame}
      drawFrame={drawFrame}
      canvasLabel="Orbital Sweep geometry derived from shared authoritative phase"
      voiceCount={frame.voices.length}
      eventCount={frame.voices.reduce(
        (total, voice) => total + voice.authoritativeEventIds.length,
        0,
      )}
    />
  );
}

function StringNetworkLab({ frame }: { frame: StringNetworkFamilyFrame }) {
  const drawFrame = useCallback(
    (context: CanvasRenderingContext2D, width: number, height: number) => {
      paintBackground(context, width, height, "#202e39", "#040a0f");
      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const scale = Math.min(width, height) * 0.55;

      context.save();
      context.globalCompositeOperation = "screen";
      context.lineCap = "round";

      for (const string of frame.strings) {
        const active = string.authoritativeEventIds.length > 0 ? 1 : 0;
        const from = toCanvasPoint(string.from, centerX, centerY, scale);
        const to = toCanvasPoint(string.to, centerX, centerY, scale);
        const control = toCanvasPoint(string.control, centerX, centerY, scale);
        const node = toCanvasPoint(string.point, centerX, centerY, scale);

        context.strokeStyle = `oklch(0.79 0.11 ${string.hue} / ${0.16 + active * 0.18})`;
        context.lineWidth = 0.8 + active * 0.7;
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.quadraticCurveTo(control.x, control.y, to.x, to.y);
        context.stroke();

        context.strokeStyle = `oklch(0.91 0.1 ${string.hue} / ${0.26 + active * 0.54})`;
        context.beginPath();
        context.arc(from.x, from.y, 4 + active * 3, 0, Math.PI * 2);
        context.stroke();
        context.beginPath();
        context.arc(to.x, to.y, 3, 0, Math.PI * 2);
        context.stroke();

        paintNode(context, node.x, node.y, string.hue, active);
      }

      if (frame.source.isPhaseZero) {
        context.strokeStyle = "rgba(203, 250, 255, 0.42)";
        context.lineWidth = 1;
        context.beginPath();
        context.arc(centerX, centerY, scale * 0.24, 0, Math.PI * 2);
        context.stroke();
      }
      context.restore();
    },
    [frame],
  );

  return (
    <LabCard
      eyebrow="Reset R4.3 · pure geometry consumer"
      title="Resonant String Network"
      description="Six nodes traverse fixed curved strings. Crossings and proximity remain visual relationships only."
      frame={frame}
      drawFrame={drawFrame}
      canvasLabel="Resonant String Network geometry derived from shared authoritative phase"
      voiceCount={frame.strings.length}
      eventCount={frame.strings.reduce(
        (total, string) => total + string.authoritativeEventIds.length,
        0,
      )}
    />
  );
}

type FamilyFrame = PendulumFamilyFrame | OrbitalFamilyFrame | StringNetworkFamilyFrame;

function LabCard({
  eyebrow,
  title,
  description,
  frame,
  drawFrame,
  canvasLabel,
  voiceCount,
  eventCount,
}: {
  eyebrow: string;
  title: string;
  description: string;
  frame: FamilyFrame;
  drawFrame: CanvasDrawFunction;
  canvasLabel: string;
  voiceCount: number;
  eventCount: number;
}) {
  return (
    <article className="overflow-hidden border border-white/15 bg-[#071217] shadow-[0_18px_55px_rgba(0,0,0,0.24)]">
      <div className="border-b border-white/10 px-4 py-4">
        <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/35">{eyebrow}</p>
        <h2 className="mt-1 text-sm font-medium tracking-[0.12em] text-white/90">{title}</h2>
        <p className="mt-2 min-h-12 text-xs leading-relaxed text-white/45">{description}</p>
      </div>
      <PassiveAuthorityCanvas label={canvasLabel} drawFrame={drawFrame} />
      <dl className="grid grid-cols-3 border-t border-white/10 font-mono text-[8px] uppercase tracking-[0.14em] text-white/35">
        <Metric label="Voices" value={voiceCount.toString()} />
        <Metric label="Injected events" value={eventCount.toString()} />
        <Metric label="Phase Zero" value={frame.source.isPhaseZero ? "Exact" : "—"} />
      </dl>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-white/10 px-3 py-3 last:border-r-0">
      <dt>{label}</dt>
      <dd className="mt-1 text-[10px] tracking-normal text-white/70">{value}</dd>
    </div>
  );
}

type CanvasDrawFunction = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void;

function PassiveAuthorityCanvas({
  label,
  drawFrame,
}: {
  label: string;
  drawFrame: CanvasDrawFunction;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.floor(width * dpr);
      const pixelHeight = Math.floor(height * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFrame(context, width, height);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [drawFrame]);

  return <canvas ref={canvasRef} className="block aspect-[4/3] w-full" aria-label={label} />;
}

function paintBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  innerColor: string,
  outerColor: string,
) {
  const background = context.createRadialGradient(
    width * 0.5,
    height * 0.42,
    0,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.72,
  );
  background.addColorStop(0, innerColor);
  background.addColorStop(1, outerColor);
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
}

function paintNode(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  hue: number,
  active: number,
) {
  const radius = 11 + active * 6;
  const glow = context.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, `oklch(0.97 0.11 ${hue} / 0.94)`);
  glow.addColorStop(0.22, `oklch(0.86 0.17 ${hue} / 0.72)`);
  glow.addColorStop(1, `oklch(0.62 0.13 ${hue} / 0)`);
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function paintPhaseZero(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  isPhaseZero: boolean,
) {
  const radius = isPhaseZero ? 28 : 16;
  const glow = context.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, `rgba(226, 255, 249, ${isPhaseZero ? 0.94 : 0.58})`);
  glow.addColorStop(1, "rgba(120, 230, 221, 0)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

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
