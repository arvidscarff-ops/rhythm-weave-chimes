/**
 * Trigger Engine & Scene Creator — Studio route.
 *
 * Split-screen authoring tool for the "custom" scene. Left rack: tabbed
 * controls (Geometry, Background, Notes, Trails, Palette, Burst FX,
 * Path Pulse, Climax, Cycle) plus a persistent Preset panel. Right
 * pane: live preview canvas rendering the same `customScene` used in
 * production, with a theater-mode expand overlay.
 *
 * All state is a single `CustomSceneBlueprint` object serialized to
 * LocalStorage — no server calls, no AI credits, and preset loads never
 * reset the running musical clock.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  Expand,
  Minimize,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_BLUEPRINT,
  type AestheticConfig,
  type CustomSceneBlueprint,
  type PaletteMode,
  type PathType,
  type SizingMode,
  type TriggerMode,
} from "@/lib/engine/pathTransformer";
import {
  deletePreset,
  downloadBlueprintFile,
  loadPresets,
  newBlueprint,
  newPresetId,
  readBlueprintFile,
  savePreset,
  type PresetMap,
} from "@/lib/studio/sceneBuilderStore";
import { PALETTE_PRESETS, paletteAt } from "@/lib/studio/palettes";
import { getActiveBlueprint, setActiveBlueprint } from "@/lib/scenes/activeBlueprint";
import { customScene, type CustomSceneState } from "@/lib/scenes/customScene";
import type { SceneGlobals } from "@/lib/engine/sceneTypes";

export const Route = createFileRoute("/studio/builder")({
  ssr: false,
  component: BuilderPage,
});

/* ============================================================
 *  Page
 * ============================================================ */

