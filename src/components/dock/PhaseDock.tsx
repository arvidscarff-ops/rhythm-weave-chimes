import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listMyPresets,
  savePreset,
} from "@/lib/studio/presets.functions";
import { Link } from "@tanstack/react-router";
import {
  Play,
  Pause,
  Layers,
  Sliders,
  Music3,
  Eye,
  MoreHorizontal,
  Sparkles,
  Info,
  Wrench,
  LogIn,
  LogOut,
  Share2,
  FolderOpen,
  Save,
  Shield,
  ListMusic,
  Image as ImageIcon,
  Video,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuPage,
  DropdownMenuPageTrigger,
} from "@/components/ui/material-ui-dropdown-menu";
import {
  REVERB_PRESETS,
  CHORUS_PRESETS,
  GRAIN_PRESETS,
  TONE_PRESETS,
  type FxState,
  type ReverbType,
  type ChorusType,
  type GrainType,
  type ToneType,
} from "@/lib/fx/fxState";
import { NEURAL_PRESETS, type NeuralSettings } from "@/lib/neural/palette";
import type { RuntimePack } from "@/lib/sound/runtimePacks";
import { ROOT_NAMES, type RootName } from "@/lib/music/scales";
import { fetchPublishedScales } from "@/lib/music/scales.functions";
import { listPublishedScenes, type SceneRow } from "@/lib/admin/scenes.functions";
import {
  getActiveScene,
  setActiveScene,
  subscribeActiveScene,
} from "@/lib/scenes/activeScene";
import type { CycleOverride } from "@/lib/engine/cycleOverride";
import { useEffect } from "react";
import {
  type ComposerSettings,
  type SlotSettings,
  type NoteMode,
  patternFor,
} from "@/lib/music/composer";
import { cn } from "@/lib/utils";

export type SceneKind =
  | "wheel"
  | "pendulum"
  | "bars"
  | "stringNet"
  | "pendulumFan"
  | "spiralArp"
  | "radialSweep"
  | "mandalaMatrix"
  | "metatronLattice"
  | "fractalNebula"
  | "radialResonator"
  | "phaseAlignRings"
  | "voidSheets"
  | "custom";

type Props = {
  playing: boolean;
  onTogglePlay: () => void;

  scene: SceneKind;
  onScene: (s: SceneKind) => void;
  multiply: number;
  onMultiply: (n: number) => void;
  /** Resolved number of notes that will actually play in the current scene. */
  notesCount: number;

  bpm: number;
  onBpm: (n: number) => void;
  speed: number;
  onSpeed: (n: number) => void;

  fx: FxState;
  onFx: (s: FxState) => void;

  packs: RuntimePack[];
  packId: string;
  onPackId: (id: string) => void;

  neural: NeuralSettings;
  onNeural: (s: NeuralSettings) => void;

  composer: ComposerSettings;
  onComposer: (s: ComposerSettings) => void;

  authed: boolean;
  email?: string | null;
  onSignOut: () => void;
  onShare: () => void;
  /** Snap scene time to t=0 — every node fires its Big Bang chord. */
  onBigBang: () => void;

  /** Phase-Alignment override + resolved active-scene defaults + writer. */
  cycleOverride: CycleOverride;
  cycleActiveScene: { baseLaps: number; macroCycleSeconds: number; noteCount: number };
  onCycleOverride: (o: CycleOverride) => void;
};

const DOCK_BTN =
  "group relative inline-flex h-10 items-center gap-2 rounded-full px-3 text-[11px] font-medium uppercase tracking-[0.16em] text-foreground/70 hover:text-foreground transition-colors";

