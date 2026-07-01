import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePasscode } from "@/lib/admin/passcode-context";
import { allPitchOptions, DEFAULT_PITCH, pitchToMidi } from "@/lib/music/pitch";
import { noteColor } from "@/lib/music/noteColors";
import { playPitch, primeAudio } from "@/lib/studio/handpanAudio";
import {
  listAdminScales,
  createAdminScale,
  updateAdminScale,
  deleteAdminScale,
  addProgressionStep,
  updateProgressionStep,
  removeProgressionStep,
  type AdminScale,
  type AdminProgressionStep,
} from "@/lib/admin/scales.functions";

type ToneState = "off" | "chord" | "accent";
function toneStateOf(step: AdminProgressionStep, idx: number): ToneState {
  if (step.chord_tones.includes(idx)) return "chord";
  if (step.accent_tones.includes(idx)) return "accent";
  return "off";
}
function nextToneState(s: ToneState): ToneState {
  return s === "off" ? "chord" : s === "chord" ? "accent" : "off";
}
function applyToneCycle(
  step: AdminProgressionStep,
  idx: number,
): { chord_tones: number[]; accent_tones: number[] } {
  const next = nextToneState(toneStateOf(step, idx));
  const chord = step.chord_tones.filter((n) => n !== idx);
  const accent = step.accent_tones.filter((n) => n !== idx);
  if (next === "chord") chord.push(idx);
  if (next === "accent") accent.push(idx);
  chord.sort((a, b) => a - b);
  accent.sort((a, b) => a - b);
  return { chord_tones: chord, accent_tones: accent };
}

export const Route = createFileRoute("/studio/scales")({
  ssr: false,
  component: AdminUI,
  head: () => ({
    meta: [
      { title: "My Studio · Scales & Progressions" },
      { name: "description", content: "Author generative scales and chord progressions for Phase." },
    ],
  }),
});

