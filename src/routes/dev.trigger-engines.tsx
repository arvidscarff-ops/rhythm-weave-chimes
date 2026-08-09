/**
 * Reset R4 comparative geometry laboratory — diagnostic and non-canon.
 *
 * One manually supplied physical transport position enters one pure adapter.
 * All three families receive the exact same immutable snapshot and event batch.
 * This route owns no live clock, animation loop, scheduler, audio, or events.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { R4TriggerEngineLabs } from "@/components/rhythm/labs/R4TriggerEngineLabs";
import { compareMacroPositions } from "@/lib/rhythm/authoritativeTimeline";
import { exactTransportSeconds } from "@/lib/rhythm/liveTimelineAdapter";
import { createR4SharedLabAdapter } from "@/lib/rhythm/r4SharedLab";
import type { TriggerFamilyAuthorityInput } from "@/lib/rhythm/triggerFamilyConsumer";

export const Route = createFileRoute("/dev/trigger-engines")({
  ssr: false,
  component: TriggerEngineFamilyLab,
  head: () => ({
    meta: [
      { title: "Reset R4 Trigger Engine Family Lab · Dev" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Developer-only comparison of three Trigger Engine geometry families consuming one shared authoritative timeline.",
      },
    ],
  }),
});

const PHYSICAL_SAMPLE_DENOMINATOR = 100n;
const MACRO_DURATION_CENTISECONDS = 2_400;

function TriggerEngineFamilyLab() {
  const adapter = useMemo(() => createR4SharedLabAdapter(), []);
  const [transportCentiseconds, setTransportCentiseconds] = useState(0);

  const authority = useMemo<TriggerFamilyAuthorityInput>(() => {
    const position = exactTransportSeconds(
      BigInt(transportCentiseconds),
      PHYSICAL_SAMPLE_DENOMINATOR,
    );
    const nextPhysicalSample = exactTransportSeconds(
      BigInt(transportCentiseconds + 1),
      PHYSICAL_SAMPLE_DENOMINATOR,
    );
    const snapshot = adapter.snapshotAt(position);
    const exactBoundaryEvents = adapter
      .eventsBetween(position, nextPhysicalSample)
      .filter((event) => compareMacroPositions(event.macroPosition, snapshot.macroPosition) === 0);

    return Object.freeze({
      snapshot,
      events: Object.freeze(exactBoundaryEvents),
    });
  }, [adapter, transportCentiseconds]);

  const { snapshot } = authority;
  const seconds = transportCentiseconds / Number(PHYSICAL_SAMPLE_DENOMINATOR);

  return (
    <main className="min-h-screen bg-[#041015] px-4 py-6 text-white sm:px-7">
      <div className="mx-auto max-w-[96rem]">
        <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-white/35">
          Reset reconciliation · isolated development laboratory
        </p>
        <h1 className="mt-2 text-xl font-medium tracking-[0.14em]">
          Shared-authority Trigger Engine families
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/50">
          A manual physical-time input feeds one rational timeline adapter. Pendulum, Orbital, and
          String Network receive the same snapshot and exact event identities. The canvases have no
          musical authority and never run their own clocks.
        </p>

        <section
          className="my-6 border border-white/15 bg-white/[0.025] p-4"
          aria-label="Shared authority controls"
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <label className="block font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">
              Supplied physical transport position · {seconds.toFixed(2)} seconds
              <input
                type="range"
                min={0}
                max={MACRO_DURATION_CENTISECONDS}
                step={1}
                value={transportCentiseconds}
                onChange={(event) => setTransportCentiseconds(Number(event.target.value))}
                className="mt-3 block w-full"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {[0, 600, 1_200, 1_800, 2_400].map((position, index) => (
                <button
                  key={position}
                  type="button"
                  onClick={() => setTransportCentiseconds(position)}
                  className="border border-white/15 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.15em] text-white/55 hover:border-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  {index === 0 || index === 4 ? "Phase Zero" : `${index}/4 cycle`}
                </button>
              ))}
            </div>
          </div>

          <dl className="mt-4 grid gap-px overflow-hidden border border-white/10 bg-white/10 font-mono text-[9px] sm:grid-cols-4">
            <AuthorityMetric
              label="Composition"
              value={`${snapshot.compositionId}@${snapshot.compositionVersion}`}
            />
            <AuthorityMetric label="Macro cycle" value={snapshot.macroCycleIndex.toString()} />
            <AuthorityMetric
              label="Exact macro position"
              value={`${snapshot.macroPosition.numerator}/${snapshot.macroPosition.denominator}`}
            />
            <AuthorityMetric
              label="Events at exact position"
              value={authority.events.length.toString()}
            />
          </dl>
          <p className="mt-3 font-mono text-[8px] uppercase tracking-[0.14em] text-white/25">
            The 0.01-second control increment is diagnostic physical input resolution—not a musical
            tick grid. Musical boundaries remain exact eventIndex / eventCount relationships.
          </p>
        </section>

        <R4TriggerEngineLabs authority={authority} />
      </div>
    </main>
  );
}

function AuthorityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-[#07151b] px-3 py-3">
      <dt className="uppercase tracking-[0.16em] text-white/30">{label}</dt>
      <dd className="mt-1 truncate text-[10px] text-white/70" title={value}>
        {value}
      </dd>
    </div>
  );
}