export function PhaseDock(p: Props) {
  const sceneShort =
    ENGINE_SCENES.find((s) => s.id === p.scene)?.short ??
    p.scene.slice(0, 3).toUpperCase();
  return (
    <div
      className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2 max-w-[calc(100vw-1rem)]"
      style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', ui-monospace, monospace)" }}
    >
      {/* Metadata strip */}
      <div
        className={cn(
          "pointer-events-auto group/meta mx-auto mb-1.5 flex w-fit items-center justify-center gap-3",
          "text-[10px] tracking-[0.28em] uppercase text-white/[0.10] hover:text-white/40 transition-colors duration-300",
          "select-none",
        )}
      >
        <span>SCN·{sceneShort}</span>
        <span aria-hidden>·</span>
        <span>{p.bpm} BPM</span>
        <span aria-hidden>·</span>
        <span>{p.speed.toFixed(2)}×</span>
        <span aria-hidden>·</span>
        <span>{p.notesCount} NOTES</span>
      </div>
      <div
        className={cn(
          "pointer-events-auto relative flex items-center gap-1 rounded-full",
          "bg-neutral-950/55 backdrop-blur-2xl shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]",
          // 1px masked-gradient border
          "before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:p-px",
          "before:bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.04)_45%,rgba(255,255,255,0.14))]",
          "before:[mask:linear-gradient(#000,#000)_content-box,linear-gradient(#000,#000)] before:[mask-composite:exclude] before:[-webkit-mask-composite:xor]",
          "px-2 py-1.5 overflow-x-auto max-w-[calc(100vw-1rem)] no-scrollbar [&>*]:shrink-0",
        )}
      >
        {/* Transport */}
        <button
          onClick={p.onTogglePlay}
          aria-label={p.playing ? "Pause" : "Play"}
          className={cn(
            DOCK_BTN,
            "h-9 w-9 px-0 justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.10]",
          )}
        >
          {p.playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 translate-x-[1px]" />
          )}
        </button>

        <Divider />

        <SceneMenu
          scene={p.scene}
          onScene={p.onScene}
          multiply={p.multiply}
          onMultiply={p.onMultiply}
          notesCount={p.notesCount}
        />
        <SceneChips scene={p.scene} onScene={p.onScene} />
        <FxMenu fx={p.fx} onFx={p.onFx} />
        <ScalesMenu composer={p.composer} onComposer={p.onComposer} authed={p.authed} />
        <PacksMenu packs={p.packs} packId={p.packId} onPackId={p.onPackId} />
        <VisualsMenu neural={p.neural} onNeural={p.onNeural} />
        <BackdropMenu />
        <CycleMenu
          override={p.cycleOverride}
          defaults={p.cycleActiveScene}
          onOverride={p.onCycleOverride}
        />

        <Divider />

        <InlineSlider
          label="BPM"
          value={p.bpm}
          min={20}
          max={180}
          step={1}
          onChange={p.onBpm}
          suffix=""
        />
        <InlineSlider
          label="SPD"
          value={p.speed}
          min={0.0625}
          max={0.25}
          step={0.01}
          onChange={p.onSpeed}
          suffix="x"
          digits={2}
        />

        <Divider />

        <button
          onClick={p.onShare}
          aria-label="Share session"
          title="Share session"
          className={cn(
            DOCK_BTN,
            "h-9 w-9 px-0 justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.10]",
          )}
        >
          <Share2 className="h-4 w-4" />
        </button>

        <button
          onClick={p.onBigBang}
          aria-label="Big Bang — reset phase to zero"
          title="Big Bang — reset phase to zero"
          className={cn(
            DOCK_BTN,
            "h-9 w-9 px-0 justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.10]",
          )}
        >
          <Sparkles className="h-4 w-4" />
        </button>

        <MoreMenu authed={p.authed} email={p.email} onSignOut={p.onSignOut} />
      </div>
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-white/[0.08]" />;
}

/* =================== Engine scene chips =================== */
const ENGINE_SCENES: { id: SceneKind; label: string; short: string }[] = [
  { id: "stringNet", label: "String Network", short: "STR" },
  { id: "pendulumFan", label: "Pendulum Fan", short: "PEN" },
  { id: "spiralArp", label: "Spiral Arpeggiator", short: "SPI" },
  { id: "radialSweep", label: "Radial Sweep", short: "RAD" },
  { id: "mandalaMatrix", label: "Mandala Matrix", short: "MND" },
  { id: "metatronLattice", label: "Metatron Lattice", short: "MTN" },
  { id: "fractalNebula", label: "Fractal Nebula", short: "NEB" },
  { id: "radialResonator", label: "Radial Resonator", short: "RES" },
  { id: "phaseAlignRings", label: "Phase-Align Rings", short: "PHZ" },
  { id: "voidSheets", label: "Void Sheets", short: "VOD" },
  { id: "custom", label: "Custom (Builder)", short: "CST" },
];