function BuilderPage() {
  const [presets, setPresets] = useState<PresetMap>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bp, setBp] = useState<CustomSceneBlueprint>(DEFAULT_BLUEPRINT);
  const [theater, setTheater] = useState(false);

  useEffect(() => {
    const p = loadPresets();
    setPresets(p);
    const first = Object.values(p).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (first) {
      setSelectedId(first.id);
      setBp(first.blueprint);
    }
  }, []);

  // ESC exits theater mode.
  useEffect(() => {
    if (!theater) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTheater(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [theater]);

  const patch = useCallback((next: CustomSceneBlueprint) => {
    setBp(next);
  }, []);

  const savePresetHandler = () => {
    const id = selectedId ?? newPresetId();
    const stored = savePreset(id, bp);
    setPresets((prev) => ({ ...prev, [id]: stored }));
    setSelectedId(id);
    toast.success("Preset saved");
  };

  const saveAsHandler = () => {
    const name = window.prompt("Preset name?", bp.name || "Untitled");
    if (!name) return;
    const id = newPresetId();
    const next = { ...bp, name };
    const stored = savePreset(id, next);
    setPresets((prev) => ({ ...prev, [id]: stored }));
    setSelectedId(id);
    setBp(next);
    toast.success(`Saved as "${name}"`);
  };

  const newHandler = () => {
    const fresh = newBlueprint(`Preset ${Object.keys(presets).length + 1}`);
    setSelectedId(null);
    setBp(fresh);
  };

  const loadHandler = (id: string) => {
    const p = presets[id];
    if (!p) return;
    setSelectedId(id);
    setBp(p.blueprint);
    setActiveBlueprint(p.blueprint);
  };

  const deleteHandler = () => {
    if (!selectedId) return;
    if (!confirm(`Delete "${bp.name}"?`)) return;
    deletePreset(selectedId);
    setPresets((prev) => {
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
    setSelectedId(null);
  };

  const publishHandler = () => {
    setActiveBlueprint(bp);
    toast.success(`"${bp.name}" is now the active custom scene`, {
      description: "In the app, set Scene → Custom to see it.",
    });
  };

  // Live-publish so preset selection swaps the app scene without needing
  // a manual "Load into app" click.
  useEffect(() => {
    setActiveBlueprint(bp);
  }, [bp]);

  const importRef = useRef<HTMLInputElement>(null);
  const importHandler = () => importRef.current?.click();
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const parsed = await readBlueprintFile(file);
    if (!parsed) return toast.error("Invalid blueprint JSON");
    setSelectedId(null);
    setBp(parsed);
    toast.success("Blueprint imported — Save to keep it");
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
      {/* ================ Left rack ================ */}
      <aside className="space-y-4">
        <header className="flex items-center gap-2">
          <Input
            value={bp.name}
            onChange={(e) => patch({ ...bp, name: e.target.value })}
            className="max-w-[220px] bg-white/5"
            placeholder="Preset name"
          />
          <Button size="sm" variant="secondary" onClick={publishHandler} title="Publish to app">
            <Play className="h-3 w-3 mr-2" /> Publish
          </Button>
          <Button size="sm" onClick={savePresetHandler} title="Save preset">
            <Save className="h-3 w-3 mr-2" /> Save
          </Button>
        </header>

        <ConfigTabs bp={bp} onChange={patch} />

        <PresetPanel
          presets={presets}
          selectedId={selectedId}
          onLoad={loadHandler}
          onNew={newHandler}
          onSaveAs={saveAsHandler}
          onDelete={selectedId ? deleteHandler : undefined}
          onExport={() => downloadBlueprintFile(bp)}
          onImport={importHandler}
        />
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onImportFile}
        />
      </aside>

      {/* ================ Right preview ================ */}
      <div className={theater ? "fixed inset-0 z-50 bg-black p-4" : "sticky top-4 h-fit"}>
        <PreviewCanvas bp={bp} theater={theater} onToggleTheater={() => setTheater((v) => !v)} />
      </div>
    </div>
  );
}

/* ============================================================
 *  Tabbed controls
 * ============================================================ */

function ConfigTabs({
  bp,
  onChange,
}: {
  bp: CustomSceneBlueprint;
  onChange: (bp: CustomSceneBlueprint) => void;
}) {
  const patchAesthetic = (next: Partial<AestheticConfig>) =>
    onChange({ ...bp, aesthetic: { ...bp.aesthetic, ...next } });

  return (
    <Tabs defaultValue="geometry" className="w-full">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-white/5">
        <TabsTrigger value="geometry">Geometry</TabsTrigger>
        <TabsTrigger value="bg">BG</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
        <TabsTrigger value="trails">Trails</TabsTrigger>
        <TabsTrigger value="palette">Palette</TabsTrigger>
        <TabsTrigger value="burst">Burst</TabsTrigger>
        <TabsTrigger value="pulse">Pulse</TabsTrigger>
        <TabsTrigger value="climax">Climax</TabsTrigger>
      </TabsList>

      <TabsContent value="geometry" className="space-y-3 pt-3">
        <GeometryPanel bp={bp} onChange={onChange} />
      </TabsContent>
      <TabsContent value="bg" className="space-y-3 pt-3">
        <BackgroundPanel a={bp.aesthetic} onPatch={patchAesthetic} />
      </TabsContent>
      <TabsContent value="notes" className="space-y-3 pt-3">
        <NotesPanel a={bp.aesthetic} onPatch={patchAesthetic} />
      </TabsContent>
      <TabsContent value="trails" className="space-y-3 pt-3">
        <TrailsPanel a={bp.aesthetic} onPatch={patchAesthetic} />
      </TabsContent>
      <TabsContent value="palette" className="space-y-3 pt-3">
        <PalettePanel a={bp.aesthetic} onPatch={patchAesthetic} />
      </TabsContent>
      <TabsContent value="burst" className="space-y-3 pt-3">
        <BurstPanel a={bp.aesthetic} onPatch={patchAesthetic} />
      </TabsContent>
      <TabsContent value="pulse" className="space-y-3 pt-3">
        <PulsePanel a={bp.aesthetic} onPatch={patchAesthetic} />
      </TabsContent>
      <TabsContent value="climax" className="space-y-3 pt-3">
        <ClimaxPanel a={bp.aesthetic} onPatch={patchAesthetic} />
      </TabsContent>
    </Tabs>
  );
}

/* ---------- Geometry ---------- */

function GeometryPanel({
  bp,
  onChange,
}: {
  bp: CustomSceneBlueprint;
  onChange: (bp: CustomSceneBlueprint) => void;
}) {
  const update = <K extends keyof CustomSceneBlueprint>(k: K, v: CustomSceneBlueprint[K]) =>
    onChange({ ...bp, [k]: v });
  return (
    <>
      <SectionLabel>Path type</SectionLabel>
      <Select
        value={bp.path.type}
        onChange={(v) => update("path", { ...bp.path, type: v as PathType })}
      >
        <option value="circle">Circle / Arc</option>
        <option value="line">Line (linear)</option>
        <option value="polygon">Polygon</option>
        <option value="lissajous">Lissajous</option>
      </Select>

      {bp.path.type === "polygon" && (
        <SliderRow
          label="Sides"
          value={bp.path.sides ?? 3}
          min={3} max={12} step={1}
          onChange={(v) => update("path", { ...bp.path, sides: Math.round(v) })}
        />
      )}
      {bp.path.type === "line" && (
        <Select
          value={bp.path.axis ?? "x"}
          onChange={(v) => update("path", { ...bp.path, axis: v as "x" | "y" })}
        >
          <option value="x">Horizontal</option>
          <option value="y">Vertical</option>
        </Select>
      )}
      {bp.path.type === "lissajous" && (
        <>
          <SliderRow label="Freq X" value={bp.path.freqX ?? 3} min={1} max={9} step={1}
            onChange={(v) => update("path", { ...bp.path, freqX: Math.round(v) })} />
          <SliderRow label="Freq Y" value={bp.path.freqY ?? 2} min={1} max={9} step={1}
            onChange={(v) => update("path", { ...bp.path, freqY: Math.round(v) })} />
          <SliderRow label="Phase" value={bp.path.phase ?? Math.PI / 2}
            min={0} max={Math.PI * 2} step={0.01}
            onChange={(v) => update("path", { ...bp.path, phase: v })} />
        </>
      )}

      <SectionLabel>Layout</SectionLabel>
      <Select
        value={bp.layout.sizing}
        onChange={(v) => update("layout", { ...bp.layout, sizing: v as SizingMode })}
      >
        <option value="linear">Linear</option>
        <option value="exponential">Exponential</option>
        <option value="constant">Constant + offset</option>
      </Select>
      <SliderRow label="Base size" value={bp.layout.baseSize}
        min={0.05} max={0.95} step={0.01}
        onChange={(v) => update("layout", { ...bp.layout, baseSize: v })} />
      <SliderRow label="Step" value={bp.layout.step}
        min={0} max={0.5} step={0.01}
        onChange={(v) => update("layout", { ...bp.layout, step: v })} />
      <SliderRow label="Rotation offset" value={bp.layout.rotationOffsetDeg}
        min={0} max={360} step={1} unit="°"
        onChange={(v) => update("layout", { ...bp.layout, rotationOffsetDeg: v })} />
      <div className="flex items-center gap-2 text-xs">
        <span className="text-foreground/60">Tracks</span>
        <Select
          value={bp.layout.trackCount === null ? "auto" : "manual"}
          onChange={(v) =>
            update("layout", {
              ...bp.layout,
              trackCount: v === "auto" ? null : bp.layout.trackCount ?? 8,
            })
          }
        >
          <option value="auto">Auto</option>
          <option value="manual">Manual</option>
        </Select>
        {bp.layout.trackCount !== null && (
          <Input
            type="number" min={1} max={48} value={bp.layout.trackCount}
            onChange={(e) => update("layout", { ...bp.layout, trackCount: Number(e.target.value) })}
            className="h-7 w-20 bg-white/5"
          />
        )}
      </div>

      <SectionLabel>Trigger</SectionLabel>
      <Select
        value={bp.trigger.mode}
        onChange={(v) => update("trigger", { ...bp.trigger, mode: v as TriggerMode })}
      >
        <option value="boundary">Boundary (p = 0/1)</option>
        <option value="axisIntersect">Axis intersect</option>
      </Select>
      {bp.trigger.mode === "axisIntersect" && (
        <>
          <Select
            value={bp.trigger.axis ?? "x"}
            onChange={(v) => update("trigger", { ...bp.trigger, axis: v as "x" | "y" })}
          >
            <option value="x">Vertical line (x)</option>
            <option value="y">Horizontal line (y)</option>
          </Select>
          <SliderRow label="Position" value={bp.trigger.position ?? 0}
            min={-1} max={1} step={0.01}
            onChange={(v) => update("trigger", { ...bp.trigger, position: v })} />
        </>
      )}

      <SectionLabel>Voice</SectionLabel>
      <SliderRow label="Pack slot" value={bp.voice.slot} min={0} max={5} step={1}
        onChange={(v) => update("voice", { slot: Math.round(v) as CustomSceneBlueprint["voice"]["slot"] })} />
    </>
  );
}

/* ---------- Background ---------- */

function BackgroundPanel({
  a,
  onPatch,
}: {
  a: AestheticConfig;
  onPatch: (p: Partial<AestheticConfig>) => void;
}) {
  const bg = a.background;
  return (
    <>
      <SectionLabel>Media</SectionLabel>
      <Select
        value={bg.kind}
        onChange={(v) => onPatch({ background: { ...bg, kind: v as typeof bg.kind } })}
      >
        <option value="none">None</option>
        <option value="image">Image URL</option>
        <option value="video">Video URL</option>
      </Select>
      {bg.kind !== "none" && (
        <Input
          value={bg.url}
          placeholder="https://…"
          onChange={(e) => onPatch({ background: { ...bg, url: e.target.value } })}
          className="bg-white/5"
        />
      )}
      <SliderRow label="Opacity" value={bg.opacity} min={0} max={1} step={0.01}
        onChange={(v) => onPatch({ background: { ...bg, opacity: v } })} />
      <SliderRow label="Blur" value={bg.blurPx} min={0} max={30} step={0.5} unit="px"
        onChange={(v) => onPatch({ background: { ...bg, blurPx: v } })} />
    </>
  );
}

/* ---------- Notes ---------- */

function NotesPanel({
  a,
  onPatch,
}: {
  a: AestheticConfig;
  onPatch: (p: Partial<AestheticConfig>) => void;
}) {
  const n = a.notes;
  return (
    <>
      <SectionLabel>Note orbs</SectionLabel>
      <SliderRow label="Base radius" value={n.baseRadiusPx} min={1} max={18} step={0.5} unit="px"
        onChange={(v) => onPatch({ notes: { ...n, baseRadiusPx: v } })} />
      <SliderRow label="Breath rate" value={n.breathHz} min={0} max={2} step={0.01} unit="Hz"
        onChange={(v) => onPatch({ notes: { ...n, breathHz: v } })} />
      <SliderRow label="Breath depth" value={n.breathDepth} min={0} max={0.6} step={0.01}
        onChange={(v) => onPatch({ notes: { ...n, breathDepth: v } })} />
    </>
  );
}

/* ---------- Trails ---------- */

function TrailsPanel({
  a,
  onPatch,
}: {
  a: AestheticConfig;
  onPatch: (p: Partial<AestheticConfig>) => void;
}) {
  const t = a.trail;
  const label =
    t.decay < 0.1 ? "Off" : t.decay < 0.5 ? "Faint" : t.decay < 0.85 ? "Ribbon" : "Long exposure";
  return (
    <>
      <SectionLabel>Phosphor trail</SectionLabel>
      <div className="text-[11px] text-foreground/60">{label}</div>
      <SliderRow label="Decay" value={t.decay} min={0} max={0.98} step={0.01}
        onChange={(v) => onPatch({ trail: { decay: v } })} />
    </>
  );
}

/* ---------- Palette ---------- */

function PalettePanel({
  a,
  onPatch,
}: {
  a: AestheticConfig;
  onPatch: (p: Partial<AestheticConfig>) => void;
}) {
  const p = a.palette;
  const swatches = useMemo(
    () => new Array(12).fill(0).map((_, i) => paletteAt(p, i, 12)),
    [p],
  );
  return (
    <>
      <SectionLabel>Mode</SectionLabel>
      <Select
        value={p.mode}
        onChange={(v) => onPatch({ palette: { ...p, mode: v as PaletteMode } })}
      >
        <option value="gradient">Gradient (custom)</option>
        <option value="preset">Preset</option>
      </Select>

      {p.mode === "gradient" ? (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-foreground/60">
            Start
            <input
              type="color"
              value={p.startHex}
              onChange={(e) => onPatch({ palette: { ...p, startHex: e.target.value } })}
              className="h-8 w-10 rounded border border-white/10 bg-transparent"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-foreground/60">
            End
            <input
              type="color"
              value={p.endHex}
              onChange={(e) => onPatch({ palette: { ...p, endHex: e.target.value } })}
              className="h-8 w-10 rounded border border-white/10 bg-transparent"
            />
          </label>
        </div>
      ) : (
        <Select
          value={p.presetId ?? ""}
          onChange={(v) => onPatch({ palette: { ...p, presetId: (v || undefined) as typeof p.presetId } })}
        >
          <option value="">Choose preset…</option>
          {PALETTE_PRESETS.map((pp) => (
            <option key={pp.id} value={pp.id}>{pp.label}</option>
          ))}
        </Select>
      )}

      <SectionLabel>Preview</SectionLabel>
      <div className="flex h-6 w-full overflow-hidden rounded-md">
        {swatches.map((c, i) => (
          <div key={i} style={{ background: c }} className="flex-1" />
        ))}
      </div>
    </>
  );
}

/* ---------- Burst FX ---------- */

function BurstPanel({
  a,
  onPatch,
}: {
  a: AestheticConfig;
  onPatch: (p: Partial<AestheticConfig>) => void;
}) {
  const b = a.burst;
  return (
    <>
      <SectionLabel>Particle burst</SectionLabel>
      <SliderRow label="Count" value={b.count} min={0} max={120} step={1}
        onChange={(v) => onPatch({ burst: { ...b, count: Math.round(v) } })} />
      <SliderRow label="Base speed" value={b.baseSpeed} min={20} max={400} step={5} unit="px/s"
        onChange={(v) => onPatch({ burst: { ...b, baseSpeed: v } })} />
      <SliderRow label="Lifespan" value={b.lifespanMs} min={200} max={2000} step={20} unit="ms"
        onChange={(v) => onPatch({ burst: { ...b, lifespanMs: v } })} />
      <SliderRow label="Drag" value={b.drag} min={0} max={8} step={0.05}
        onChange={(v) => onPatch({ burst: { ...b, drag: v } })} />
      <SliderRow label="Size variance" value={b.sizeVariance} min={0} max={3} step={0.05}
        onChange={(v) => onPatch({ burst: { ...b, sizeVariance: v } })} />
    </>
  );
}

/* ---------- Path Pulse ---------- */

function PulsePanel({
  a,
  onPatch,
}: {
  a: AestheticConfig;
  onPatch: (p: Partial<AestheticConfig>) => void;
}) {
  const pp = a.pathPulse;
  return (
    <>
      <SectionLabel>Perimeter pulse</SectionLabel>
      <SwitchRow label="Enabled" checked={pp.enabled} onChange={(v) => onPatch({ pathPulse: { ...pp, enabled: v } })} />
      <SliderRow label="Speed" value={pp.speed} min={0.2} max={4} step={0.05}
        onChange={(v) => onPatch({ pathPulse: { ...pp, speed: v } })} />
      <SliderRow label="Width" value={pp.widthPx} min={1} max={8} step={0.5} unit="px"
        onChange={(v) => onPatch({ pathPulse: { ...pp, widthPx: v } })} />
    </>
  );
}

/* ---------- Climax ---------- */

function ClimaxPanel({
  a,
  onPatch,
}: {
  a: AestheticConfig;
  onPatch: (p: Partial<AestheticConfig>) => void;
}) {
  const c = a.climax;
  return (
    <>
      <SectionLabel>Macro-cycle climax</SectionLabel>
      <SwitchRow label="Ambient flash" checked={c.ambientFlash}
        onChange={(v) => onPatch({ climax: { ...c, ambientFlash: v } })} />
      <SwitchRow label="Stardust field" checked={c.stardust}
        onChange={(v) => onPatch({ climax: { ...c, stardust: v } })} />
      <SliderRow label="Stardust count" value={c.stardustCount} min={0} max={80} step={1}
        onChange={(v) => onPatch({ climax: { ...c, stardustCount: Math.round(v) } })} />
    </>
  );
}

/* ============================================================
 *  Preset panel
 * ============================================================ */

function PresetPanel({
  presets,
  selectedId,
  onLoad,
  onNew,
  onSaveAs,
  onDelete,
  onExport,
  onImport,
}: {
  presets: PresetMap;
  selectedId: string | null;
  onLoad: (id: string) => void;
  onNew: () => void;
  onSaveAs: () => void;
  onDelete?: () => void;
  onExport: () => void;
  onImport: () => void;
}) {
  const sorted = Object.values(presets).sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2">
        <SectionLabel>Presets</SectionLabel>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" onClick={onNew} title="New">
            <Plus className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onSaveAs} title="Save as…">
            <Save className="h-3 w-3" />
          </Button>
          {onDelete && (
            <Button size="sm" variant="ghost" onClick={onDelete} title="Delete">
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <select
        value={selectedId ?? ""}
        onChange={(e) => e.target.value && onLoad(e.target.value)}
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
      >
        <option value="">— Load preset —</option>
        {sorted.map((p) => (
          <option key={p.id} value={p.id}>
            {p.blueprint.name} · {p.blueprint.path.type}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onImport} className="flex-1">
          <Upload className="h-3 w-3 mr-2" /> Import JSON
        </Button>
        <Button size="sm" variant="ghost" onClick={onExport} className="flex-1">
          <Download className="h-3 w-3 mr-2" /> Export JSON
        </Button>
      </div>
    </div>
  );
}

/* ============================================================
 *  Live preview canvas
 * ============================================================ */

function PreviewCanvas({
  bp,
  theater,
  onToggleTheater,
}: {
  bp: CustomSceneBlueprint;
  theater: boolean;
  onToggleTheater: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<CustomSceneState | null>(null);
  const startRef = useRef<number>(0);
  const bpRef = useRef(bp);
  bpRef.current = bp;

  const [cycle, setCycle] = useState({ baseLaps: 10, macroCycleSeconds: 12, noteCount: 8 });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    startRef.current = performance.now();
    let raf = 0;
    // Ensure our local blueprint drives the preview draw; live-publish
    // in the page effect keeps this in sync with the app runtime too.
    setActiveBlueprint(bpRef.current);

    const loop = () => {
      const now = performance.now();
      const t = (now - startRef.current) / 1000;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      setActiveBlueprint(bpRef.current);
      const globals: SceneGlobals = {
        W, H,
        bpm: 90,
        speed: 1,
        density: cycle.noteCount,
        pitchSemis: 0,
        audioNow: 0,
        globalTime: t,
        baseLaps: cycle.baseLaps,
        macroCycleSeconds: cycle.macroCycleSeconds,
        noteCount: cycle.noteCount,
      };
      if (!stateRef.current) stateRef.current = customScene.init(globals);
      // Fade previous frame (trail decay).
      customScene.preClear?.(ctx, globals);
      customScene.sample?.(stateRef.current, t, globals);
      customScene.draw(stateRef.current, ctx, globals);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [cycle]);

  const bg = bp.aesthetic.background;

  return (
    <div className="space-y-3">
      <div
        ref={wrapRef}
        className={
          theater
            ? "relative h-[calc(100vh-2rem)] w-full overflow-hidden rounded-xl border border-white/10 bg-black"
            : "relative aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-black"
        }
      >
        {/* Background media */}
        {bg.kind !== "none" && bg.url && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: bg.opacity,
              filter: `blur(${bg.blurPx}px)`,
            }}
          >
            {bg.kind === "video" ? (
              <video
                src={bg.url}
                autoPlay
                muted
                loop
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bg.url} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        )}
        <canvas ref={ref} className="absolute inset-0 h-full w-full" />

        {/* Theater toggle */}
        <button
          onClick={onToggleTheater}
          className="absolute right-3 top-3 rounded-md border border-white/10 bg-black/40 p-2 text-white/80 backdrop-blur hover:text-white"
          title={theater ? "Exit theater (Esc)" : "Theater mode"}
        >
          {theater ? <Minimize className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
        </button>
        {theater && (
          <button
            onClick={onToggleTheater}
            className="absolute left-3 top-3 rounded-md border border-white/10 bg-black/40 p-2 text-white/80 backdrop-blur hover:text-white"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!theater && (
        <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
          <SectionLabel>Preview cycle</SectionLabel>
          <SliderRow label="Base laps" value={cycle.baseLaps} min={1} max={40} step={1}
            onChange={(v) => setCycle((c) => ({ ...c, baseLaps: Math.round(v) }))} />
          <SliderRow label="Macro cycle" value={cycle.macroCycleSeconds} min={2} max={60} step={1} unit="s"
            onChange={(v) => setCycle((c) => ({ ...c, macroCycleSeconds: Math.round(v) }))} />
          <SliderRow label="Notes" value={cycle.noteCount} min={4} max={24} step={1}
            onChange={(v) => setCycle((c) => ({ ...c, noteCount: Math.round(v) }))} />
        </div>
      )}
    </div>
  );
}

/* ============================================================
 *  Small shared UI atoms
 * ============================================================ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">{children}</Label>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
    >
      {children}
    </select>
  );
}

function SliderRow({
  label, value, min, max, step, onChange, unit,
}: {
  label: string;
  value: number;
  min: number; max: number; step: number;
  onChange: (n: number) => void;
  unit?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-foreground/60">
        <span>{label}</span>
        <span className="tabular-nums text-foreground/80">
          {typeof value === "number" ? value.toFixed(step >= 1 ? 0 : 2) : value}
          {unit ?? ""}
        </span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-foreground/70">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}