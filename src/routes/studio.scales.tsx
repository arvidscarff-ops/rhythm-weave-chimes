import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePasscode } from "@/lib/admin/passcode-context";
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
  const [poolSize, setPoolSize] = useState(scale.pool_size);
  const [intervals, setIntervals] = useState<number[]>(scale.intervals);

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

  const toggleInterval = (semi: number) => {
    const next = intervals.includes(semi)
      ? intervals.filter((n) => n !== semi)
      : [...intervals, semi].sort((a, b) => a - b);
    setIntervals(next);
  };

  const commit = () =>
    saveMut.mutate({
      passcode: getPass(),
      id: scale.id,
      name,
      pool_size: poolSize,
      intervals,
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

        <div className="grid grid-cols-[1fr_120px] gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-foreground/60">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-foreground/60">Pool size</Label>
            <Input
              type="number"
              min={2}
              max={12}
              value={poolSize}
              onChange={(e) => setPoolSize(Number(e.target.value) || 2)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-foreground/60">
            Intervals (semitones from root, {intervals.length} selected)
          </Label>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 12 }, (_, i) => i).map((semi) => {
              const active = intervals.includes(semi);
              return (
                <button
                  key={semi}
                  onClick={() => toggleInterval(semi)}
                  className={`h-9 w-9 rounded-md text-xs tabular-nums transition ${
                    active
                      ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/40"
                      : "bg-white/5 text-foreground/60 hover:bg-white/10"
                  }`}
                >
                  {semi}
                </button>
              );
            })}
          </div>
        </div>

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
                poolSize={scale.pool_size}
                onChanged={invalidate}
              />
            ))}
          </div>
        )}
      </div>
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