function SceneChips({
  scene,
  onScene,
}: {
  scene: SceneKind;
  onScene: (s: SceneKind) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-white/[0.03] p-0.5">
      {ENGINE_SCENES.map((s) => {
        const active = scene === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onScene(s.id)}
            title={s.label}
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] transition-all",
              active
                ? "bg-white/[0.10] text-foreground shadow-[0_0_18px_-6px_rgba(255,255,255,0.45)] ring-1 ring-white/15"
                : "text-foreground/45 hover:text-foreground/80 hover:bg-white/[0.04]",
            )}
          >
            {s.short}
          </button>
        );
      })}
    </div>
  );
}

function InlineSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix = "",
  digits = 0,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  suffix?: string;
  digits?: number;
}) {
  return (
    <label className="flex items-center gap-2 px-2 text-[10px] uppercase tracking-[0.18em] text-foreground/55">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="dock-range h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/10 accent-foreground"
      />
      <span className="w-8 text-right tabular-nums text-foreground/80">
        {value.toFixed(digits)}
        {suffix}
      </span>
    </label>
  );
}

/* =================== Scene menu =================== */
function SceneMenu({
  scene,
  onScene,
  multiply,
  onMultiply,
  notesCount,
}: {
  scene: SceneKind;
  onScene: (s: SceneKind) => void;
  multiply: number;
  onMultiply: (n: number) => void;
  notesCount: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className={DOCK_BTN}>
        <Layers className="h-4 w-4" /> Scene
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center">
        <DropdownMenuPage id="main">
          <DropdownMenuLabel>Engine</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={scene} onValueChange={(v) => onScene(v as SceneKind)}>
            <DropdownMenuRadioItem value="stringNet">String Network</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="pendulumFan">Pendulum Fan</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="spiralArp">Spiral Arpeggiator</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="radialSweep">Radial Sweep</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="mandalaMatrix">Mandala Matrix</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="metatronLattice">Metatron Lattice</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="fractalNebula">Fractal Nebula</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="radialResonator">Radial Resonator</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="phaseAlignRings">Phase-Align Rings</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="voidSheets">Void Sheets</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="custom">Custom (Builder)</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-foreground/40">Classic</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={scene} onValueChange={(v) => onScene(v as SceneKind)}>
            <DropdownMenuRadioItem value="wheel">Wheel</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="pendulum">Pendulum</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="bars">Bars</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuPageTrigger targetId="multiply">
            Notes <span className="ml-auto text-foreground/50">{notesCount}</span>
          </DropdownMenuPageTrigger>
        </DropdownMenuPage>

        <DropdownMenuPage id="multiply">
          <DropdownMenuLabel>Notes ({notesCount} playing)</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={String(multiply)}
            onValueChange={(v) => onMultiply(Number(v))}
          >
            {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
              <DropdownMenuRadioItem key={n} value={String(n)}>
                {n}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuPage>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* =================== Cycle (Phase-Alignment) menu =================== */
function CycleMenu({
  override,
  defaults,
  onOverride,
}: {
  override: CycleOverride;
  defaults: { baseLaps: number; macroCycleSeconds: number; noteCount: number };
  onOverride: (o: CycleOverride) => void;
}) {
  const [open, setOpen] = useState(false);
  const effB = override.baseLaps ?? defaults.baseLaps;
  const effD = override.macroCycleSeconds ?? defaults.macroCycleSeconds;
  const effN = override.noteCount ?? defaults.noteCount;
  const overridden =
    override.baseLaps !== null || override.macroCycleSeconds !== null || override.noteCount !== null;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className={DOCK_BTN}>
        <Sparkles className="h-4 w-4" /> Cycle
        {overridden && (
          <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-400/80" aria-hidden />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center">
        <DropdownMenuPage id="main">
          <DropdownMenuLabel>Phase-Alignment cycle</DropdownMenuLabel>
          <div className="m3-item-enter px-3 pb-2 pt-1 text-[10px] leading-relaxed text-foreground/55">
            Every note completes an integer number of laps per macro-cycle
            and snaps back to unison at the end. All engines obey this rule.
          </div>
          <div className="space-y-3 px-3 pb-3">
            <CycleSlider
              label="Base laps"
              value={effB}
              min={1}
              max={40}
              step={1}
              suffix=""
              muted={override.baseLaps === null}
              onChange={(v) => onOverride({ ...override, baseLaps: v })}
              onReset={
                override.baseLaps !== null
                  ? () => onOverride({ ...override, baseLaps: null })
                  : undefined
              }
            />
            <CycleSlider
              label="Macro-cycle"
              value={effD}
              min={2}
              max={180}
              step={1}
              suffix="s"
              muted={override.macroCycleSeconds === null}
              onChange={(v) => onOverride({ ...override, macroCycleSeconds: v })}
              onReset={
                override.macroCycleSeconds !== null
                  ? () => onOverride({ ...override, macroCycleSeconds: null })
                  : undefined
              }
            />
            <CycleSlider
              label="Notes"
              value={effN}
              min={4}
              max={24}
              step={1}
              suffix=""
              muted={override.noteCount === null}
              onChange={(v) => onOverride({ ...override, noteCount: v })}
              onReset={
                override.noteCount !== null
                  ? () => onOverride({ ...override, noteCount: null })
                  : undefined
              }
            />
          </div>
          {overridden && (
            <DropdownMenuItem
              onSelect={() =>
                onOverride({ baseLaps: null, macroCycleSeconds: null, noteCount: null })
              }
            >
              Reset to scene defaults
            </DropdownMenuItem>
          )}
        </DropdownMenuPage>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CycleSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  muted,
  onChange,
  onReset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  muted: boolean;
  onChange: (n: number) => void;
  onReset?: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em]">
        <span className={muted ? "text-foreground/45" : "text-foreground/80"}>{label}</span>
        <span className="flex items-center gap-2 tabular-nums text-foreground/70">
          {value}
          {suffix}
          {onReset && (
            <button
              onClick={onReset}
              className="text-[9px] text-foreground/40 hover:text-foreground/70"
              title="Reset to scene default"
            >
              reset
            </button>
          )}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="dock-range h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-foreground"
      />
    </div>
  );
}

/* =================== FX menu =================== */
function FxMenu({ fx, onFx }: { fx: FxState; onFx: (s: FxState) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className={DOCK_BTN}>
        <Sliders className="h-4 w-4" /> FX
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center">
        <DropdownMenuPage id="main">
          <DropdownMenuLabel>Effects</DropdownMenuLabel>
          <DropdownMenuPageTrigger targetId="reverb">
            Reverb <span className="ml-auto text-foreground/50 uppercase">{fx.reverb.type}</span>
          </DropdownMenuPageTrigger>
          <DropdownMenuPageTrigger targetId="chorus">
            Chorus <span className="ml-auto text-foreground/50 uppercase">{fx.chorus.type}</span>
          </DropdownMenuPageTrigger>
          <DropdownMenuPageTrigger targetId="grain">
            Grain{" "}
            <span className="ml-auto text-foreground/50 uppercase">
              {fx.grain.bypass ? "off" : fx.grain.type}
            </span>
          </DropdownMenuPageTrigger>
          <DropdownMenuPageTrigger targetId="tone">
            Tone <span className="ml-auto text-foreground/50 uppercase">{fx.tone.type}</span>
          </DropdownMenuPageTrigger>
        </DropdownMenuPage>

        <FxPage id="reverb" title="Reverb">
          <DropdownMenuRadioGroup
            value={fx.reverb.type}
            onValueChange={(v) =>
              onFx({ ...fx, reverb: { ...fx.reverb, type: v as ReverbType, bypass: false } })
            }
          >
            {(Object.keys(REVERB_PRESETS) as ReverbType[]).map((k) => (
              <DropdownMenuRadioItem key={k} value={k} className="capitalize">
                {k}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <MixRow
            label="Mix"
            value={fx.reverb.mix}
            onChange={(v) => onFx({ ...fx, reverb: { ...fx.reverb, mix: v } })}
          />
          <MixRow
            label="Size"
            value={fx.reverb.size}
            onChange={(v) => onFx({ ...fx, reverb: { ...fx.reverb, size: v } })}
          />
          <DropdownMenuCheckboxItem
            checked={fx.reverb.bypass}
            onCheckedChange={(v) => onFx({ ...fx, reverb: { ...fx.reverb, bypass: !!v } })}
          >
            Bypass
          </DropdownMenuCheckboxItem>
        </FxPage>

        <FxPage id="chorus" title="Chorus">
          <DropdownMenuRadioGroup
            value={fx.chorus.type}
            onValueChange={(v) =>
              onFx({ ...fx, chorus: { ...fx.chorus, type: v as ChorusType, bypass: false } })
            }
          >
            {(Object.keys(CHORUS_PRESETS) as ChorusType[]).map((k) => (
              <DropdownMenuRadioItem key={k} value={k} className="capitalize">
                {k}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <MixRow
            label="Mix"
            value={fx.chorus.mix}
            onChange={(v) => onFx({ ...fx, chorus: { ...fx.chorus, mix: v } })}
          />
          <DropdownMenuCheckboxItem
            checked={fx.chorus.bypass}
            onCheckedChange={(v) => onFx({ ...fx, chorus: { ...fx.chorus, bypass: !!v } })}
          >
            Bypass
          </DropdownMenuCheckboxItem>
        </FxPage>

        <FxPage id="grain" title="Grain">
          <DropdownMenuRadioGroup
            value={fx.grain.type}
            onValueChange={(v) =>
              onFx({ ...fx, grain: { ...fx.grain, type: v as GrainType, bypass: false } })
            }
          >
            {(Object.keys(GRAIN_PRESETS) as GrainType[]).map((k) => (
              <DropdownMenuRadioItem key={k} value={k} className="capitalize">
                {k}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <MixRow
            label="Mix"
            value={fx.grain.mix}
            onChange={(v) => onFx({ ...fx, grain: { ...fx.grain, mix: v, bypass: v === 0 } })}
          />
          <DropdownMenuCheckboxItem
            checked={fx.grain.bypass}
            onCheckedChange={(v) => onFx({ ...fx, grain: { ...fx.grain, bypass: !!v } })}
          >
            Bypass
          </DropdownMenuCheckboxItem>
        </FxPage>

        <FxPage id="tone" title="Tone">
          <DropdownMenuRadioGroup
            value={fx.tone.type}
            onValueChange={(v) => {
              const preset = TONE_PRESETS[v as ToneType];
              onFx({
                ...fx,
                tone: {
                  ...fx.tone,
                  type: v as ToneType,
                  cutoff: preset.cutoff,
                  tilt: preset.tilt,
                  bypass: false,
                },
              });
            }}
          >
            {(Object.keys(TONE_PRESETS) as ToneType[]).map((k) => (
              <DropdownMenuRadioItem key={k} value={k} className="capitalize">
                {k}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={fx.tone.bypass}
            onCheckedChange={(v) => onFx({ ...fx, tone: { ...fx.tone, bypass: !!v } })}
          >
            Bypass
          </DropdownMenuCheckboxItem>
        </FxPage>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FxPage({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <DropdownMenuPage id={id}>
      <DropdownMenuLabel>{title}</DropdownMenuLabel>
      {children}
    </DropdownMenuPage>
  );
}

function MixRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="m3-item-enter flex items-center gap-3 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-foreground/55">
      <span className="w-10">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="dock-range h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-foreground"
      />
      <span className="w-8 text-right tabular-nums text-foreground/80">{value.toFixed(2)}</span>
    </div>
  );
}

/* =================== Packs menu =================== */
/* =================== Scales menu =================== */
function ScalesMenu({
  composer,
  onComposer,
  authed,
}: {
  composer: ComposerSettings;
  onComposer: (s: ComposerSettings) => void;
  authed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const list = useServerFn(listMyPresets);
  const save = useServerFn(savePreset);
  const fetchScales = useServerFn(fetchPublishedScales);
  const scalesQ = useQuery({
    queryKey: ["published-scales"],
    queryFn: () => fetchScales(),
    staleTime: 30_000,
  });
  const scales = scalesQ.data ?? [];
  const currentScale =
    scales.find((s) => s.id === composer.scale) ?? scales[0];
  const currentScaleLabel = currentScale?.name ?? "—";
  const presetsQ = useQuery({
    queryKey: ["my-presets"],
    queryFn: () => list(),
    enabled: authed && open,
  });
  const saveM = useMutation({
    mutationFn: (name: string) =>
      save({
        data: {
          name,
          preset_json: JSON.parse(
            JSON.stringify({
              e: composer.enabled,
              r: composer.root,
              sc: composer.scale,
              slots: composer.slots,
            }),
          ),
        },
      }),
    onSuccess: () => {
      toast.success("Preset saved to your library");
      qc.invalidateQueries({ queryKey: ["my-presets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const loadPreset = (raw: unknown) => {
    const p = raw as {
      e?: boolean;
      r?: RootName;
      sc?: string;
      slots?: SlotSettings[];
    };
    onComposer({
      enabled: p.e ?? composer.enabled,
      root: p.r ?? composer.root,
      scale: p.sc ?? composer.scale,
      slots: Array.isArray(p.slots) ? p.slots : composer.slots,
    });
    toast.success("Preset loaded");
  };

  const setSlot = (i: number, patch: Partial<SlotSettings>) => {
    const slots = composer.slots.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onComposer({ ...composer, slots });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className={DOCK_BTN}>
        <ListMusic className="h-4 w-4" /> Scales
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center">
        <DropdownMenuPage id="main">
          <DropdownMenuLabel>Scales</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={composer.enabled}
            onCheckedChange={(v) => onComposer({ ...composer, enabled: !!v })}
          >
            Enabled
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuPageTrigger targetId="presets">
            <FolderOpen className="h-4 w-4" /> Presets
            <span className="ml-auto text-foreground/50">
              {authed ? "cloud" : "sign in"}
            </span>
          </DropdownMenuPageTrigger>
          <DropdownMenuSeparator />
          <DropdownMenuPageTrigger targetId="key">
            Selected{" "}
            <span className="ml-auto text-foreground/50">
              {composer.root} {currentScaleLabel}
            </span>
          </DropdownMenuPageTrigger>
          <DropdownMenuItem asChild>
            <Link to="/studio/scales" className="flex w-full items-center gap-2">
              <FolderOpen className="h-4 w-4" /> Create / publish scales
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Voices</DropdownMenuLabel>
          {composer.slots.map((s, i) => (
            <DropdownMenuPageTrigger key={i} targetId={`slot-${i}`}>
              Voice {i + 1}
              <span className="ml-auto text-foreground/50 tabular-nums">
                E({s.k},{s.n}) · {s.noteMode.slice(0, 3)}
              </span>
            </DropdownMenuPageTrigger>
          ))}
        </DropdownMenuPage>

        <DropdownMenuPage id="presets">
          <DropdownMenuLabel>Saved scale setups</DropdownMenuLabel>
          {!authed ? (
            <DropdownMenuItem asChild>
              <Link to="/auth" className="flex w-full items-center gap-2">
                <LogIn className="h-4 w-4" /> Sign in to save presets
              </Link>
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  const name = window.prompt(
                    "Name this preset",
                    `${composer.root} ${currentScaleLabel}`,
                  );
                  if (name?.trim()) saveM.mutate(name.trim());
                }}
              >
                <Save className="h-4 w-4" /> Save current as preset
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Library</DropdownMenuLabel>
              {presetsQ.isLoading && (
                <div className="px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-foreground/50">
                  Loading…
                </div>
              )}
              {presetsQ.data && presetsQ.data.length === 0 && (
                <div className="px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-foreground/50">
                  No presets yet
                </div>
              )}
              {presetsQ.data?.map((row) => (
                <DropdownMenuItem
                  key={row.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    loadPreset(row.preset_json);
                    setOpen(false);
                  }}
                >
                  <span className="flex-1 truncate">{row.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/studio" className="flex w-full items-center gap-2">
                  <FolderOpen className="h-4 w-4" /> Manage in My Studio
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuPage>

        <DropdownMenuPage id="key">
          <DropdownMenuLabel>Root</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={composer.root}
            onValueChange={(v) => onComposer({ ...composer, root: v as RootName })}
          >
            {ROOT_NAMES.map((r) => (
              <DropdownMenuRadioItem key={r} value={r}>
                {r}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Published scales</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={currentScale?.id ?? ""}
            onValueChange={(v) => onComposer({ ...composer, scale: v })}
          >
            {scales.length === 0 && (
              <div className="px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-foreground/50">
                No published scales
              </div>
            )}
            {scales.map((s) => (
              <DropdownMenuRadioItem key={s.id} value={s.id}>
                {s.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuPage>

        {composer.slots.map((s, i) => (
          <DropdownMenuPage key={i} id={`slot-${i}`}>
            <DropdownMenuLabel>Voice {i + 1}</DropdownMenuLabel>
            <PatternPreview slot={s} />
            <NumRow
              label="Hits (k)"
              value={s.k}
              min={0}
              max={s.n}
              onChange={(v) => setSlot(i, { k: Math.min(v, s.n) })}
            />
            <NumRow
              label="Steps (n)"
              value={s.n}
              min={1}
              max={16}
              onChange={(v) => setSlot(i, { n: v, k: Math.min(s.k, v), rotation: s.rotation % v })}
            />
            <NumRow
              label="Rotate"
              value={s.rotation}
              min={0}
              max={Math.max(0, s.n - 1)}
              onChange={(v) => setSlot(i, { rotation: v })}
            />
            <NumRow
              label="Oct Low"
              value={s.octaveLow}
              min={1}
              max={7}
              onChange={(v) => setSlot(i, { octaveLow: Math.min(v, s.octaveHigh) })}
            />
            <NumRow
              label="Oct High"
              value={s.octaveHigh}
              min={1}
              max={7}
              onChange={(v) => setSlot(i, { octaveHigh: Math.max(v, s.octaveLow) })}
            />
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Note mode</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={s.noteMode}
              onValueChange={(v) => setSlot(i, { noteMode: v as NoteMode })}
            >
              {(["sequential", "random", "arpeggio", "brownian"] as NoteMode[]).map((m) => (
                <DropdownMenuRadioItem key={m} value={m} className="capitalize">
                  {m}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuPage>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NumRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="m3-item-enter flex items-center gap-3 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-foreground/55">
      <span className="w-16">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="dock-range h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-foreground"
      />
      <span className="w-6 text-right tabular-nums text-foreground/80">{value}</span>
    </div>
  );
}

function PatternPreview({ slot }: { slot: SlotSettings }) {
  const pat = patternFor(slot);
  return (
    <div className="m3-item-enter flex flex-wrap items-center gap-1 px-4 pt-2 pb-3">
      {pat.map((on, i) => (
        <span
          key={i}
          className={cn("h-2 w-2 rounded-full", on ? "bg-foreground" : "bg-white/15")}
        />
      ))}
    </div>
  );
}

function PacksMenu({
  packs,
  packId,
  onPackId,
}: {
  packs: RuntimePack[];
  packId: string;
  onPackId: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className={DOCK_BTN}>
        <Music3 className="h-4 w-4" /> Packs
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center">
        <DropdownMenuPage id="main">
          <DropdownMenuLabel>Sound Packs</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={packId} onValueChange={onPackId}>
            {packs.map((p) => (
              <DropdownMenuRadioItem key={p.id} value={p.id}>
                <span className="flex flex-col">
                  <span>{p.name}</span>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-foreground/40">
                    {p.blurb}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link
              to="/studio"
              search={{ tab: "packs" }}
              className="flex w-full items-center gap-2"
            >
              <Wrench className="h-4 w-4" /> Manage custom packs
            </Link>
          </DropdownMenuItem>
        </DropdownMenuPage>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* =================== Visuals menu =================== */
function BackdropMenu() {
  const [open, setOpen] = useState(false);
  const listFn = useServerFn(listPublishedScenes);
  const scenesQ = useQuery({
    queryKey: ["published-scenes"],
    queryFn: () => listFn(),
    staleTime: 60_000,
  });
  const scenes: SceneRow[] = scenesQ.data ?? [];
  const [activeId, setActiveId] = useState<string>(() => getActiveScene()?.id ?? "");
  useEffect(() => subscribeActiveScene((s) => setActiveId(s?.id ?? "")), []);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className={DOCK_BTN}>
        <ImageIcon className="h-4 w-4" /> Backdrop
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center">
        <DropdownMenuPage id="main">
          <DropdownMenuLabel>Scene backdrop</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={activeId}
            onValueChange={(v) => {
              if (!v) {
                setActiveScene(null);
                return;
              }
              const found = scenes.find((s) => s.id === v) ?? null;
              setActiveScene(found);
            }}
          >
            <DropdownMenuRadioItem value="">None</DropdownMenuRadioItem>
            {scenes.map((s) => (
              <DropdownMenuRadioItem key={s.id} value={s.id}>
                {s.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {scenes.length === 0 && (
            <div className="px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-foreground/50">
              No published scenes
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/studio/scenes" className="flex w-full items-center gap-2">
              <Wrench className="h-4 w-4" /> Create scenes
            </Link>
          </DropdownMenuItem>
        </DropdownMenuPage>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function VisualsMenu({
  neural,
  onNeural,
}: {
  neural: NeuralSettings;
  onNeural: (s: NeuralSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className={DOCK_BTN}>
        <Eye className="h-4 w-4" /> Visuals
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center">
        <DropdownMenuPage id="main">
          <DropdownMenuLabel>Background</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={neural.presetId}
            onValueChange={(v) => onNeural({ ...neural, presetId: v })}
          >
            {NEURAL_PRESETS.map((p) => (
              <DropdownMenuRadioItem key={p.id} value={p.id}>
                {p.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <MixRow
            label="Glow"
            value={neural.opacity / 0.6}
            onChange={(v) => onNeural({ ...neural, opacity: v * 0.6 })}
          />
          <MixRow
            label="Flow"
            value={neural.speed / 2}
            onChange={(v) => onNeural({ ...neural, speed: v * 2 })}
          />
        </DropdownMenuPage>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* =================== More menu =================== */
function MoreMenu({
  authed,
  email,
  onSignOut,
}: {
  authed: boolean;
  email?: string | null;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className={cn(DOCK_BTN, "h-9 w-9 px-0 justify-center")}>
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end">
        <DropdownMenuPage id="main">
          <DropdownMenuLabel>Phase</DropdownMenuLabel>
          <DropdownMenuPageTrigger targetId="about">
            <Info className="h-4 w-4" /> About
          </DropdownMenuPageTrigger>
          <DropdownMenuItem asChild>
            <Link to="/studio" className="flex w-full items-center gap-2">
              <FolderOpen className="h-4 w-4" /> My Studio
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent("phase:admin-open"));
            }}
          >
            <Shield className="h-4 w-4" /> Admin
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {authed ? (
            <DropdownMenuItem onSelect={onSignOut}>
              <LogOut className="h-4 w-4" />
              <span className="flex flex-col">
                <span>Sign out</span>
                {email && (
                  <span className="text-[10px] uppercase tracking-[0.16em] text-foreground/40">
                    {email}
                  </span>
                )}
              </span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
          <Link to="/auth" className="flex w-full items-center gap-2">
            <LogIn className="h-4 w-4" /> Sign in
          </Link>
        </DropdownMenuItem>
          )}
        </DropdownMenuPage>

        <DropdownMenuPage id="about">
          <DropdownMenuLabel>About Phase</DropdownMenuLabel>
          <div className="m3-item-enter px-4 pb-3 text-[12px] leading-relaxed text-foreground/65">
            Phase is a browser-native generative ambient instrument built on mathematical
            polyrhythms. Every voice is synthesised live; every visual reacts to the same engine
            that makes the sound.
          </div>
        </DropdownMenuPage>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
