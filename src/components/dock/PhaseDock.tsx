import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Play, Pause, Layers, Sliders, Music3, Eye, MoreHorizontal, Sparkles,
  Info, Wrench, LogIn, LogOut,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuPage, DropdownMenuPageTrigger,
} from "@/components/ui/material-ui-dropdown-menu";
import {
  REVERB_PRESETS, CHORUS_PRESETS, GRAIN_PRESETS, TONE_PRESETS,
  type FxState, type ReverbType, type ChorusType, type GrainType, type ToneType,
} from "@/lib/fx/fxState";
import { NEURAL_PRESETS, type NeuralSettings } from "@/lib/neural/palette";
import type { RuntimePack } from "@/lib/sound/runtimePacks";
import {
  SCALES, ROOT_NAMES, type ScaleId, type RootName,
} from "@/lib/music/scales";
import {
  type ComposerSettings, type SlotSettings, type NoteMode, patternFor,
} from "@/lib/music/composer";
import { cn } from "@/lib/utils";

export type SceneKind = "wheel" | "pendulum" | "bars";

type Props = {
  playing: boolean;
  onTogglePlay: () => void;

  scene: SceneKind;
  onScene: (s: SceneKind) => void;
  multiply: number;
  onMultiply: (n: number) => void;

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
};

const DOCK_BTN =
  "group relative inline-flex h-10 items-center gap-2 rounded-full px-3 text-[11px] font-medium uppercase tracking-[0.16em] text-foreground/70 hover:text-foreground transition-colors";

