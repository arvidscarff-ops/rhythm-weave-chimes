import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Download, Upload, Play, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_BLUEPRINT,
  type CustomSceneBlueprint,
  type PathType,
  type SizingMode,
  type TriggerMode,
} from "@/lib/engine/pathTransformer";
import {
  deletePreset,
  exportJson,
  importJson,
  loadPresets,
  newBlueprint,
  newPresetId,
  savePreset,
  type PresetMap,
} from "@/lib/studio/sceneBuilderStore";
import { setActiveBlueprint } from "@/lib/scenes/activeBlueprint";
import { customScene, type CustomSceneState } from "@/lib/scenes/customScene";
import type { SceneGlobals } from "@/lib/engine/sceneTypes";

export const Route = createFileRoute("/studio/builder")({
  ssr: false,
  component: BuilderPage,
});

function BuilderPage() {
  const [presets, setPresets] = useState<PresetMap>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bp, setBp] = useState<CustomSceneBlueprint>(DEFAULT_BLUEPRINT);

  // Hydrate LocalStorage on mount (client-only).
  useEffect(() => {
    const p = loadPresets();
    setPresets(p);
    const first = Object.values(p).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (first) {
      setSelectedId(first.id);
      setBp(first.blueprint);
    }
  }, []);

  const handleNew = () => {
    const id = newPresetId();
    const fresh = newBlueprint(`Preset ${Object.keys(presets).length + 1}`);
    const stored = savePreset(id, fresh);
    setPresets({ ...presets, [id]: stored });
    setSelectedId(id);
    setBp(fresh);
  };

  const handleSave = () => {
    if (!selectedId) {
      const id = newPresetId();
      const stored = savePreset(id, bp);
      setPresets({ ...presets, [id]: stored });
      setSelectedId(id);
    } else {
      const stored = savePreset(selectedId, bp);
      setPresets({ ...presets, [selectedId]: stored });
    }
    toast.success("Preset saved");
  };

  const handleDelete = () => {
    if (!selectedId) return;
    if (!confirm(`Delete "${bp.name}"?`)) return;
    deletePreset(selectedId);
    const next = { ...presets };
    delete next[selectedId];
    setPresets(next);
    setSelectedId(null);
    setBp(DEFAULT_BLUEPRINT);
  };

  const handleLoadActive = () => {
    setActiveBlueprint(bp);
    toast.success(`"${bp.name}" is now the active custom scene`, {
      description: "Open the app and pick Scene → Custom to hear it.",
    });
  };

  const handleExport = () => {
    const text = exportJson(bp);
    navigator.clipboard.writeText(text).then(
      () => toast.success("JSON copied to clipboard"),
      () => toast.error("Copy failed"),
    );
  };

  const handleImport = () => {
    const text = window.prompt("Paste blueprint JSON:");
    if (!text) return;
    const parsed = importJson(text);
    if (!parsed) return toast.error("Invalid blueprint JSON");
    setBp(parsed);
    toast.success("Blueprint loaded — remember to Save");
  };

  return (
    <div className="grid grid-cols-[200px_1fr_1fr] gap-6">
      {/* Preset sidebar */}
      <aside className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">Presets</span>
          <Button size="sm" variant="ghost" onClick={handleNew} title="New preset">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="space-y-1">
          {Object.values(presets)
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedId(p.id);
                  setBp(p.blueprint);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition ${
                  selectedId === p.id
                    ? "bg-white/10 text-foreground"
                    : "text-foreground/70 hover:bg-white/5"
                }`}
              >
                <span className="flex-1 truncate">{p.blueprint.name}</span>
                <span className="text-[9px] uppercase tracking-wider text-foreground/40">
                  {p.blueprint.path.type}
                </span>
              </button>
            ))}
          {Object.keys(presets).length === 0 && (
            <div className="text-xs text-foreground/50">No presets yet.</div>
          )}
        </div>
        <div className="flex flex-col gap-1 pt-3">
          <Button size="sm" variant="ghost" onClick={handleImport}>
            <Upload className="h-3 w-3 mr-2" /> Import JSON
          </Button>
          <Button size="sm" variant="ghost" onClick={handleExport} disabled={!bp}>
            <Download className="h-3 w-3 mr-2" /> Copy JSON
          </Button>
        </div>
      </aside>

      {/* Config panel */}
      <ConfigPanel
        bp={bp}
        onChange={setBp}
        onSave={handleSave}
        onDelete={selectedId ? handleDelete : undefined}
        onLoadActive={handleLoadActive}
      />

      {/* Live preview */}
      <div className="sticky top-4 h-fit">
        <PreviewCanvas bp={bp} />
      </div>
    </div>
  );
}

/* ============================================================
 * Config Panel — all editable blueprint fields.
 * ============================================================ */
function ConfigPanel({
  bp,
  onChange,
  onSave,
  onDelete,
  onLoadActive,
}: {
  bp: CustomSceneBlueprint;
  onChange: (bp: CustomSceneBlueprint) => void;
  onSave: () => void;
  onDelete?: () => void;
  onLoadActive: () => void;
}) {
  const update = <K extends keyof CustomSceneBlueprint>(k: K, v: CustomSceneBlueprint[K]) =>
    onChange({ ...bp, [k]: v });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Input
          value={bp.name}
          onChange={(e) => update("name", e.target.value)}
          className="max-w-xs bg-white/5"
        />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onLoadActive}>
            <Play className="h-3 w-3 mr-2" /> Load into app
          </Button>
          <Button size="sm" onClick={onSave}>
            <Save className="h-3 w-3 mr-2" /> Save
          </Button>
          {onDelete && (
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Path Type */}
      <section className="space-y-3">
        <Label className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">Path type</Label>
        <select
          value={bp.path.type}
          onChange={(e) => update("path", { ...bp.path, type: e.target.value as PathType })}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
        >
          <option value="circle">Circle / Arc</option>
          <option value="line">Line (linear)</option>
          <option value="polygon">Polygon (triangle / square / custom)</option>
          <option value="lissajous">Lissajous / parametric wave</option>
        </select>

        {bp.path.type === "polygon" && (
          <SliderRow
            label="Sides"
            value={bp.path.sides ?? 3}
            min={3}
            max={12}
            step={1}
            onChange={(v) => update("path", { ...bp.path, sides: Math.round(v) })}
          />
        )}
        {bp.path.type === "line" && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-foreground/60">Axis</span>
            <select
              value={bp.path.axis ?? "x"}
              onChange={(e) => update("path", { ...bp.path, axis: e.target.value as "x" | "y" })}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1"
            >
              <option value="x">Horizontal</option>
              <option value="y">Vertical</option>
            </select>
          </div>
        )}
        {bp.path.type === "lissajous" && (
          <>
            <SliderRow
              label="Freq X"
              value={bp.path.freqX ?? 3}
              min={1}
              max={9}
              step={1}
              onChange={(v) => update("path", { ...bp.path, freqX: Math.round(v) })}
            />
            <SliderRow
              label="Freq Y"
              value={bp.path.freqY ?? 2}
              min={1}
              max={9}
              step={1}
              onChange={(v) => update("path", { ...bp.path, freqY: Math.round(v) })}
            />
            <SliderRow
              label="Phase"
              value={bp.path.phase ?? Math.PI / 2}
              min={0}
              max={Math.PI * 2}
              step={0.01}
              onChange={(v) => update("path", { ...bp.path, phase: v })}
            />
          </>
        )}
      </section>

      {/* Layout */}
      <section className="space-y-3">
        <Label className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">Layout & spacing</Label>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-foreground/60">Sizing</span>
          <select
            value={bp.layout.sizing}
            onChange={(e) => update("layout", { ...bp.layout, sizing: e.target.value as SizingMode })}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1"
          >
            <option value="linear">Linear (uniform growth)</option>
            <option value="exponential">Exponential</option>
            <option value="constant">Constant + offset</option>
          </select>
        </div>
        <SliderRow
          label="Base size"
          value={bp.layout.baseSize}
          min={0.05}
          max={0.95}
          step={0.01}
          onChange={(v) => update("layout", { ...bp.layout, baseSize: v })}
        />
        <SliderRow
          label="Step"
          value={bp.layout.step}
          min={0}
          max={0.5}
          step={0.01}
          onChange={(v) => update("layout", { ...bp.layout, step: v })}
        />
        <SliderRow
          label="Rotation offset"
          value={bp.layout.rotationOffsetDeg}
          min={0}
          max={360}
          step={1}
          unit="°"
          onChange={(v) => update("layout", { ...bp.layout, rotationOffsetDeg: v })}
        />
        <div className="flex items-center gap-2 text-xs">
          <span className="text-foreground/60">Track count</span>
          <select
            value={bp.layout.trackCount === null ? "auto" : "manual"}
            onChange={(e) => {
              const v = e.target.value;
              update("layout", {
                ...bp.layout,
                trackCount: v === "auto" ? null : bp.layout.trackCount ?? 8,
              });
            }}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1"
          >
            <option value="auto">Follow noteCount</option>
            <option value="manual">Manual override</option>
          </select>
          {bp.layout.trackCount !== null && (
            <Input
              type="number"
              min={1}
              max={48}
              value={bp.layout.trackCount}
              onChange={(e) => update("layout", { ...bp.layout, trackCount: Number(e.target.value) })}
              className="h-7 w-20 bg-white/5"
            />
          )}
        </div>
      </section>

      {/* Trigger */}
      <section className="space-y-3">
        <Label className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">Trigger</Label>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-foreground/60">Mode</span>
          <select
            value={bp.trigger.mode}
            onChange={(e) => update("trigger", { ...bp.trigger, mode: e.target.value as TriggerMode })}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1"
          >
            <option value="boundary">Boundary (progress = 0/1)</option>
            <option value="axisIntersect">Axis intersect (line crossing)</option>
          </select>
        </div>
        {bp.trigger.mode === "axisIntersect" && (
          <>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-foreground/60">Axis</span>
              <select
                value={bp.trigger.axis ?? "x"}
                onChange={(e) => update("trigger", { ...bp.trigger, axis: e.target.value as "x" | "y" })}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1"
              >
                <option value="x">Vertical line (x = position)</option>
                <option value="y">Horizontal line (y = position)</option>
              </select>
            </div>
            <SliderRow
              label="Position"
              value={bp.trigger.position ?? 0}
              min={-1}
              max={1}
              step={0.01}
              onChange={(v) => update("trigger", { ...bp.trigger, position: v })}
            />
          </>
        )}
      </section>

      {/* Voice */}
      <section className="space-y-3">
        <Label className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">Voice</Label>
        <SliderRow
          label="Pack slot"
          value={bp.voice.slot}
          min={0}
          max={5}
          step={1}
          onChange={(v) =>
            update("voice", { ...bp.voice, slot: Math.round(v) as CustomSceneBlueprint["voice"]["slot"] })
          }
        />
      </section>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
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

/* ============================================================
 * Live preview canvas — runs `customScene` on an in-memory blueprint.
 * Standalone so edits react instantly without touching the app runtime.
 * ============================================================ */
function PreviewCanvas({ bp }: { bp: CustomSceneBlueprint }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<CustomSceneState | null>(null);
  const startRef = useRef<number>(0);
  const bpRef = useRef(bp);
  bpRef.current = bp;

  // Local override so the preview doesn't collide with the app's active
  // blueprint. `activeBlueprint` is a module singleton; we temporarily
  // point it at the preview blueprint during the RAF, then restore.
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

    // Point activeBlueprint at the preview so customScene reads from it.
    // We restore on unmount so the app's active blueprint isn't clobbered.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      getActiveBlueprint,
      setActiveBlueprint,
    } = require("@/lib/scenes/activeBlueprint") as typeof import("@/lib/scenes/activeBlueprint");
    const prevActive = getActiveBlueprint();

    const loop = () => {
      const now = performance.now();
      const t = (now - startRef.current) / 1000;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      // Sync the singleton every frame with the latest preview bp.
      setActiveBlueprint(bpRef.current);
      const globals: SceneGlobals = {
        W,
        H,
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
      ctx.clearRect(0, 0, W, H);
      // Faint radial background so wireframes stand out.
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) / 2);
      bg.addColorStop(0, "oklch(0.15 0.02 240 / 0.4)");
      bg.addColorStop(1, "oklch(0.05 0.01 240 / 0.9)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      customScene.sample?.(stateRef.current, t, globals);
      customScene.draw(stateRef.current, ctx, globals);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      setActiveBlueprint(prevActive);
    };
  }, [cycle]);

  return (
    <div className="space-y-3">
      <div className="aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-black">
        <canvas ref={ref} className="h-full w-full" />
      </div>
      <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">Preview cycle</div>
        <SliderRow
          label="Base laps"
          value={cycle.baseLaps}
          min={1}
          max={40}
          step={1}
          onChange={(v) => setCycle({ ...cycle, baseLaps: Math.round(v) })}
        />
        <SliderRow
          label="Macro cycle"
          value={cycle.macroCycleSeconds}
          min={2}
          max={60}
          step={1}
          unit="s"
          onChange={(v) => setCycle({ ...cycle, macroCycleSeconds: Math.round(v) })}
        />
        <SliderRow
          label="Notes"
          value={cycle.noteCount}
          min={4}
          max={24}
          step={1}
          onChange={(v) => setCycle({ ...cycle, noteCount: Math.round(v) })}
        />
      </div>
    </div>
  );
}