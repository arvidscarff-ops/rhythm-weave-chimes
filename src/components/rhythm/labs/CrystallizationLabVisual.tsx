import { useMemo } from "react";
import { projectCrystallizationFrame } from "@/lib/rhythm/crystallizationProjection";
import type { CrystallizationState } from "@/lib/rhythm/crystallizationState";
import type { RhythmTimelineSnapshot } from "@/lib/rhythm/authoritativeTimeline";

type CrystallizationLabVisualProps = Readonly<{
  snapshot: RhythmTimelineSnapshot;
  state: CrystallizationState;
  availableCandidateIds: readonly string[];
}>;

const VIEWBOX_SIZE = 720;
const CENTER = VIEWBOX_SIZE / 2;
const SCALE = 300;

/**
 * Experimental radial projection only. Candidate identity has already been
 * decided by the exact rhythm model before this component receives it.
 */
export function CrystallizationLabVisual({
  snapshot,
  state,
  availableCandidateIds,
}: CrystallizationLabVisualProps) {
  const frame = useMemo(
    () => projectCrystallizationFrame({ snapshot, state, availableCandidateIds }),
    [availableCandidateIds, snapshot, state],
  );
  const phaseCircumference = Math.PI * 2 * 326;

  return (
    <div className="relative overflow-hidden border border-cyan-100/15 bg-[#020b10] shadow-[0_30px_100px_rgba(1,20,28,0.65)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_43%,rgba(88,194,204,0.12),transparent_40%),linear-gradient(180deg,rgba(153,225,231,0.04),transparent_45%)]" />
      <svg
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        className="relative aspect-square w-full"
        role="img"
        aria-label="Exact authoritative voice phases with transient relationship candidates and persistent crystallized structures"
      >
        <defs>
          <filter id="crystal-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="crystal-field" cx="50%" cy="46%" r="58%">
            <stop offset="0%" stopColor="#8be8e5" stopOpacity="0.075" />
            <stop offset="55%" stopColor="#2d7e8a" stopOpacity="0.025" />
            <stop offset="100%" stopColor="#02070b" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={CENTER} cy={CENTER} r="332" fill="url(#crystal-field)" />
        {[84, 164, 246, 316].map((radius) => (
          <circle
            key={radius}
            cx={CENTER}
            cy={CENTER}
            r={radius}
            fill="none"
            stroke="rgba(167, 231, 234, 0.09)"
            strokeWidth="1"
          />
        ))}

        {frame.nodes.map((node) => (
          <line
            key={`axis-${node.voiceId}`}
            x1={CENTER}
            y1={CENTER}
            x2={
              CENTER +
              Math.cos(-Math.PI / 2 + (node.voiceOrder / frame.nodes.length) * Math.PI * 2) * 316
            }
            y2={
              CENTER +
              Math.sin(-Math.PI / 2 + (node.voiceOrder / frame.nodes.length) * Math.PI * 2) * 316
            }
            stroke="rgba(162, 226, 230, 0.07)"
            strokeWidth="1"
          />
        ))}

        {frame.relationships.map((relationship) => {
          const points = relationship.points.map((point) => ({
            x: CENTER + point.x * SCALE,
            y: CENTER + point.y * SCALE,
          }));
          const path = points
            .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
            .join(" ");
          const closedPath = points.length > 2 ? `${path} Z` : path;
          const crystallized = relationship.state === "crystallized";

          return (
            <g key={`${relationship.state}-${relationship.candidateId}`}>
              <path
                d={closedPath}
                fill={crystallized && points.length > 2 ? "rgba(113, 226, 218, 0.055)" : "none"}
                stroke={crystallized ? "rgba(171, 255, 238, 0.9)" : "rgba(116, 194, 205, 0.34)"}
                strokeWidth={crystallized ? 2.2 : 1}
                strokeDasharray={crystallized ? undefined : "4 8"}
                filter={crystallized ? "url(#crystal-glow)" : undefined}
              />
              {crystallized
                ? points.map((point, index) => (
                    <circle
                      key={`${relationship.candidateId}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r="8"
                      fill="none"
                      stroke="rgba(190, 255, 242, 0.48)"
                    />
                  ))
                : null}
            </g>
          );
        })}

        {frame.nodes.map((node) => {
          const x = CENTER + node.x * SCALE;
          const y = CENTER + node.y * SCALE;
          const hue = 176 + node.voiceOrder * 13;
          return (
            <g key={node.voiceId}>
              <circle
                cx={x}
                cy={y}
                r="13"
                fill={`oklch(0.78 0.08 ${hue} / 0.09)`}
                stroke={`oklch(0.85 0.1 ${hue} / 0.45)`}
                strokeWidth="1"
              />
              <circle
                cx={x}
                cy={y}
                r="3.5"
                fill={`oklch(0.91 0.12 ${hue})`}
                filter="url(#crystal-glow)"
              />
            </g>
          );
        })}

        <circle
          cx={CENTER}
          cy={CENTER}
          r="326"
          fill="none"
          stroke="rgba(177, 235, 238, 0.08)"
          strokeWidth="2"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r="326"
          fill="none"
          stroke="rgba(168, 244, 239, 0.62)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${phaseCircumference * frame.phaseForRendering} ${phaseCircumference}`}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={snapshot.isPhaseZero ? 16 : 5}
          fill={snapshot.isPhaseZero ? "rgba(197, 255, 242, 0.88)" : "rgba(167, 229, 232, 0.28)"}
          filter={snapshot.isPhaseZero ? "url(#crystal-glow)" : undefined}
        />
      </svg>

      <div className="pointer-events-none absolute inset-x-5 bottom-4 flex items-end justify-between gap-4 font-mono text-[8px] uppercase tracking-[0.18em] text-white/30">
        <span>Radial relationship projection · experimental only</span>
        <span>{frame.relationships.length} visible relations</span>
      </div>
    </div>
  );
}