function AdminUI() {
  const qc = useQueryClient();
  const { get: getPass } = usePasscode();
  const list = useServerFn(listAdminScales);
  const create = useServerFn(createAdminScale);
  const del = useServerFn(deleteAdminScale);

  const scalesQ = useQuery({
    queryKey: ["admin", "scales"],
    queryFn: () => list({ data: { passcode: getPass() } }),
  });
  const scales = scalesQ.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = scales.find((s) => s.id === selectedId) ?? scales[0] ?? null;
  useEffect(() => {
    if (!selectedId && scales[0]) setSelectedId(scales[0].id);
  }, [scales, selectedId]);

  const createMut = useMutation({
    mutationFn: (name: string) => create({ data: { passcode: getPass(), name } }),
    onSuccess: async ({ id }) => {
      await qc.invalidateQueries({ queryKey: ["admin", "scales"] });
      await qc.invalidateQueries({ queryKey: ["published-scales"] });
      setSelectedId(id);
      toast.success("Scale created");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { passcode: getPass(), id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "scales"] });
      await qc.invalidateQueries({ queryKey: ["published-scales"] });
      setSelectedId(null);
      toast.success("Scale deleted");
    },
  });

  return (
    <div className="grid grid-cols-[260px_1fr] gap-6">
        <aside className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">Scales</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const name = window.prompt("Scale name?");
                if (name?.trim()) createMut.mutate(name.trim());
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-1">
            {scales.map((s) => (
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
            {scales.length === 0 && (
              <p className="px-2 py-4 text-xs text-foreground/50">No scales yet.</p>
            )}
          </div>
        </aside>

        <section className="min-w-0">
          {selected ? (
            <ScaleEditor
              key={selected.id}
              scale={selected}
              onDelete={() => {
                if (window.confirm(`Delete “${selected.name}”?`)) delMut.mutate(selected.id);
              }}
            />
          ) : (
            <p className="text-sm text-foreground/60">Create a scale to get started.</p>
          )}
        </section>
    </div>
  );
}

function ScaleEditor({ scale, onDelete }: { scale: AdminScale; onDelete: () => void }) {
  const qc = useQueryClient();
  const { get: getPass } = usePasscode();
  const update = useServerFn(updateAdminScale);
  const addStep = useServerFn(addProgressionStep);
  const updStep = useServerFn(updateProgressionStep);
  const rmStep = useServerFn(removeProgressionStep);

  const [name, setName] = useState(scale.name);
  const [pitches, setPitches] = useState<string[]>(
    scale.pitches.length > 0
      ? scale.pitches
      : ["D3", "A3", "Bb3", "C4", "D4", "E4", "F4", "A4"],
  );

  // Optimistic step state layered on top of server data.
  const [stepOverrides, setStepOverrides] = useState<Record<string, Partial<AdminProgressionStep>>>({});
  const steps: AdminProgressionStep[] = useMemo(
    () =>
      scale.steps.map((s) =>
        stepOverrides[s.id] ? { ...s, ...stepOverrides[s.id] } : s,
      ),
    [scale.steps, stepOverrides],
  );

  const [activeStepId, setActiveStepId] = useState<string | null>(steps[0]?.id ?? null);
  useEffect(() => {
    if (!activeStepId && steps[0]) setActiveStepId(steps[0].id);
    else if (activeStepId && !steps.find((s) => s.id === activeStepId)) {
      setActiveStepId(steps[0]?.id ?? null);
    }
  }, [steps, activeStepId]);
  const activeStep = steps.find((s) => s.id === activeStepId) ?? null;

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["admin", "scales"] });
    await qc.invalidateQueries({ queryKey: ["published-scales"] });
  };

  const saveMut = useMutation({
    mutationFn: (patch: Parameters<typeof update>[0]["data"]) =>
      update({ data: patch }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addStepMut = useMutation({
    mutationFn: () => addStep({ data: { passcode: getPass(), scale_id: scale.id } }),
    onSuccess: async ({ id }) => {
      await invalidate();
      setActiveStepId(id);
    },
  });

  const updStepMut = useMutation({
    mutationFn: (patch: {
      id: string;
      chord_tones?: number[];
      accent_tones?: number[];
      duration_bars?: number;
    }) => updStep({ data: { passcode: getPass(), ...patch } }),
    onSuccess: async (_r, vars) => {
      await invalidate();
      setStepOverrides((o) => {
        const { [vars.id]: _drop, ...rest } = o;
        return rest;
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rmStepMut = useMutation({
    mutationFn: (id: string) => rmStep({ data: { passcode: getPass(), id } }),
    onSuccess: invalidate,
  });

  const setStepPatch = (id: string, patch: Partial<AdminProgressionStep>) => {
    setStepOverrides((o) => ({ ...o, [id]: { ...o[id], ...patch } }));
  };

  const cycleTone = (idx: number) => {
    if (!activeStep) return;
    primeAudio();
    playPitch(pitches[idx] ?? DEFAULT_PITCH);
    const patch = applyToneCycle(activeStep, idx);
    setStepPatch(activeStep.id, patch);
    updStepMut.mutate({ id: activeStep.id, ...patch });
  };

  const commit = () =>
    saveMut.mutate({
      passcode: getPass(),
      id: scale.id,
      name,
      pool_size: pitches.length,
      pitches,
    });

  const publishMut = useMutation({
    mutationFn: (v: boolean) =>
      update({ data: { passcode: getPass(), id: scale.id, is_published: v } }),
    onSuccess: async (_r, v) => {
      await invalidate();
      toast.success(v ? "Published" : "Unpublished");
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.2em] text-foreground/60">
            Progression timeline
          </h2>
          <span className="text-[10px] uppercase tracking-wider text-foreground/40">
            {activeStep
              ? `Editing Step ${activeStep.step_order + 1} · ${activeStep.chord_tones.length} chord · ${activeStep.accent_tones.length} accent`
              : "No step selected"}
          </span>
        </div>
        <Filmstrip
          steps={steps}
          activeStepId={activeStepId}
          onSelect={setActiveStepId}
          onAdd={() => addStepMut.mutate()}
          onRemove={(id) => rmStepMut.mutate(id)}
          onDurationPreview={(id, bars) => setStepPatch(id, { duration_bars: bars })}
          onDurationCommit={(id, bars) => updStepMut.mutate({ id, duration_bars: bars })}
        />
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.2em] text-foreground/60">Scale</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="pub" className="text-xs">Published</Label>
              <Switch
                id="pub"
                checked={scale.is_published}
                onCheckedChange={(v) => publishMut.mutate(v)}
              />
            </div>
            <Button size="sm" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-3 w-3 mr-1" /> Delete
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-foreground/60">Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <HandpanField
          pitches={pitches}
          onChange={setPitches}
          activeStep={activeStep}
          onCycleTone={cycleTone}
        />

        <div className="flex justify-end">
          <Button size="sm" onClick={commit} disabled={saveMut.isPending}>
            Save scale
          </Button>
        </div>
      </div>
    </div>
  );
}

function HandpanField({
  pitches,
  onChange,
  activeStep,
  onCycleTone,
}: {
  pitches: string[];
  onChange: (next: string[]) => void;
  activeStep: AdminProgressionStep | null;
  onCycleTone: (idx: number) => void;
}) {
  const options = useMemo(() => allPitchOptions("C1", "C7"), []);
  const [ringing, setRinging] = useState<Record<number, number>>({});
  const timers = useRef<Record<number, number>>({});

  const pulse = (idx: number) => {
    const token = (ringing[idx] ?? 0) + 1;
    setRinging((r) => ({ ...r, [idx]: token }));
    if (timers.current[idx]) window.clearTimeout(timers.current[idx]);
    timers.current[idx] = window.setTimeout(() => {
      setRinging((r) => {
        if (r[idx] !== token) return r;
        const { [idx]: _drop, ...rest } = r;
        return rest;
      });
    }, 700);
  };

  const strike = (idx: number, pitch: string) => {
    primeAudio();
    playPitch(pitch);
    pulse(idx);
  };

  const handleSlot = (idx: number, pitch: string) => {
    pulse(idx);
    if (activeStep) onCycleTone(idx);
    else strike(idx, pitch);
  };

  const setPitch = (idx: number, value: string) => {
    const next = pitches.slice();
    next[idx] = value;
    onChange(next);
    strike(idx, value);
  };

  const addSlot = () => {
    const last = pitches[pitches.length - 1] ?? DEFAULT_PITCH;
    onChange([...pitches, last]);
  };
  const removeSlot = () => {
    if (pitches.length <= 1) return;
    onChange(pitches.slice(0, -1));
  };

  // Radial layout: slot 0 in the center (the "ding"), rest around a ring.
  const size = 460;
  const cx = size / 2;
  const cy = size / 2;
  const ringRadius = 170;
  const ringSlots = Math.max(0, pitches.length - 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-[0.18em] text-foreground/60">
          Handpan tone field
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-foreground/40">
            {pitches.length} note{pitches.length === 1 ? "" : "s"} · typical 8–12
          </span>
          <Button size="sm" variant="ghost" onClick={removeSlot} disabled={pitches.length <= 1}>
            <span className="text-base leading-none">−</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={addSlot}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div
        className="relative mx-auto rounded-full border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/40 shadow-inner"
        style={{ width: size, height: size }}
      >
        {pitches.map((p, i) => {
          let x: number, y: number;
          if (i === 0) {
            x = cx;
            y = cy;
          } else {
            const angle = ((i - 1) / ringSlots) * Math.PI * 2 - Math.PI / 2;
            x = cx + Math.cos(angle) * ringRadius;
            y = cy + Math.sin(angle) * ringRadius;
          }
          const isDing = i === 0;
          const slotSize = isDing ? 108 : 88;
          const isRinging = ringing[i] !== undefined;
          const color = noteColor(p);
          const c = color.cssVar;
          const tState: ToneState = activeStep ? toneStateOf(activeStep, i) : "off";
          const isChord = tState === "chord";
          const isAccent = tState === "accent";
          const dim = activeStep && tState === "off";
          const chordC = "oklch(0.78 0.16 195)"; // teal
          const accentC = "oklch(0.72 0.22 310)"; // violet
          const borderColor = isAccent
            ? accentC
            : isChord
              ? chordC
              : `color-mix(in oklab, ${c} ${isDing ? 70 : 55}%, transparent)`;
          const background = isChord
            ? `radial-gradient(circle at 32% 28%, color-mix(in oklab, ${chordC} 80%, transparent) 0%, color-mix(in oklab, ${chordC} 45%, transparent) 55%, rgba(0,0,0,0.55) 100%)`
            : isAccent
              ? `radial-gradient(circle at 50% 50%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.65) 60%, color-mix(in oklab, ${accentC} 25%, transparent) 100%)`
              : `radial-gradient(circle at 32% 28%, color-mix(in oklab, ${c} ${isDing ? 55 : 42}%, transparent) 0%, color-mix(in oklab, ${c} ${isDing ? 25 : 18}%, transparent) 45%, rgba(0,0,0,0.55) 100%)`;
          const glowColor = isAccent ? accentC : isChord ? chordC : c;
          const restingShadow = isChord
            ? `0 0 22px color-mix(in oklab, ${chordC} 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.15)`
            : isAccent
              ? `0 0 0 2px ${accentC}, 0 0 24px color-mix(in oklab, ${accentC} 55%, transparent)`
              : `inset 0 1px 0 rgba(255,255,255,0.10), 0 6px 18px rgba(0,0,0,0.35)`;
          return (
            <div
              key={i}
              className="absolute flex flex-col items-center gap-1"
              style={{
                left: x - slotSize / 2,
                top: y - slotSize / 2 - (isDing ? 0 : 8),
                width: slotSize,
              }}
            >
              <button
                type="button"
                onClick={() => handleSlot(i, p)}
                title={`${p} · ${color.name}${activeStep ? ` · ${tState}` : ""}`}
                className={`relative flex items-center justify-center rounded-full border transition-all duration-150 focus:outline-none focus-visible:ring-2 ${
                  isRinging ? "scale-[1.06] brightness-125" : "hover:brightness-110"
                } ${dim ? "opacity-45" : ""}`}
                style={{
                  width: slotSize,
                  height: slotSize,
                  borderColor,
                  borderWidth: isAccent ? 2 : 1,
                  background,
                  boxShadow: isRinging
                    ? `0 0 32px color-mix(in oklab, ${glowColor} 70%, transparent), inset 0 1px 0 rgba(255,255,255,0.15)`
                    : restingShadow,
                }}
              >
                <span className="pointer-events-none select-none font-mono text-lg tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
                  {p}
                </span>
                {isRinging && (
                  <span
                    key={ringing[i]}
                    className="pointer-events-none absolute inset-0 rounded-full animate-ping"
                    style={{ boxShadow: `0 0 0 2px color-mix(in oklab, ${glowColor} 55%, transparent)` }}
                  />
                )}
                {isAccent && (
                  <span
                    className="pointer-events-none absolute -inset-1 rounded-full animate-pulse"
                    style={{ boxShadow: `0 0 0 1px color-mix(in oklab, ${accentC} 45%, transparent)` }}
                  />
                )}
              </button>
              <div className="w-full flex items-center gap-1">
                <span
                  aria-hidden
                  className="h-2 w-2 flex-shrink-0 rounded-full ring-1 ring-black/40"
                  style={{ background: c }}
                />
                <Select value={p} onValueChange={(v) => setPitch(i, v)}>
                  <SelectTrigger className="h-6 border-white/10 bg-black/40 px-2 text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {options.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-xs">
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-[10px] uppercase tracking-wider text-foreground/40">
        {activeStep
          ? "Tap to cycle: Off → Chord (teal) → Accent (violet) → Off"
          : "Tap any note to hear it · polyphonic — notes ring out and overlap"}
      </p>
    </div>
  );
}

const PX_PER_BAR = 32;
const MIN_BARS = 1;
const MAX_BARS = 32;
const BLOCK_BASE = 56;
function blockWidth(bars: number) {
  return BLOCK_BASE + Math.max(MIN_BARS, Math.min(MAX_BARS, bars)) * PX_PER_BAR;
}

function Filmstrip({
  steps,
  activeStepId,
  onSelect,
  onAdd,
  onRemove,
  onDurationPreview,
  onDurationCommit,
}: {
  steps: AdminProgressionStep[];
  activeStepId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onDurationPreview: (id: string, bars: number) => void;
  onDurationCommit: (id: string, bars: number) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {steps.map((step) => (
        <FilmstripBlock
          key={step.id}
          step={step}
          active={step.id === activeStepId}
          onSelect={() => onSelect(step.id)}
          onRemove={() => onRemove(step.id)}
          onDurationPreview={(bars) => onDurationPreview(step.id, bars)}
          onDurationCommit={(bars) => onDurationCommit(step.id, bars)}
        />
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="flex h-[120px] w-[88px] flex-shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/15 text-foreground/50 transition hover:border-white/40 hover:text-foreground/80"
      >
        <Plus className="h-4 w-4" />
        <span className="text-[10px] uppercase tracking-wider">Add step</span>
      </button>
    </div>
  );
}

function FilmstripBlock({
  step,
  active,
  onSelect,
  onRemove,
  onDurationPreview,
  onDurationCommit,
}: {
  step: AdminProgressionStep;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDurationPreview: (bars: number) => void;
  onDurationCommit: (bars: number) => void;
}) {
  const dragging = useRef<null | { startX: number; startBars: number; sign: 1 | -1; last: number }>(null);

  const beginDrag = (e: React.PointerEvent<HTMLDivElement>, sign: 1 | -1) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = { startX: e.clientX, startBars: step.duration_bars, sign, last: step.duration_bars };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragging.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const delta = Math.round((dx / PX_PER_BAR) * d.sign);
    const next = Math.max(MIN_BARS, Math.min(MAX_BARS, d.startBars + delta));
    if (next !== d.last) {
      d.last = next;
      onDurationPreview(next);
    }
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragging.current;
    if (!d) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    if (d.last !== d.startBars) onDurationCommit(d.last);
    dragging.current = null;
  };

  const width = blockWidth(step.duration_bars);
  const chordCount = step.chord_tones.length;
  const accentCount = step.accent_tones.length;

  return (
    <div
      onClick={onSelect}
      className={`group relative flex h-[120px] flex-shrink-0 flex-col justify-between overflow-hidden rounded-lg border p-3 text-left transition cursor-pointer backdrop-blur-md ${
        active
          ? "border-teal-300/60 bg-white/[0.06]"
          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
      }`}
      style={{
        width,
        boxShadow: active
          ? "0 0 0 1px oklch(0.78 0.16 195 / 0.6), 0 0 26px oklch(0.78 0.16 195 / 0.35)"
          : undefined,
      }}
    >
      {/* film-perforations top/bottom */}
      <div className="pointer-events-none absolute inset-x-2 top-1 flex justify-between opacity-30">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-sm bg-white/40" />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-2 bottom-1 flex justify-between opacity-30">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-sm bg-white/40" />
        ))}
      </div>

      <div className="mt-3 flex items-start justify-between">
        <span className="pr-label text-white/80">Step {step.step_order + 1}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded p-1 text-foreground/40 opacity-0 transition group-hover:opacity-100 hover:text-red-300"
          title="Remove step"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <div className="mb-2 flex items-end justify-between gap-2">
        <span className="font-mono text-2xl leading-none text-white">
          {step.duration_bars}
          <span className="ml-1 text-[10px] uppercase tracking-wider text-white/50">bars</span>
        </span>
        <div className="flex flex-col items-end gap-0.5 text-[9px] uppercase tracking-wider">
          <span className="rounded bg-teal-400/15 px-1.5 py-0.5 text-teal-200">{chordCount} chord</span>
          <span className="rounded bg-violet-400/15 px-1.5 py-0.5 text-violet-200">{accentCount} accent</span>
        </div>
      </div>

      {/* left handle */}
      <div
        onPointerDown={(e) => beginDrag(e, -1)}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-gradient-to-r from-white/10 to-transparent hover:from-teal-300/40"
      />
      {/* right handle */}
      <div
        onPointerDown={(e) => beginDrag(e, 1)}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-gradient-to-l from-white/10 to-transparent hover:from-teal-300/40"
      />
    </div>
  );
}