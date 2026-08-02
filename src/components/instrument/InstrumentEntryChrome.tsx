import { Link } from "@tanstack/react-router";
import { Pause, Play, RotateCcw, Share2 } from "lucide-react";
import type { ReactNode } from "react";
import type { RuntimePack } from "@/lib/sound/runtimePacks";

type EntrySceneId =
  | "stringNet"
  | "pendulumFan"
  | "spiralArp"
  | "radialSweep"
  | "mandalaMatrix"
  | "metatronLattice"
  | "fractalNebula"
  | "radialResonator";

const ENTRY_SCENES: Array<{ id: EntrySceneId; label: string }> = [
  { id: "stringNet", label: "String Network" },
  { id: "pendulumFan", label: "Pendulum Fan" },
  { id: "spiralArp", label: "Spiral Arpeggiator" },
  { id: "radialSweep", label: "Radial Sweep" },
  { id: "mandalaMatrix", label: "Mandala Matrix" },
  { id: "metatronLattice", label: "Metatron Lattice" },
  { id: "fractalNebula", label: "Fractal Nebula" },
  { id: "radialResonator", label: "Radial Resonator" },
];

type Props = {
  playing: boolean;
  onTogglePlay: () => void;
  scene: string;
  onScene: (scene: EntrySceneId) => void;
  packs: RuntimePack[];
  packId: string;
  onPackId: (packId: string) => void;
  bpm: number;
  speed: number;
  notesCount: number;
  onBigBang: () => void;
  onShare: () => void;
};

/**
 * Reset R2 entry chrome.
 *
 * This component deliberately owns presentation only. Transport, scene state,
 * musical events, audio, and rendering remain owned by the existing PhaseApp
 * until the authoritative R3 path replaces them.
 */
export function InstrumentEntryChrome({
  playing,
  onTogglePlay,
  scene,
  onScene,
  packs,
  packId,
  onPackId,
  bpm,
  speed,
  notesCount,
  onBigBang,
  onShare,
}: Props) {
  const sceneLabel = ENTRY_SCENES.find((entry) => entry.id === scene)?.label ?? scene;

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-start justify-between gap-4 px-4 py-4 text-white sm:px-7 sm:py-6">
        <div className="pointer-events-auto">
          <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-white/45">
            Generative audiovisual instrument
          </p>
          <div className="mt-1">
            <h1 className="text-lg font-medium tracking-[0.24em] text-white/95 sm:text-xl">
              PHASE
            </h1>
          </div>
        </div>

        <nav
          aria-label="Instrument utilities"
          className="pointer-events-auto flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em]"
        >
          <Link
            to="/studio/packs"
            className="rounded-sm border border-white/15 bg-black/20 px-3 py-2 text-white/65 transition-colors motion-reduce:transition-none hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            My Studio
          </Link>
          <a
            href="/"
            className="hidden rounded-sm border border-transparent px-3 py-2 text-white/40 transition-colors motion-reduce:transition-none hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:inline"
          >
            Current prototype
          </a>
        </nav>
      </header>

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[3] bg-[linear-gradient(180deg,rgba(3,12,16,0.28)_0%,transparent_24%,transparent_65%,rgba(3,10,13,0.48)_100%)]"
      />

      <section
        aria-label="Instrument controls"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5"
      >
        <div className="pointer-events-auto mx-auto max-w-4xl border border-white/15 bg-[oklch(0.16_0.018_220/0.9)] shadow-[0_22px_60px_rgba(0,0,0,0.34)] backdrop-blur-md">
          <div className="flex flex-wrap items-stretch">
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={playing ? "Pause composition" : "Begin composition"}
              className="flex min-h-16 w-full min-w-32 flex-none items-center justify-center gap-3 border-b border-white/10 px-5 text-left text-white transition-colors motion-reduce:transition-none hover:bg-white/[0.06] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 sm:w-auto sm:border-r sm:border-b-0"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-white/[0.05]">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
              </span>
              <span>
                <span className="block font-mono text-[9px] uppercase tracking-[0.24em] text-white/40">
                  Transport
                </span>
                <span className="mt-0.5 block text-sm tracking-wide">
                  {playing ? "Pause" : "Begin"}
                </span>
              </span>
            </button>

            <EntrySelect
              label="Composition"
              value={scene}
              onChange={(value) => onScene(value as EntrySceneId)}
            >
              {ENTRY_SCENES.map((entry) => (
                <option key={entry.id} value={entry.id} className="bg-neutral-950 text-white">
                  {entry.label}
                </option>
              ))}
            </EntrySelect>

            <EntrySelect label="Sound" value={packId} onChange={onPackId}>
              {packs.map((pack) => (
                <option key={pack.id} value={pack.id} className="bg-neutral-950 text-white">
                  {pack.name}
                </option>
              ))}
            </EntrySelect>

            <div className="flex min-h-16 flex-1 items-stretch justify-end border-t border-white/10 sm:min-w-40 sm:border-t-0 sm:border-l">
              <IconButton label="Return to Phase Zero" onClick={onBigBang}>
                <RotateCcw className="h-4 w-4" />
              </IconButton>
              <IconButton label="Share this session" onClick={onShare}>
                <Share2 className="h-4 w-4" />
              </IconButton>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-2 font-mono text-[8px] uppercase tracking-[0.2em] text-white/35 sm:px-5">
            <span className="truncate text-white/55">{sceneLabel}</span>
            <div className="flex shrink-0 items-center gap-3 sm:gap-5">
              <span>{bpm} BPM</span>
              <span>{speed.toFixed(2)}×</span>
              <span>{notesCount} voices</span>
            </div>
          </div>
        </div>
      </section>

      <p className="sr-only" aria-live="polite">
        {playing ? `${sceneLabel} is playing.` : `${sceneLabel} is paused.`}
      </p>
    </>
  );
}

function EntrySelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-h-16 min-w-[50%] flex-1 flex-col justify-center border-b border-white/10 px-4 py-2 text-white sm:min-w-44 sm:border-r sm:border-b-0">
      <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/40">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full cursor-pointer appearance-none bg-transparent pr-6 text-sm tracking-wide text-white outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        {children}
      </select>
    </label>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid min-w-14 flex-1 place-items-center border-l border-white/10 text-white/55 transition-colors motion-reduce:transition-none first:border-l-0 hover:bg-white/[0.06] hover:text-white focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
    >
      {children}
    </button>
  );
}
