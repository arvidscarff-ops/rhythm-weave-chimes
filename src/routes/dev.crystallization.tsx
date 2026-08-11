/**
 * SYS-001 Step 11A originality spike. Development-only and non-canon.
 *
 * engineClock supplies the only live musical position. Exact authoritative
 * events produce relationship candidates; this route only presents and lets a
 * player preserve them visually for the current laboratory session.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CrystallizationLabVisual } from "@/components/rhythm/labs/CrystallizationLabVisual";
import { engineClock } from "@/lib/engine/clock";
import { installEngineClockVisibilityFreeze } from "@/lib/engine/visibilityFreeze";
import {
  compareTransportSeconds,
  createLiveTimelineAdapter,
  exactTransportSeconds,
  transportSecondsFromNumber,
  transportSecondsToNumber,
  type ExactTransportSeconds,
} from "@/lib/rhythm/liveTimelineAdapter";
import {
  compositionTimelineDefinition,
  createCompositionSnapshot,
  orderedPhaseAlignedVoices,
} from "@/lib/rhythm/compositionSnapshot";
import {
  createCrystallizationState,
  reduceCrystallizationState,
  type CrystallizationState,
} from "@/lib/rhythm/crystallizationState";
import { createRelationshipCandidateModel } from "@/lib/rhythm/relationshipCandidates";

export const Route = createFileRoute("/dev/crystallization")({
  ssr: false,
  component: CrystallizationLabRoute,
  head: () => ({
    meta: [
      { title: "SYS-001 Crystallization Spike · Dev" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Developer-only proof of exact rhythm relationship candidates and non-musical visual crystallization.",
      },
    ],
  }),
});

const LAB_COMPOSITION = createCompositionSnapshot({
  id: "sys-001-crystallization-spike",
  revision: 1,
  macroCycleDuration: exactTransportSeconds(24n),
  baseLaps: 3,
  orderedVoices: orderedPhaseAlignedVoices("crystal-seed", 6),
});
const LAB_TIMELINE_DEFINITION = compositionTimelineDefinition(LAB_COMPOSITION);
const RECENT_CANDIDATE_LIMIT = 5;

type LabFrame = Readonly<{
  transportPosition: ExactTransportSeconds;
  snapshot: ReturnType<ReturnType<typeof createLiveTimelineAdapter>["snapshotAt"]>;
}>;

function CrystallizationLabRoute() {
  const adapter = useMemo(
    () =>
      createLiveTimelineAdapter({
        composition: LAB_TIMELINE_DEFINITION,
        macroCycleDuration: LAB_COMPOSITION.macroCycleDuration,
      }),
    [],
  );
  const candidateModel = useMemo(
    () => createRelationshipCandidateModel(adapter.timeline),
    [adapter],
  );
  const initialPosition = useMemo(() => exactTransportSeconds(0n), []);
  const [crystallization, setCrystallization] = useState<CrystallizationState>(() =>
    createCrystallizationState(LAB_TIMELINE_DEFINITION),
  );
  const [frame, setFrame] = useState<LabFrame>(() => ({
    transportPosition: initialPosition,
    snapshot: adapter.snapshotAt(initialPosition),
  }));
  const [playing, setPlaying] = useState(true);
  const previousPositionRef = useRef<ExactTransportSeconds>(initialPosition);

  const restart = useCallback(() => {
    engineClock.pause();
    engineClock.setSpeed(1);
    engineClock.resetPhaseZero();
    const origin = exactTransportSeconds(0n);
    previousPositionRef.current = origin;
    setCrystallization(createCrystallizationState(LAB_TIMELINE_DEFINITION));
    setFrame({
      transportPosition: origin,
      snapshot: adapter.snapshotAt(origin),
    });
    engineClock.resume();
    setPlaying(true);
  }, [adapter]);

  useEffect(() => {
    const removeVisibilityFreeze = installEngineClockVisibilityFreeze();
    restart();
    let animationFrame = 0;

    const sample = () => {
      const current = transportSecondsFromNumber(Math.max(0, engineClock.t()));
      let previous = previousPositionRef.current;
      if (compareTransportSeconds(current, previous) < 0) previous = exactTransportSeconds(0n);

      if (compareTransportSeconds(current, previous) > 0) {
        const candidates = candidateModel.candidatesBetween(
          adapter.macroPositionAt(previous),
          adapter.macroPositionAt(current),
        );
        if (candidates.length > 0) {
          setCrystallization((state) =>
            reduceCrystallizationState(state, { type: "observe", candidates }),
          );
        }
        previousPositionRef.current = current;
        setFrame({
          transportPosition: current,
          snapshot: adapter.snapshotAt(current),
        });
      }
      animationFrame = requestAnimationFrame(sample);
    };

    animationFrame = requestAnimationFrame(sample);
    return () => {
      cancelAnimationFrame(animationFrame);
      removeVisibilityFreeze();
      engineClock.pause();
    };
  }, [adapter, candidateModel, restart]);

  const togglePlayback = () => {
    if (engineClock.isPaused()) {
      engineClock.resume();
      setPlaying(true);
    } else {
      engineClock.pause();
      setPlaying(false);
    }
  };

  const crystallize = (candidateId: string) => {
    setCrystallization((state) =>
      reduceCrystallizationState(state, { type: "crystallize", candidateId }),
    );
  };

  const release = (candidateId: string) => {
    setCrystallization((state) =>
      reduceCrystallizationState(state, { type: "release", candidateId }),
    );
  };

  const recentCandidates = [...crystallization.candidateHistory].slice(-8).reverse();
  const availableCandidateIds = crystallization.candidateHistory
    .slice(-RECENT_CANDIDATE_LIMIT)
    .map((candidate) => candidate.id);
  const seconds = transportSecondsToNumber(frame.transportPosition);

  return (
    <main className="min-h-screen bg-[#02090d] px-4 py-6 text-[#e3f2ef] sm:px-7 lg:py-9">
      <div className="mx-auto max-w-[96rem]">
        <header className="grid gap-6 border-b border-cyan-100/10 pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-cyan-100/35">
              SYS-001 · Step 11A · isolated originality spike
            </p>
            <h1 className="mt-3 max-w-4xl text-2xl font-light tracking-[0.12em] text-white sm:text-4xl">
              Exact relationships, optionally held
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-cyan-50/50">
              The seed composition is complete before interaction. Exact coincident voice events
              reveal temporary structures; crystallizing one preserves only its visual relation.
              Music, event topology, movement, and journey state remain untouched.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={togglePlayback}
              className="border border-cyan-100/20 bg-cyan-100/[0.04] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-50/70 hover:border-cyan-100/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100/70"
            >
              {playing ? "Pause observation" : "Resume observation"}
            </button>
            <button
              type="button"
              onClick={restart}
              className="border border-cyan-100/10 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-50/45 hover:border-cyan-100/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100/70"
            >
              Restart seed
            </button>
          </div>
        </header>

        <dl className="grid gap-px border-x border-b border-cyan-100/10 bg-cyan-100/10 font-mono text-[8px] uppercase tracking-[0.16em] sm:grid-cols-2 lg:grid-cols-6">
          <Metric
            label="Composition"
            value={`${frame.snapshot.compositionId}@${frame.snapshot.compositionVersion}`}
          />
          <Metric label="Transport" value={`${seconds.toFixed(3)} s`} />
          <Metric label="Macro cycle" value={frame.snapshot.macroCycleIndex.toString()} />
          <Metric
            label="Exact phase"
            value={`${frame.snapshot.macroPhase.numerator}/${frame.snapshot.macroPhase.denominator}`}
          />
          <Metric
            label="Candidates seen"
            value={crystallization.candidateHistory.length.toString()}
          />
          <Metric label="Crystallized" value={crystallization.crystallized.length.toString()} />
        </dl>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <section aria-label="Crystallization visual laboratory">
            <CrystallizationLabVisual
              snapshot={frame.snapshot}
              state={crystallization}
              availableCandidateIds={availableCandidateIds}
            />
            <p className="mt-3 font-mono text-[8px] uppercase tracking-[0.15em] text-cyan-50/25">
              Dashed structures are exact candidates. Bright solid structures are session-only
              visual crystallizations. Geometry cannot submit candidates.
            </p>
          </section>

          <aside className="grid content-start gap-5">
            <section className="border border-cyan-100/12 bg-cyan-100/[0.025] p-4">
              <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-cyan-50/30">
                Core voices
              </p>
              <div className="mt-4 grid grid-cols-3 gap-px bg-cyan-100/10">
                {frame.snapshot.voices.map((voice) => (
                  <div key={voice.id} className="bg-[#041016] px-3 py-3">
                    <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-cyan-50/35">
                      {voice.id.replace("crystal-seed:voice:", "Voice ")}
                    </p>
                    <p className="mt-1 font-mono text-xs text-cyan-50/75">
                      {LAB_COMPOSITION.voices[voice.voiceOrder].eventsPerMacroCycle}/cycle
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="border border-cyan-100/12 bg-cyan-100/[0.025] p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-cyan-50/30">
                  Candidate history
                </p>
                <span className="font-mono text-[8px] text-cyan-50/20">latest 8</span>
              </div>
              <div className="mt-3 grid gap-2">
                {recentCandidates.length === 0 ? (
                  <p className="py-3 text-xs leading-5 text-cyan-50/35">
                    Observing the first exact relationship…
                  </p>
                ) : (
                  recentCandidates.map((candidate) => {
                    const selected = crystallization.crystallized.some(
                      (entry) => entry.candidateId === candidate.id,
                    );
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() =>
                          selected ? release(candidate.id) : crystallize(candidate.id)
                        }
                        className="group border border-cyan-100/10 bg-[#041016] px-3 py-3 text-left hover:border-cyan-100/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100/70"
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span>
                            <span className="block font-mono text-[8px] uppercase tracking-[0.14em] text-cyan-50/55">
                              {candidate.type === "phase-zero-constellation"
                                ? "Phase Zero constellation"
                                : `${candidate.voiceIds.length}-voice alignment`}
                            </span>
                            <span className="mt-1 block font-mono text-[8px] text-cyan-50/25">
                              {candidate.macroPosition.numerator}/
                              {candidate.macroPosition.denominator}
                            </span>
                          </span>
                          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-cyan-50/30 group-hover:text-cyan-50/60">
                            {selected ? "Release" : "Crystallize"}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className="border border-cyan-100/12 bg-cyan-100/[0.025] p-4">
              <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-cyan-50/30">
                Persistent this session
              </p>
              {crystallization.crystallized.length === 0 ? (
                <p className="mt-3 text-xs leading-5 text-cyan-50/35">
                  Optional. The composition continues coherently without selection.
                </p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {crystallization.crystallized.map((entry) => (
                    <li key={entry.id} className="border-l border-cyan-100/35 pl-3">
                      <p className="font-mono text-[8px] uppercase tracking-[0.13em] text-cyan-50/55">
                        {entry.candidate.voiceIds.length} voices · command {entry.commandOrder + 1}
                      </p>
                      <p
                        className="mt-1 truncate font-mono text-[7px] text-cyan-50/20"
                        title={entry.relationshipId}
                      >
                        {entry.relationshipId}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>

        <footer className="mt-8 border-t border-cyan-100/10 pt-4 text-xs leading-6 text-cyan-50/35">
          Experimental boundary: no new notes, no composition revision, no progression, no Studio
          publication, no First Crossing integration, and no final Trigger Engine family selection.
        </footer>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-[#041016] px-3 py-3">
      <dt className="text-cyan-50/25">{label}</dt>
      <dd
        className="mt-1 truncate text-[9px] normal-case tracking-normal text-cyan-50/65"
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
