/**
 * Historical Wheel / Pendulum / Bars comparison surface.
 *
 * These engines intentionally retain their old frame/collision/wrap timing
 * and audio behavior for reference. They are non-authoritative, are excluded
 * from the production player, and must not be copied as Trigger Engine
 * architecture.
 */
import { createFileRoute } from "@tanstack/react-router";
import { PhaseApp } from "@/routes/index";

export const Route = createFileRoute("/dev/legacy-rhythm")({
  ssr: false,
  component: LegacyRhythmLab,
  head: () => ({
    meta: [
      { title: "Legacy Rhythm Experiments · Dev" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Historical, non-authoritative Wheel, Pendulum, and Bars experiments preserved for parity and reference.",
      },
    ],
  }),
});

function LegacyRhythmLab() {
  return <PhaseApp sceneAccess="legacy" />;
}
