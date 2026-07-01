import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
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
import { allPitchOptions, DEFAULT_PITCH } from "@/lib/music/pitch";
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

  const [name, setName] = useState(scale.name);
  const [pitches, setPitches] = useState<string[]>(
    scale.pitches.length > 0
      ? scale.pitches
      : ["D3", "A3", "Bb3", "C4", "D4", "E4", "F4", "A4"],
  );

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
    onSuccess: async () => {
      await invalidate();
    },
  });

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
        />

        <div className="flex justify-end">
          <Button size="sm" onClick={commit} disabled={saveMut.isPending}>
            Save scale
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-[0.2em] text-foreground/60">
            Progression timeline
          </h2>
          <Button size="sm" variant="ghost" onClick={() => addStepMut.mutate()}>
            <Plus className="h-3 w-3 mr-1" /> Add step
          </Button>
        </div>

        {scale.steps.length === 0 ? (
          <p className="text-xs text-foreground/50">No steps yet.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {scale.steps.map((step) => (
              <ProgressionStepCard
                key={step.id}
                step={step}
                poolSize={pitches.length}
                onChanged={invalidate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HandpanField({
  pitches,
  onChange,
}: {
  pitches: string[];
  onChange: (next: string[]) => void;
}) {
  const options = useMemo(() => allPitchOptions("C1", "C7"), []);
  const [ringing, setRinging] = useState<Record<number, number>>({});
  const timers = useRef<Record<number, number>>({});

  const strike = (idx: number, pitch: string) => {
    primeAudio();
    playPitch(pitch);
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
                onClick={() => strike(i, p)}
                title={`${p} · ${color.name}`}
                className={`relative flex items-center justify-center rounded-full border transition-all duration-150 focus:outline-none focus-visible:ring-2 ${
                  isRinging ? "scale-[1.06] brightness-125" : "hover:brightness-110"
                }`}
                style={{
                  width: slotSize,
                  height: slotSize,
                  borderColor: `color-mix(in oklab, ${c} ${isDing ? 70 : 55}%, transparent)`,
                  background: `radial-gradient(circle at 32% 28%, color-mix(in oklab, ${c} ${isDing ? 55 : 42}%, transparent) 0%, color-mix(in oklab, ${c} ${isDing ? 25 : 18}%, transparent) 45%, rgba(0,0,0,0.55) 100%)`,
                  boxShadow: isRinging
                    ? `0 0 32px color-mix(in oklab, ${c} 70%, transparent), inset 0 1px 0 rgba(255,255,255,0.15)`
                    : `inset 0 1px 0 rgba(255,255,255,0.10), 0 6px 18px rgba(0,0,0,0.35)`,
                }}
              >
                <span className="pointer-events-none select-none font-mono text-lg tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
                  {p}
                </span>
                {isRinging && (
                  <span
                    key={ringing[i]}
                    className="pointer-events-none absolute inset-0 rounded-full animate-ping"
                    style={{ boxShadow: `0 0 0 2px color-mix(in oklab, ${c} 55%, transparent)` }}
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
        Tap any note to hear it · polyphonic — notes ring out and overlap
      </p>
    </div>
  );
}

function ProgressionStepCard({
  step,
  poolSize,
  onChanged,
}: {
  step: AdminProgressionStep;
  poolSize: number;
  onChanged: () => void;
}) {
  const { get: getPass } = usePasscode();
  const upd = useServerFn(updateProgressionStep);
  const rm = useServerFn(removeProgressionStep);

  const [chord, setChord] = useState<number[]>(step.chord_tones);
  const [accent, setAccent] = useState<number[]>(step.accent_tones);
  const [duration, setDuration] = useState<number>(step.duration_bars);

  const saveMut = useMutation({
    mutationFn: (patch: { chord_tones?: number[]; accent_tones?: number[]; duration_bars?: number }) =>
      upd({ data: { passcode: getPass(), id: step.id, ...patch } }),
    onSuccess: onChanged,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const removeMut = useMutation({
    mutationFn: () => rm({ data: { passcode: getPass(), id: step.id } }),
    onSuccess: onChanged,
  });

  return (
    <div className="min-w-[260px] flex-shrink-0 rounded-md border border-white/10 bg-black/40 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-foreground/60">
          Step {step.step_order + 1}
        </span>
        <button
          onClick={() => removeMut.mutate()}
          className="rounded p-1 text-foreground/50 hover:text-red-300"
          title="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider text-foreground/50">Duration (bars)</Label>
        <Input
          type="number"
          min={1}
          max={32}
          value={duration}
          onChange={(e) => {
            const v = Math.max(1, Number(e.target.value) || 1);
            setDuration(v);
            saveMut.mutate({ duration_bars: v });
          }}
        />
      </div>

      <TonePicker
        label="Chord tones"
        tint="emerald"
        poolSize={poolSize}
        selected={chord}
        onToggle={(t) => {
          const next = chord.includes(t)
            ? chord.filter((n) => n !== t)
            : [...chord, t].sort((a, b) => a - b);
          setChord(next);
          saveMut.mutate({ chord_tones: next });
        }}
      />

      <TonePicker
        label="Accent tones"
        tint="amber"
        poolSize={poolSize}
        selected={accent}
        onToggle={(t) => {
          const next = accent.includes(t)
            ? accent.filter((n) => n !== t)
            : [...accent, t].sort((a, b) => a - b);
          setAccent(next);
          saveMut.mutate({ accent_tones: next });
        }}
      />
    </div>
  );
}

function TonePicker({
  label,
  tint,
  poolSize,
  selected,
  onToggle,
}: {
  label: string;
  tint: "emerald" | "amber";
  poolSize: number;
  selected: number[];
  onToggle: (tone: number) => void;
}) {
  const activeCls =
    tint === "emerald"
      ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40"
      : "bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/40";
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wider text-foreground/50">{label}</Label>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: Math.max(1, poolSize) }, (_, i) => i).map((t) => {
          const active = selected.includes(t);
          return (
            <button
              key={t}
              onClick={() => onToggle(t)}
              className={`h-7 w-7 rounded text-[11px] tabular-nums transition ${
                active ? activeCls : "bg-white/5 text-foreground/60 hover:bg-white/10"
              }`}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}