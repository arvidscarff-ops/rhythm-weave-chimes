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
import { pitchRegister, type Register } from "@/lib/music/register";
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
  // Field + slot sizes adapt to note count so 14+ notes still breathe.
  const n = pitches.length;
  const crowdScale = n <= 9 ? 1 : n <= 12 ? 0.9 : n <= 16 ? 0.78 : 0.68;
  const size = Math.min(620, 460 + Math.max(0, n - 9) * 22);
  const cx = size / 2;
  const cy = size / 2;
  // Reserve space for the largest possible ring slot (bass) so it sits
  // fully inside the disc with a bit of padding.
  const maxRingSize = 104 * crowdScale;
  const ringRadius = size / 2 - maxRingSize / 2 - 14;
  const ringSlots = Math.max(0, n - 1);

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
          const reg: Register = pitchRegister(p);
          const baseRing = reg === "bass" ? 104 : reg === "high" ? 72 : 88;
          const baseDing = reg === "bass" ? 124 : reg === "high" ? 92 : 108;
          const slotSize = Math.round((isDing ? baseDing : baseRing) * crowdScale);
          const regShadow =
            reg === "bass"
              ? "0 12px 28px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.14)"
              : reg === "high"
                ? "0 3px 10px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.10)"
                : "inset 0 1px 0 rgba(255,255,255,0.10), 0 6px 18px rgba(0,0,0,0.35)";
          const regLift = reg === "high" ? -2 : 0;
          const baseLabel = reg === "high" ? "text-base" : "text-lg";
          const labelSize =
            crowdScale < 0.85
              ? reg === "high"
                ? "text-xs"
                : "text-sm"
              : baseLabel;
          const isRinging = ringing[i] !== undefined;
          const color = noteColor(p);
          const c = color.cssVar;
          const tState: ToneState = activeStep ? toneStateOf(activeStep, i) : "off";
          const isChord = tState === "chord";
          const isAccent = tState === "accent";
          const dim = activeStep && tState === "off";
          const accentC = "oklch(0.72 0.22 310)"; // violet
          const borderColor = isAccent
            ? "rgba(255,255,255,0.18)"
            : isChord
              ? "rgba(255,255,255,0.85)"
              : `color-mix(in oklab, ${c} ${isDing ? 70 : 55}%, transparent)`;
          const background = isChord
            ? "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.22) 35%, rgba(255,255,255,0.06) 65%, rgba(0,0,0,0.35) 100%)"
            : isAccent
              ? "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.75) 70%)"
              : `radial-gradient(circle at 32% 28%, color-mix(in oklab, ${c} ${isDing ? 55 : 42}%, transparent) 0%, color-mix(in oklab, ${c} ${isDing ? 25 : 18}%, transparent) 45%, rgba(0,0,0,0.55) 100%)`;
          const glowColor = isAccent ? accentC : isChord ? "rgba(255,255,255,1)" : c;
          const restingShadow = isChord
            ? "0 0 24px rgba(255,255,255,0.55), 0 0 48px rgba(255,255,255,0.25), inset 0 1px 0 rgba(255,255,255,0.35)"
            : isAccent
              ? "inset 0 1px 0 rgba(255,255,255,0.06)"
              : regShadow;
          return (
            <div
              key={i}
              className="absolute flex flex-col items-center gap-1"
              style={{
                left: x - slotSize / 2,
                top: y - slotSize / 2 - (isDing ? 0 : 8) + regLift,
                width: slotSize,
              }}
            >
              {isAccent && (
                <>
                  {/* Halo emanating from BEHIND the sphere */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute rounded-full"
                    style={{
                      top: -16,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: slotSize + 32,
                      height: slotSize + 32,
                      filter: "blur(18px)",
                      background:
                        "radial-gradient(circle, oklch(0.72 0.22 310 / 0.85) 0%, oklch(0.72 0.22 310 / 0.4) 45%, transparent 75%)",
                      animation: "accent-pulse 1.8s ease-in-out infinite",
                      zIndex: 0,
                    }}
                  />
                  {/* Hairline aura hugging the sphere edge */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute rounded-full"
                    style={{
                      top: -4,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: slotSize + 8,
                      height: slotSize + 8,
                      boxShadow: "0 0 0 1px oklch(0.72 0.22 310 / 0.55)",
                      zIndex: 0,
                    }}
                  />
                </>
              )}
              {isChord && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute rounded-full"
                  style={{
                    top: -10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: slotSize + 20,
                    height: slotSize + 20,
                    filter: "blur(10px)",
                    background:
                      "radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.18) 45%, transparent 75%)",
                    animation: "chord-breathe 2.4s ease-in-out infinite",
                    zIndex: 0,
                  }}
                />
              )}
              <button
                type="button"
                onClick={() => handleSlot(i, p)}
                title={`${p} · ${color.name} · ${reg}${activeStep ? ` · ${tState}` : ""}`}
                className={`relative z-10 flex items-center justify-center rounded-full border transition-all duration-150 focus:outline-none focus-visible:ring-2 ${
                  isRinging ? "scale-[1.06] brightness-125" : "hover:brightness-110"
                } ${dim ? "opacity-45" : ""}`}
                style={{
                  width: slotSize,
                  height: slotSize,
                  borderColor,
                  borderWidth: 1,
                  background,
                  boxShadow: isRinging
                    ? `0 0 32px color-mix(in oklab, ${glowColor} 70%, transparent), inset 0 1px 0 rgba(255,255,255,0.15)`
                    : restingShadow,
                }}
              >
                <span className={`pointer-events-none select-none font-mono ${labelSize} tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]`}>
                  {p}
                </span>
                {isRinging && (
                  <span
                    key={ringing[i]}
                    className="pointer-events-none absolute inset-0 rounded-full animate-ping"
                    style={{ boxShadow: `0 0 0 2px color-mix(in oklab, ${glowColor} 55%, transparent)` }}
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

      <StrumBar
        pitches={pitches}
        onStrike={(idx) => {
          primeAudio();
          playPitch(pitches[idx] ?? DEFAULT_PITCH);
          pulse(idx);
        }}
      />

      <p className="text-center text-[10px] uppercase tracking-wider text-foreground/40">
        {activeStep
          ? "Tap to cycle: Off → Chord (white bloom) → Accent (violet halo) → Off"
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

// ---------- Strummer ----------

const STRUM_STEP_MS = 60;

function StrumBar({
  pitches,
  onStrike,
}: {
  pitches: string[];
  onStrike: (slotIndex: number) => void;
}) {
  // Sort by MIDI ascending; preserve original slot index for onStrike.
  const sorted = useMemo(() => {
    return pitches
      .map((p, i) => {
        let midi = 0;
        try {
          midi = pitchToMidi(p);
        } catch {
          midi = 0;
        }
        return { pitch: p, slot: i, midi };
      })
      .sort((a, b) => a.midi - b.midi || a.slot - b.slot);
  }, [pitches]);
  const n = sorted.length;

  const trackRef = useRef<HTMLDivElement | null>(null);
  const [beadPct, setBeadPct] = useState(0);
  const [flash, setFlash] = useState<Record<number, number>>({});
  const flashTimers = useRef<Record<number, number>>({});
  const lastIdx = useRef<number | null>(null);
  const dragging = useRef(false);
  const [sweeping, setSweeping] = useState(false);
  const rafRef = useRef<number | null>(null);

  const tickPct = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);

  const pingTick = (posIdx: number) => {
    const slot = sorted[posIdx].slot;
    onStrike(slot);
    const token = (flash[posIdx] ?? 0) + 1;
    setFlash((f) => ({ ...f, [posIdx]: token }));
    if (flashTimers.current[posIdx]) window.clearTimeout(flashTimers.current[posIdx]);
    flashTimers.current[posIdx] = window.setTimeout(() => {
      setFlash((f) => {
        if (f[posIdx] !== token) return f;
        const { [posIdx]: _drop, ...rest } = f;
        return rest;
      });
    }, 260);
  };

  const nearestIdx = (pct: number) => {
    if (n <= 1) return 0;
    return Math.max(0, Math.min(n - 1, Math.round((pct / 100) * (n - 1))));
  };

  const updateBead = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const raw = ((clientX - rect.left) / rect.width) * 100;
    const pct = Math.max(0, Math.min(100, raw));
    setBeadPct(pct);
    const idx = nearestIdx(pct);
    const prev = lastIdx.current;
    if (prev === null) {
      lastIdx.current = idx;
      pingTick(idx);
      return;
    }
    if (idx !== prev) {
      const step = idx > prev ? 1 : -1;
      for (let i = prev + step; step > 0 ? i <= idx : i >= idx; i += step) {
        pingTick(i);
      }
      lastIdx.current = idx;
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (sweeping) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = true;
    lastIdx.current = null;
    updateBead(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    updateBead(e.clientX);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    dragging.current = false;
  };

  const autoStrum = () => {
    if (sweeping || n === 0) return;
    setSweeping(true);
    setBeadPct(0);
    lastIdx.current = null;
    sorted.forEach((_, i) => {
      window.setTimeout(() => {
        pingTick(i);
        setBeadPct(tickPct(i));
      }, i * STRUM_STEP_MS);
    });
    window.setTimeout(() => {
      setSweeping(false);
    }, n * STRUM_STEP_MS + 60);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      Object.values(flashTimers.current).forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const resetBead = () => {
    if (sweeping) return;
    setBeadPct(0);
    lastIdx.current = null;
  };

  const sweepMs = n * STRUM_STEP_MS;

  return (
    <div className="mx-auto flex w-full max-w-[560px] items-stretch gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 backdrop-blur">
      {/* Track */}
      <div
        className="relative flex-1 select-none"
        onDoubleClick={resetBead}
      >
        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={`relative h-10 w-full touch-none rounded-md ${
            dragging.current ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={{ touchAction: "none" }}
        >
          {/* baseline */}
          <div className="pointer-events-none absolute left-1 right-1 top-1/2 h-px -translate-y-1/2 bg-white/15" />
          {/* ticks */}
          {sorted.map((t, i) => {
            const c = noteColor(t.pitch).cssVar;
            const lit = flash[i] !== undefined;
            const reg = pitchRegister(t.pitch);
            const dotSize = reg === "bass" ? 12 : reg === "high" ? 5 : 8;
            return (
              <div
                key={`${t.slot}-${i}`}
                className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${tickPct(i)}%` }}
              >
                <span
                  className={`block rounded-full transition-transform duration-150 ${
                    lit ? "scale-[1.6]" : "scale-100"
                  }`}
                  style={{
                    width: dotSize,
                    height: dotSize,
                    background: c,
                    boxShadow: lit
                      ? `0 0 14px color-mix(in oklab, ${c} 80%, transparent)`
                      : `0 0 4px color-mix(in oklab, ${c} 40%, transparent)`,
                  }}
                />
              </div>
            );
          })}
          {/* bead */}
          <div
            className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${beadPct}%`,
              transition: sweeping ? `left ${STRUM_STEP_MS}ms linear` : "none",
            }}
          >
            <span
              className="block rounded-full"
              style={{
                width: 14,
                height: 14,
                background:
                  "radial-gradient(circle at 35% 30%, oklch(0.92 0.09 195), oklch(0.68 0.16 195) 70%)",
                boxShadow:
                  "0 0 14px oklch(0.78 0.16 195 / 0.75), inset 0 1px 0 rgba(255,255,255,0.4)",
              }}
            />
          </div>
        </div>
        {/* labels */}
        <div className="relative mt-1 h-4">
          {sorted.map((t, i) => (
            <span
              key={`lbl-${t.slot}-${i}`}
              className="pointer-events-none absolute -translate-x-1/2 font-mono text-[9px] text-white/60"
              style={{ left: `${tickPct(i)}%`, top: 0 }}
            >
              {t.pitch}
            </span>
          ))}
        </div>
      </div>

      {/* Auto-strum button */}
      <button
        type="button"
        onClick={autoStrum}
        disabled={sweeping || n === 0}
        title="Strum all notes low to high"
        className={`relative flex flex-shrink-0 items-center gap-1.5 self-start overflow-hidden rounded-md border px-3 py-2 text-[11px] uppercase tracking-wider transition ${
          sweeping
            ? "border-teal-300/60 text-teal-100"
            : "border-white/15 bg-white/[0.03] text-white/80 hover:border-teal-300/60 hover:text-white"
        }`}
        style={{
          boxShadow: sweeping
            ? "0 0 22px oklch(0.78 0.16 195 / 0.45)"
            : undefined,
        }}
      >
        {sweeping && (
          <span
            className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-teal-400/40 to-teal-300/10"
            style={{
              width: "100%",
              transform: "translateX(-100%)",
              animation: `strumFill ${sweepMs}ms linear forwards`,
            }}
          />
        )}
        <Waves className="relative h-3.5 w-3.5" />
        <span className="relative">Strum all</span>
        <style>{`@keyframes strumFill { to { transform: translateX(0); } }`}</style>
      </button>
    </div>
  );
}