import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Image as ImageIcon, Film, Play as PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  listAdminScenes,
  createAdminScene,
  updateAdminScene,
  deleteAdminScene,
  createSceneAssetUploadUrl,
  signedAdminSceneAssetUrl,
  SCENE_ENGINES,
  DEFAULT_THEME,
  DEFAULT_FX,
  DEFAULT_REACTIVE,
  DEFAULT_CYCLE,
  type SceneRow,
  type SceneEngineId,
  type ThemeColors,
  type VisualFx,
  type AudioReactive,
} from "@/lib/admin/scenes.functions";

export const Route = createFileRoute("/studio/scenes")({
  ssr: false,
  component: ScenesAdmin,
});

const ENGINE_LABELS: Record<SceneEngineId, string> = {
  stringNet: "String Network",
  pendulumFan: "Pendulum Fan",
  spiralArp: "Spiral Arpeggiator",
  radialSweep: "Radial Sweep",
  mandalaMatrix: "Mandala Matrix",
  metatronLattice: "Metatron Lattice",
  fractalNebula: "Fractal Nebula",
  radialResonator: "Radial Resonator",
};

function ScenesAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(listAdminScenes);
  const create = useServerFn(createAdminScene);
  const del = useServerFn(deleteAdminScene);

  const scenesQ = useQuery({
    queryKey: ["admin", "scenes"],
    queryFn: () => list(),
  });

  const scenes = scenesQ.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = scenes.find((s) => s.id === selectedId) ?? scenes[0] ?? null;
  useEffect(() => {
    if (!selectedId && scenes[0]) setSelectedId(scenes[0].id);
  }, [scenes, selectedId]);

  const createMut = useMutation({
    mutationFn: (name: string) => create({ data: { name } }),
    onSuccess: async ({ id }) => {
      await qc.invalidateQueries({ queryKey: ["admin", "scenes"] });
      setSelectedId(id);
      toast.success("Scene created");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "scenes"] });
      setSelectedId(null);
      toast.success("Scene deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="grid grid-cols-[220px_1fr] gap-6">
      <aside className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">Scenes</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const name = window.prompt("Scene name?");
              if (name?.trim()) createMut.mutate(name.trim());
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="space-y-1">
          {scenes.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition ${
                selected?.id === s.id
                  ? "bg-white/10 text-foreground"
                  : "text-foreground/70 hover:bg-white/5"
              }`}
            >
              <span className="flex-1 truncate">{s.name}</span>
              {s.is_published && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300">
                  live
                </span>
              )}
            </button>
          ))}
          {scenes.length === 0 && (
            <div className="text-xs text-foreground/50">No scenes yet.</div>
          )}
        </div>
      </aside>

      {selected ? (
        <SceneEditor
          key={selected.id}
          scene={selected}
          onDelete={() => {
            if (confirm(`Delete "${selected.name}"? This cannot be undone.`)) {
              delMut.mutate(selected.id);
            }
          }}
        />
      ) : (
        <div className="rounded-lg border border-white/10 p-8 text-sm text-foreground/60">
          Create a scene to get started.
        </div>
      )}
    </div>
  );
}

function SceneEditor({ scene, onDelete }: { scene: SceneRow; onDelete: () => void }) {
  const qc = useQueryClient();
  const update = useServerFn(updateAdminScene);
  const signUpload = useServerFn(createSceneAssetUploadUrl);
  const signRead = useServerFn(signedAdminSceneAssetUrl);

  const [name, setName] = useState(scene.name);
  const [engine, setEngine] = useState<SceneEngineId>(scene.trigger_engine_id);
  const [theme, setTheme] = useState<ThemeColors>(scene.ui_theme_colors ?? DEFAULT_THEME);
  const [fx, setFx] = useState<VisualFx>(scene.visual_fx ?? DEFAULT_FX);
  const [reactive, setReactive] = useState<AudioReactive>(scene.audio_reactive ?? DEFAULT_REACTIVE);
  const [bgPath, setBgPath] = useState<string | null>(scene.background_path);
  const [bgType, setBgType] = useState<"image" | "video">(scene.background_type);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [baseLaps, setBaseLaps] = useState<number>(scene.base_laps ?? DEFAULT_CYCLE.base_laps);
  const [macroCycle, setMacroCycle] = useState<number>(
    scene.macro_cycle_seconds ?? DEFAULT_CYCLE.macro_cycle_seconds,
  );
  const [noteCount, setNoteCount] = useState<number>(scene.note_count ?? DEFAULT_CYCLE.note_count);

  // Resolve signed URL for preview
  useEffect(() => {
    let cancelled = false;
    if (!bgPath) {
      setBgUrl(null);
      return;
    }
    signRead({ data: { path: bgPath } })
      .then(({ url }) => {
        if (!cancelled) setBgUrl(url);
      })
      .catch(() => {
        if (!cancelled) setBgUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bgPath, signRead]);

  type SavePatch = Parameters<typeof update>[0]["data"];
  const saveMut = useMutation({
    mutationFn: (patch: SavePatch) => update({ data: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "scenes"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  // Debounced save when any tracked field changes
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const h = setTimeout(() => {
      saveMut.mutate({
        id: scene.id,
        name,
        trigger_engine_id: engine,
        ui_theme_colors: theme,
        visual_fx: fx,
        audio_reactive: reactive,
        background_type: bgType,
        background_path: bgPath,
        base_laps: baseLaps,
        macro_cycle_seconds: macroCycle,
        note_count: noteCount,
      });
    }, 500);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, engine, theme, fx, reactive, bgPath, bgType, baseLaps, macroCycle, noteCount]);

  const handleFile = useCallback(
    async (file: File) => {
      if (uploading) return;
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) {
        toast.error("Only image or video files are supported.");
        return;
      }
      const maxBytes = isVideo ? 15 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxBytes) {
        toast.error(`File too large. Max ${isVideo ? "15 MB video" : "5 MB image"}.`);
        return;
      }
      setUploading(true);
      try {
        const ext = (file.name.split(".").pop() ?? (isVideo ? "mp4" : "png")).toLowerCase();
        const path = `${scene.id}/${Date.now()}.${ext}`;
        const { signedUrl } = await signUpload({ data: { path } });
        const res = await fetch(signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type, "x-upsert": "true" },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        setBgPath(path);
        setBgType(isVideo ? "video" : "image");
        toast.success("Background uploaded");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [scene.id, signUpload, uploading],
  );

  return (
    <div className="grid grid-cols-[1fr_1fr] gap-6">
      {/* Editor form */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="max-w-xs bg-white/5"
          />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-foreground/70">
              <span>Published</span>
              <Switch
                checked={scene.is_published}
                onCheckedChange={(v) =>
                  saveMut.mutate({ id: scene.id, is_published: v })
                }
              />
            </div>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <MediaDropzone
          bgType={bgType}
          bgUrl={bgUrl}
          uploading={uploading}
          onFile={handleFile}
          onClear={() => {
            setBgPath(null);
            setBgUrl(null);
          }}
        />

        <section className="space-y-2">
          <Label className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">
            Physics engine
          </Label>
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value as SceneEngineId)}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
          >
            {SCENE_ENGINES.map((id) => (
              <option key={id} value={id}>
                {ENGINE_LABELS[id]}
              </option>
            ))}
          </select>
        </section>

        <section className="space-y-3">
          <Label className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">
            Global palette
          </Label>
          <ColorRow label="Node glow" value={theme.nodeGlow} onChange={(v) => setTheme({ ...theme, nodeGlow: v })} />
          <ColorRow label="Wireframe" value={theme.wireframe} onChange={(v) => setTheme({ ...theme, wireframe: v })} />
          <ColorRow label="Dock accent" value={theme.dockAccent} onChange={(v) => setTheme({ ...theme, dockAccent: v })} />
          <ColorRow label="Text accent" value={theme.textAccent} onChange={(v) => setTheme({ ...theme, textAccent: v })} />
        </section>

        <section className="space-y-3">
          <Label className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">
            Visual FX
          </Label>
          <SliderRow
            label="Background blur"
            value={fx.backgroundBlur}
            min={0}
            max={40}
            step={1}
            unit="px"
            onChange={(v) => setFx({ ...fx, backgroundBlur: v })}
          />
          <SliderRow
            label="Background glow"
            value={fx.backgroundGlow}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => setFx({ ...fx, backgroundGlow: v })}
          />
          <SliderRow
            label="Trail persistence"
            value={fx.trailPersistence}
            min={0}
            max={0.5}
            step={0.01}
            onChange={(v) => setFx({ ...fx, trailPersistence: v })}
          />
        </section>

        <section className="space-y-3">
          <Label className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">
            Audio-reactive
          </Label>
          <SliderRow
            label="Amplitude"
            value={reactive.amplitude}
            min={0}
            max={2}
            step={0.05}
            unit="×"
            onChange={(v) => setReactive({ ...reactive, amplitude: v })}
          />
          <SliderRow
            label="Threshold"
            value={reactive.threshold}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => setReactive({ ...reactive, threshold: v })}
          />
          <ToggleRow
            label="Scale pulse"
            value={reactive.scalePulse}
            onChange={(v) => setReactive({ ...reactive, scalePulse: v })}
          />
          <ToggleRow
            label="Opacity pulse"
            value={reactive.opacityPulse}
            onChange={(v) => setReactive({ ...reactive, opacityPulse: v })}
          />
          <ToggleRow
            label="Blur pulse"
            value={reactive.blurPulse}
            onChange={(v) => setReactive({ ...reactive, blurPulse: v })}
          />
        </section>

        <section className="space-y-3">
          <Label className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">
            Macro-cycle (Phase-Alignment)
          </Label>
          <div className="text-[10px] leading-relaxed text-foreground/50">
            Every note completes an integer number of laps per macro-cycle
            (laps<sub>i</sub> = base + i) so all notes snap back to unison at
            the end of every cycle. All eight engines obey this rule.
          </div>
          <SliderRow
            label="Base laps"
            value={baseLaps}
            min={1}
            max={40}
            step={1}
            onChange={(v) => setBaseLaps(Math.round(v))}
          />
          <SliderRow
            label="Macro-cycle"
            value={macroCycle}
            min={2}
            max={180}
            step={1}
            unit="s"
            onChange={(v) => setMacroCycle(Math.round(v))}
          />
          <SliderRow
            label="Notes"
            value={noteCount}
            min={4}
            max={24}
            step={1}
            onChange={(v) => setNoteCount(Math.round(v))}
          />
        </section>
      </div>

      {/* Live preview */}
      <div className="sticky top-4 h-fit">
        <PreviewCanvas
          bgUrl={bgUrl}
          bgType={bgType}
          theme={theme}
          fx={fx}
          reactive={reactive}
          engine={engine}
        />
      </div>
    </div>
  );
}

function MediaDropzone({
  bgType,
  bgUrl,
  uploading,
  onFile,
  onClear,
}: {
  bgType: "image" | "video";
  bgUrl: string | null;
  uploading: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <section className="space-y-2">
      <Label className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">
        Background media
      </Label>
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={`rounded-lg border-2 border-dashed p-6 text-center transition ${
          drag ? "border-emerald-400 bg-emerald-400/5" : "border-white/15 bg-white/5"
        }`}
      >
        {bgUrl ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-foreground/70">
              {bgType === "video" ? <Film className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
              <span className="truncate">{bgType} loaded</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => inputRef.current?.click()}>
                <Upload className="h-3 w-3 mr-1" /> Replace
              </Button>
              <Button size="sm" variant="ghost" onClick={onClear}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="mx-auto h-6 w-6 text-foreground/40" />
            <div className="text-xs text-foreground/60">
              Drop image (≤5 MB) or video (.mp4/.webm ≤15 MB) here
            </div>
            <Button size="sm" variant="ghost" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? "Uploading…" : "Browse"}
            </Button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/*,video/mp4,video/webm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </section>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-foreground/70">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="max-w-[8rem] bg-white/5 font-mono text-xs"
      />
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground/70">{label}</span>
        <span className="tabular-nums text-foreground/80">
          {value.toFixed(step < 1 ? 2 : 0)}
          {unit ?? ""}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-foreground/70">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

/* =============== Live preview canvas =============== */

function PreviewCanvas({
  bgUrl,
  bgType,
  theme,
  fx,
  reactive,
  engine,
}: {
  bgUrl: string | null;
  bgType: "image" | "video";
  theme: ThemeColors;
  fx: VisualFx;
  reactive: AudioReactive;
  engine: SceneEngineId;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const intensityRef = useRef(0);
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);

  // Reactive decay loop — mutates CSS vars on the wrapper
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      intensityRef.current *= 0.92; // exponential decay
      const el = wrapRef.current;
      if (el) {
        const i = intensityRef.current * reactive.amplitude;
        el.style.setProperty(
          "--scene-scale",
          reactive.scalePulse ? String(1 + i * 0.08) : "1",
        );
        el.style.setProperty(
          "--scene-opacity",
          reactive.opacityPulse ? String(0.5 + fx.backgroundGlow * 0.5 + i * 0.4) : String(0.5 + fx.backgroundGlow * 0.5),
        );
        el.style.setProperty(
          "--scene-blur",
          `${fx.backgroundBlur + (reactive.blurPulse ? i * 12 : 0)}px`,
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reactive, fx]);

  const pulse = useCallback((v = 1) => {
    if (v < reactive.threshold) return;
    intensityRef.current = Math.min(1, intensityRef.current + v);
  }, [reactive.threshold]);

  const testTone = useCallback(async () => {
    let ctx = audioCtx;
    if (!ctx) {
      const Ctor = (window as unknown as { AudioContext: typeof AudioContext }).AudioContext;
      ctx = new Ctor();
      setAudioCtx(ctx);
    }
    if (ctx.state === "suspended") await ctx.resume();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 432;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.65);
    pulse(1);
  }, [audioCtx, pulse]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">
          Styling preview
        </Label>
        <Button size="sm" variant="ghost" onClick={testTone}>
          <PlayIcon className="h-3 w-3 mr-1" /> Test pulse
        </Button>
      </div>
      <div
        ref={wrapRef}
        className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-black"
        style={{
          ["--node-glow" as string]: theme.nodeGlow,
          ["--wire-color" as string]: theme.wireframe,
          ["--scene-scale" as string]: 1,
          ["--scene-opacity" as string]: 1,
          ["--scene-blur" as string]: `${fx.backgroundBlur}px`,
        }}
      >
        {/* Background media */}
        {bgUrl ? (
          bgType === "video" ? (
            <video
              src={bgUrl}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                transform: "scale(var(--scene-scale))",
                opacity: "var(--scene-opacity)",
                filter: "blur(var(--scene-blur))",
                transition: "transform 60ms linear, opacity 60ms linear",
              }}
            />
          ) : (
            <img
              src={bgUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                transform: "scale(var(--scene-scale))",
                opacity: "var(--scene-opacity)",
                filter: "blur(var(--scene-blur))",
                transition: "transform 60ms linear, opacity 60ms linear",
              }}
            />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-foreground/40">
            No background — drop media above
          </div>
        )}
        {/* Palette + engine indicator overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ color: theme.nodeGlow }}
        >
          <div
            className="flex flex-col items-center gap-2 rounded-lg bg-black/40 px-4 py-3 backdrop-blur-sm"
            style={{
              boxShadow: `0 0 40px ${theme.nodeGlow}`,
              border: `1px solid ${theme.wireframe}55`,
            }}
          >
            <div
              className="h-3 w-3 rounded-full"
              style={{
                background: theme.nodeGlow,
                boxShadow: `0 0 ${8 + intensityRef.current * 24}px ${theme.nodeGlow}`,
              }}
            />
            <span
              className="text-[10px] uppercase tracking-[0.24em]"
              style={{ color: theme.textAccent }}
            >
              {ENGINE_LABELS[engine]}
            </span>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-foreground/50">
        This checks media, palette, and reactive styling only. It does not simulate musical timing
        or Trigger Engine geometry. Use the authoritative previews on the Studio overview for those
        systems.
      </p>
    </div>
  );
}

// keep type-only import to avoid unused; useMemo removed
void useMemo;