export function PhaseDock(p: Props) {
  return (
    <div
      className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2 max-w-[calc(100vw-1rem)]"
      style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', ui-monospace, monospace)" }}
    >
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-1 rounded-full border border-white/10",
          "bg-[hsl(220_22%_7%/0.72)] backdrop-blur-2xl shadow-[0_24px_60px_-20px_rgba(0,0,0,0.65)]",
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
          {p.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
        </button>

        <Divider />

        <SceneMenu scene={p.scene} onScene={p.onScene} multiply={p.multiply} onMultiply={p.onMultiply} />
        <FxMenu fx={p.fx} onFx={p.onFx} />
        <ComposeMenu composer={p.composer} onComposer={p.onComposer} />
        <PacksMenu packs={p.packs} packId={p.packId} onPackId={p.onPackId} />
        <VisualsMenu neural={p.neural} onNeural={p.onNeural} />

        <Divider />

        <InlineSlider label="BPM" value={p.bpm} min={20} max={180} step={1} onChange={p.onBpm} suffix="" />
        <InlineSlider label="SPD" value={p.speed} min={0.25} max={2} step={0.05} onChange={p.onSpeed} suffix="x" digits={2} />

        <Divider />

        <MoreMenu authed={p.authed} email={p.email} onSignOut={p.onSignOut} />
      </div>
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-white/[0.08]" />;
}

function InlineSlider({
  label, value, min, max, step, onChange, suffix = "", digits = 0,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (n: number) => void; suffix?: string; digits?: number;
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
        {value.toFixed(digits)}{suffix}
      </span>
    </label>
  );
}

/* =================== Scene menu =================== */
function SceneMenu({
  scene, onScene, multiply, onMultiply,
}: {
  scene: SceneKind; onScene: (s: SceneKind) => void; multiply: number; onMultiply: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className={DOCK_BTN}>
        <Layers className="h-4 w-4" /> Scene
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center">
        <DropdownMenuPage id="main">
          <DropdownMenuLabel>Scene</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={scene} onValueChange={(v) => onScene(v as SceneKind)}>
            <DropdownMenuRadioItem value="wheel">Wheel</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="pendulum">Pendulum</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="bars">Bars</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuPageTrigger targetId="multiply">
            Multiply <span className="ml-auto text-foreground/50">{multiply}</span>
          </DropdownMenuPageTrigger>
        </DropdownMenuPage>

        <DropdownMenuPage id="multiply">
          <DropdownMenuLabel>Vertex count</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={String(multiply)}
            onValueChange={(v) => onMultiply(Number(v))}
          >
            {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
              <DropdownMenuRadioItem key={n} value={String(n)}>{n}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuPage>
      </DropdownMenuContent>
    </DropdownMenu>
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
            Grain <span className="ml-auto text-foreground/50 uppercase">{fx.grain.bypass ? "off" : fx.grain.type}</span>
          </DropdownMenuPageTrigger>
          <DropdownMenuPageTrigger targetId="tone">
            Tone <span className="ml-auto text-foreground/50 uppercase">{fx.tone.type}</span>
          </DropdownMenuPageTrigger>
        </DropdownMenuPage>

        <FxPage id="reverb" title="Reverb">
          <DropdownMenuRadioGroup
            value={fx.reverb.type}
            onValueChange={(v) => onFx({ ...fx, reverb: { ...fx.reverb, type: v as ReverbType, bypass: false } })}
          >
            {(Object.keys(REVERB_PRESETS) as ReverbType[]).map((k) => (
              <DropdownMenuRadioItem key={k} value={k} className="capitalize">{k}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <MixRow label="Mix" value={fx.reverb.mix} onChange={(v) => onFx({ ...fx, reverb: { ...fx.reverb, mix: v } })} />
          <MixRow label="Size" value={fx.reverb.size} onChange={(v) => onFx({ ...fx, reverb: { ...fx.reverb, size: v } })} />
          <DropdownMenuCheckboxItem
            checked={fx.reverb.bypass}
            onCheckedChange={(v) => onFx({ ...fx, reverb: { ...fx.reverb, bypass: !!v } })}
          >Bypass</DropdownMenuCheckboxItem>
        </FxPage>

        <FxPage id="chorus" title="Chorus">
          <DropdownMenuRadioGroup
            value={fx.chorus.type}
            onValueChange={(v) => onFx({ ...fx, chorus: { ...fx.chorus, type: v as ChorusType, bypass: false } })}
          >
            {(Object.keys(CHORUS_PRESETS) as ChorusType[]).map((k) => (
              <DropdownMenuRadioItem key={k} value={k} className="capitalize">{k}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <MixRow label="Mix" value={fx.chorus.mix} onChange={(v) => onFx({ ...fx, chorus: { ...fx.chorus, mix: v } })} />
          <DropdownMenuCheckboxItem
            checked={fx.chorus.bypass}
            onCheckedChange={(v) => onFx({ ...fx, chorus: { ...fx.chorus, bypass: !!v } })}
          >Bypass</DropdownMenuCheckboxItem>
        </FxPage>

        <FxPage id="grain" title="Grain">
          <DropdownMenuRadioGroup
            value={fx.grain.type}
            onValueChange={(v) => onFx({ ...fx, grain: { ...fx.grain, type: v as GrainType, bypass: false } })}
          >
            {(Object.keys(GRAIN_PRESETS) as GrainType[]).map((k) => (
              <DropdownMenuRadioItem key={k} value={k} className="capitalize">{k}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <MixRow label="Mix" value={fx.grain.mix} onChange={(v) => onFx({ ...fx, grain: { ...fx.grain, mix: v, bypass: v === 0 } })} />
          <DropdownMenuCheckboxItem
            checked={fx.grain.bypass}
            onCheckedChange={(v) => onFx({ ...fx, grain: { ...fx.grain, bypass: !!v } })}
          >Bypass</DropdownMenuCheckboxItem>
        </FxPage>

        <FxPage id="tone" title="Tone">
          <DropdownMenuRadioGroup
            value={fx.tone.type}
            onValueChange={(v) => {
              const preset = TONE_PRESETS[v as ToneType];
              onFx({ ...fx, tone: { ...fx.tone, type: v as ToneType, cutoff: preset.cutoff, tilt: preset.tilt, bypass: false } });
            }}
          >
            {(Object.keys(TONE_PRESETS) as ToneType[]).map((k) => (
              <DropdownMenuRadioItem key={k} value={k} className="capitalize">{k}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={fx.tone.bypass}
            onCheckedChange={(v) => onFx({ ...fx, tone: { ...fx.tone, bypass: !!v } })}
          >Bypass</DropdownMenuCheckboxItem>
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

function MixRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="m3-item-enter flex items-center gap-3 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-foreground/55">
      <span className="w-10">{label}</span>
      <input
        type="range" min={0} max={1} step={0.01} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="dock-range h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-foreground"
      />
      <span className="w-8 text-right tabular-nums text-foreground/80">{value.toFixed(2)}</span>
    </div>
  );
}

/* =================== Packs menu =================== */
/* =================== Compose menu =================== */
function ComposeMenu({
  composer, onComposer,
}: { composer: ComposerSettings; onComposer: (s: ComposerSettings) => void }) {
  const [open, setOpen] = useState(false);

  const setSlot = (i: number, patch: Partial<SlotSettings>) => {
    const slots = composer.slots.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onComposer({ ...composer, slots });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className={DOCK_BTN}>
        <Sparkles className="h-4 w-4" /> Compose
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center">
        <DropdownMenuPage id="main">
          <DropdownMenuLabel>Composer</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={composer.enabled}
            onCheckedChange={(v) => onComposer({ ...composer, enabled: !!v })}
          >Enabled</DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuPageTrigger targetId="key">
            Key <span className="ml-auto text-foreground/50">{composer.root} {SCALES[composer.scale].label}</span>
          </DropdownMenuPageTrigger>
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

        <DropdownMenuPage id="key">
          <DropdownMenuLabel>Root</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={composer.root}
            onValueChange={(v) => onComposer({ ...composer, root: v as RootName })}
          >
            {ROOT_NAMES.map((r) => (
              <DropdownMenuRadioItem key={r} value={r}>{r}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Scale</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={composer.scale}
            onValueChange={(v) => onComposer({ ...composer, scale: v as ScaleId })}
          >
            {(Object.keys(SCALES) as ScaleId[]).map((k) => (
              <DropdownMenuRadioItem key={k} value={k}>{SCALES[k].label}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuPage>

        {composer.slots.map((s, i) => (
          <DropdownMenuPage key={i} id={`slot-${i}`}>
            <DropdownMenuLabel>Voice {i + 1}</DropdownMenuLabel>
            <PatternPreview slot={s} />
            <NumRow label="Hits (k)"    value={s.k}        min={0}  max={s.n} onChange={(v) => setSlot(i, { k: Math.min(v, s.n) })} />
            <NumRow label="Steps (n)"   value={s.n}        min={1}  max={16}  onChange={(v) => setSlot(i, { n: v, k: Math.min(s.k, v), rotation: s.rotation % v })} />
            <NumRow label="Rotate"      value={s.rotation} min={0}  max={Math.max(0, s.n - 1)} onChange={(v) => setSlot(i, { rotation: v })} />
            <NumRow label="Oct Low"     value={s.octaveLow}  min={1} max={7} onChange={(v) => setSlot(i, { octaveLow: Math.min(v, s.octaveHigh) })} />
            <NumRow label="Oct High"    value={s.octaveHigh} min={1} max={7} onChange={(v) => setSlot(i, { octaveHigh: Math.max(v, s.octaveLow) })} />
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Note mode</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={s.noteMode}
              onValueChange={(v) => setSlot(i, { noteMode: v as NoteMode })}
            >
              {(["sequential", "random", "arpeggio", "brownian"] as NoteMode[]).map((m) => (
                <DropdownMenuRadioItem key={m} value={m} className="capitalize">{m}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuPage>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NumRow({
  label, value, min, max, onChange,
}: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="m3-item-enter flex items-center gap-3 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-foreground/55">
      <span className="w-16">{label}</span>
      <input
        type="range" min={min} max={max} step={1} value={value}
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
          className={cn(
            "h-2 w-2 rounded-full",
            on ? "bg-foreground" : "bg-white/15",
          )}
        />
      ))}
    </div>
  );
}

function PacksMenu({
  packs, packId, onPackId,
}: { packs: RuntimePack[]; packId: string; onPackId: (id: string) => void }) {
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
                  <span className="text-[10px] uppercase tracking-[0.16em] text-foreground/40">{p.blurb}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/dev" className="flex w-full items-center gap-2">
              <Wrench className="h-4 w-4" /> Manage custom packs
            </Link>
          </DropdownMenuItem>
        </DropdownMenuPage>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* =================== Visuals menu =================== */
function VisualsMenu({ neural, onNeural }: { neural: NeuralSettings; onNeural: (s: NeuralSettings) => void }) {
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
              <DropdownMenuRadioItem key={p.id} value={p.id}>{p.label}</DropdownMenuRadioItem>
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
  authed, email, onSignOut,
}: { authed: boolean; email?: string | null; onSignOut: () => void }) {
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
            <Link to="/dev" className="flex w-full items-center gap-2">
              <Wrench className="h-4 w-4" /> Developer console
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {authed ? (
            <DropdownMenuItem onSelect={onSignOut}>
              <LogOut className="h-4 w-4" />
              <span className="flex flex-col">
                <span>Sign out</span>
                {email && <span className="text-[10px] uppercase tracking-[0.16em] text-foreground/40">{email}</span>}
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
            Phase is a browser-native generative ambient instrument built on
            mathematical polyrhythms. Every voice is synthesised live; every
            visual reacts to the same engine that makes the sound.
          </div>
        </DropdownMenuPage>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}