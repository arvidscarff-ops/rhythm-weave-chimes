import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2, Upload, Play, Lock, Save, X, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { auditionSample } from "@/lib/dev/samplePlayer";
import { PasscodeProvider, usePasscode } from "@/lib/admin/passcode-context";
import {
  listAdminPacks,
  createAdminPack,
  updateAdminPack,
  deleteAdminPack,
  updateAdminSlot,
  registerAdminSample,
  signedCoverUrl,
  createAdminUploadUrl,
  addAdminSlot,
  removeAdminSlot,
  setAdminSlotSamples,
  MAX_SLOTS_PER_PACK,
  MAX_SAMPLES_PER_SLOT,
  type AdminPack,
  type AdminSlot,
} from "@/lib/admin/packs.functions";
import {
  DEFAULT_HUMANIZATION,
  type Humanization,
} from "@/lib/admin/humanization";

export const Route = createFileRoute("/studio/packs")({
  ssr: false,
  component: AdminPacksPage,
});

function AdminPacksPage() {
  return (
    <PasscodeProvider>
      <AdminBootstrap />
    </PasscodeProvider>
  );
}

function AdminBootstrap() {
  const { ensure, get, set } = usePasscode();
  const router = useRouter();
  const [status, setStatus] = useState<"pending" | "ready" | "cancelled">("pending");

  const tryUnlock = () => {
    setStatus("pending");
    ensure()
      .then(() => setStatus("ready"))
      .catch(() => {
        setStatus("cancelled");
        void router.navigate({ to: "/" });
      });
  };

  useEffect(() => {
    // Accept passcode handed off from /admin/unlock via in-memory window stash.
    const w = window as unknown as { __phaseAdminPass?: string };
    if (w.__phaseAdminPass) {
      set(w.__phaseAdminPass);
      w.__phaseAdminPass = undefined;
    }
    if (get()) {
      setStatus("ready");
      return;
    }
    ensure()
      .then(() => setStatus("ready"))
      .catch(() => {
        setStatus("cancelled");
        void router.navigate({ to: "/" });
      });
  }, [ensure, get, router, set]);

  if (status === "cancelled") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-lg font-medium tracking-wide">Passcode required</h1>
          <p className="text-sm text-foreground/60">
            Enter the admin passcode to manage sound packs, or head back home.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Button size="sm" onClick={tryUnlock}>
              <Lock className="h-3 w-3 mr-2" /> Enter passcode
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/">
                <ChevronLeft className="h-3 w-3 mr-2" /> Back to home
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }
  if (status !== "ready") return null;
  return <AdminUI />;
}

function AdminUI() {
  const qc = useQueryClient();
  const router = useRouter();
  const { get: getPass, clear: clearPass } = usePasscode();
  const list = useServerFn(listAdminPacks);
  const create = useServerFn(createAdminPack);
  const del = useServerFn(deleteAdminPack);

  const packsQ = useQuery({
    queryKey: ["admin", "packs"],
    queryFn: () => list({ data: { passcode: getPass() } }),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const packs = packsQ.data ?? [];
  const selected = packs.find((p) => p.id === selectedId) ?? packs[0] ?? null;
  useEffect(() => {
    if (!selectedId && packs[0]) setSelectedId(packs[0].id);
  }, [packs, selectedId]);

  const createMut = useMutation({
    mutationFn: (name: string) => create({ data: { passcode: getPass(), name } }),
    onSuccess: async ({ id }) => {
      await qc.invalidateQueries({ queryKey: ["admin", "packs"] });
      setSelectedId(id);
      toast.success("Pack created");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { passcode: getPass(), id } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "packs"] });
      setSelectedId(null);
      toast.success("Pack deleted");
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-foreground/60 hover:text-foreground">
            <ChevronLeft className="h-4 w-4" /> Home
          </Link>
          <h1 className="text-base font-medium tracking-wide">Admin · Sound Packs CMS</h1>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            clearPass();
            router.navigate({ to: "/admin/unlock" });
          }}
        >
          <Lock className="h-3 w-3 mr-2" /> Lock
        </Button>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-[260px_1fr] gap-6 px-6 py-6">
        {/* Left: pack list */}
        <aside className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">Packs</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const name = window.prompt("Pack name?");
                if (name?.trim()) createMut.mutate(name.trim());
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-1">
            {packs.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition ${
                  selected?.id === p.id
                    ? "bg-white/10 text-foreground"
                    : "text-foreground/70 hover:bg-white/5"
                }`}
              >
                <span className="flex-1 truncate">{p.name}</span>
                {p.is_published && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] uppercase tracking-wider text-emerald-300">
                    live
                  </span>
                )}
              </button>
            ))}
            {packs.length === 0 && (
              <div className="text-xs text-foreground/50">No packs yet.</div>
            )}
          </div>
        </aside>

        {/* Right: editor */}
        {selected ? (
          <PackEditor
            key={selected.id}
            pack={selected}
            onDelete={() => {
              if (confirm(`Delete "${selected.name}"? This cannot be undone.`)) {
                deleteMut.mutate(selected.id);
              }
            }}
          />
        ) : (
          <div className="rounded-lg border border-white/10 p-8 text-sm text-foreground/60">
            Create a pack to get started.
          </div>
        )}
      </main>
    </div>
  );
}

function PackEditor({ pack, onDelete }: { pack: AdminPack; onDelete: () => void }) {
  const qc = useQueryClient();
  const { get: getPass } = usePasscode();
  const update = useServerFn(updateAdminPack);
  const signCover = useServerFn(signedCoverUrl);
  const createUploadUrl = useServerFn(createAdminUploadUrl);
  const [name, setName] = useState(pack.name);
  const [description, setDescription] = useState(pack.description ?? "");
  const [humanization, setHumanization] = useState<Humanization>(
    pack.humanization ?? DEFAULT_HUMANIZATION,
  );
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  useEffect(() => {
    setName(pack.name);
    setDescription(pack.description ?? "");
    setHumanization(pack.humanization ?? DEFAULT_HUMANIZATION);
    setCoverPreview(null);
    if (pack.cover_image_url) {
      signCover({ data: { passcode: getPass(), storage_path: pack.cover_image_url } })
        .then((r) => setCoverPreview(r.url))
        .catch(() => {});
    }
  }, [pack.id, pack.cover_image_url, pack.name, pack.description, pack.humanization, signCover, getPass]);

  const saveMut = useMutation({
    mutationFn: (patch: Omit<Parameters<typeof update>[0]["data"], "passcode">) =>
      update({ data: { ...patch, passcode: getPass() } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin", "packs"] });
      toast.success("Saved");
    },
  });

  const publishMut = useMutation({
    mutationFn: (v: boolean) => update({ data: { passcode: getPass(), id: pack.id, is_published: v } }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["admin", "packs"] });
      toast.success(v ? "Published" : "Unpublished");
    },
  });

  const uploadCover = async (file: File) => {
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${pack.id}/cover-${Date.now()}.${ext}`;
    const signed = await createUploadUrl({
      data: { passcode: getPass(), bucket: "pack-covers", path, upsert: true },
    });
    const { error } = await supabase.storage
      .from("pack-covers")
      .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
    if (error) {
      toast.error(error.message);
      return;
    }
    saveMut.mutate({ id: pack.id, cover_image_url: signed.path });
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <label className="group relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/40 text-xs text-foreground/50 hover:border-white/30">
          {coverPreview ? (
            <img src={coverPreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span>Cover</span>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadCover(f);
            }}
          />
        </label>
        <div className="flex-1 space-y-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-lg font-medium"
          />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => saveMut.mutate({ id: pack.id, name, description })}
            >
              <Save className="h-3 w-3 mr-2" /> Save
            </Button>
            <Button
              size="sm"
              variant={pack.is_published ? "secondary" : "default"}
              onClick={() => publishMut.mutate(!pack.is_published)}
            >
              {pack.is_published ? "Unpublish" : "Publish"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} className="ml-auto text-red-400">
              <Trash2 className="h-3 w-3 mr-2" /> Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Humanizer */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">Pack Humanizer (defaults)</h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => saveMut.mutate({ id: pack.id, humanization })}
          >
            <Save className="h-3 w-3 mr-2" /> Save
          </Button>
        </div>
        <HumanizerControls value={humanization} onChange={setHumanization} />
      </div>

      {/* Slots */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <SlotsSection pack={pack} />
      </div>
    </section>
  );
}

function SlotsSection({ pack }: { pack: AdminPack }) {
  const qc = useQueryClient();
  const { get: getPass } = usePasscode();
  const addSlot = useServerFn(addAdminSlot);
  const removeSlot = useServerFn(removeAdminSlot);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "packs"] });

  const addMut = useMutation({
    mutationFn: () => addSlot({ data: { passcode: getPass(), pack_id: pack.id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Slot added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Add failed"),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => removeSlot({ data: { passcode: getPass(), id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Slot removed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Remove failed"),
  });

  const atMax = pack.slots.length >= MAX_SLOTS_PER_PACK;
  const atMin = pack.slots.length <= 1;

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">
          Sample slots ({pack.slots.length}/{MAX_SLOTS_PER_PACK})
        </h2>
        <Button
          size="sm"
          variant="ghost"
          disabled={atMax || addMut.isPending}
          onClick={() => addMut.mutate()}
          title={atMax ? "Maximum reached" : "Add slot"}
        >
          <Plus className="h-3 w-3 mr-2" /> Add slot
        </Button>
      </div>
      <div className="space-y-3">
        {pack.slots.map((s) => (
          <SlotEditor
            key={s.id}
            packId={pack.id}
            slot={s}
            canRemove={!atMin}
            onRemove={() => {
              if (window.confirm(`Remove slot #${s.slot_index + 1}?`)) {
                removeMut.mutate(s.id);
              }
            }}
          />
        ))}
      </div>
    </>
  );
}

function HumanizerControls({
  value,
  onChange,
}: {
  value: Humanization;
  onChange: (v: Humanization) => void;
}) {
  const cutoff = value.cutoffHz ?? [500, 5000];
  const cutoffOn = value.cutoffHz !== null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SliderRow
        label={`Velocity variance ±${Math.round(value.velocityPct * 100)}%`}
        value={value.velocityPct * 100}
        min={0}
        max={50}
        step={1}
        onChange={(n) => onChange({ ...value, velocityPct: n / 100 })}
      />
      <SliderRow
        label={`Detune drift ±${Math.round(value.detuneCents)}¢`}
        value={value.detuneCents}
        min={0}
        max={100}
        step={1}
        onChange={(n) => onChange({ ...value, detuneCents: n })}
      />
      <SliderRow
        label={`Panner drift ±${Math.round(value.panPct * 100)}%`}
        value={value.panPct * 100}
        min={0}
        max={100}
        step={1}
        onChange={(n) => onChange({ ...value, panPct: n / 100 })}
      />
      <div>
        <div className="flex items-center gap-2 mb-2">
          <input
            id="cutoff-on"
            type="checkbox"
            checked={cutoffOn}
            onChange={(e) =>
              onChange({ ...value, cutoffHz: e.target.checked ? cutoff : null })
            }
          />
          <label htmlFor="cutoff-on" className="text-xs">
            Lowpass cutoff{cutoffOn ? ` ${cutoff[0]}–${cutoff[1]} Hz` : " (off)"}
          </label>
        </div>
        {cutoffOn && (
          <Slider
            min={100}
            max={20000}
            step={50}
            value={cutoff}
            onValueChange={(v) => onChange({ ...value, cutoffHz: [v[0], v[1]] })}
          />
        )}
      </div>
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
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-xs text-foreground/70">{label}</div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}

function SlotEditor({
  packId,
  slot,
  canRemove,
  onRemove,
}: {
  packId: string;
  slot: AdminSlot;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const qc = useQueryClient();
  const { get: getPass } = usePasscode();
  const update = useServerFn(updateAdminSlot);
  const register = useServerFn(registerAdminSample);
  const createUploadUrl = useServerFn(createAdminUploadUrl);
  const setSamples = useServerFn(setAdminSlotSamples);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(slot.label ?? "");
  const [overrideOn, setOverrideOn] = useState(slot.humanization !== null);
  const [hum, setHum] = useState<Humanization>(slot.humanization ?? DEFAULT_HUMANIZATION);

  useEffect(() => {
    setName(slot.label ?? "");
    setOverrideOn(slot.humanization !== null);
    setHum(slot.humanization ?? DEFAULT_HUMANIZATION);
  }, [slot.id, slot.label, slot.humanization]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "packs"] });

  const currentIds = useMemo(() => slot.samples.map((s) => s.id), [slot.samples]);
  const remaining = MAX_SAMPLES_PER_SLOT - slot.samples.length;

  const uploadFiles = async (files: File[]) => {
    const wavs = files.filter((f) => /\.wav$/i.test(f.name) || f.type === "audio/wav");
    if (wavs.length === 0) {
      toast.error("Only .wav files are accepted");
      return;
    }
    if (wavs.length > remaining) {
      toast.error(`Max ${MAX_SAMPLES_PER_SLOT} samples per slot (${remaining} left)`);
      return;
    }
    setBusy(true);
    try {
      const newIds: string[] = [];
      for (const file of wavs) {
        const path = `admin-packs/${packId}/${slot.slot_index}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}.wav`;
        const signed = await createUploadUrl({
          data: { passcode: getPass(), bucket: "samples", path, upsert: true },
        });
        const { error } = await supabase.storage
          .from("samples")
          .uploadToSignedUrl(signed.path, signed.token, file, {
            contentType: file.type || "audio/wav",
          });
        if (error) throw error;
        const { id } = await register({
          data: {
            passcode: getPass(),
            name: file.name,
            storage_path: signed.path,
            mime_type: file.type || "audio/wav",
          },
        });
        newIds.push(id);
      }
      await setSamples({
        data: { passcode: getPass(), slot_id: slot.id, sample_ids: [...currentIds, ...newIds] },
      });
      toast.success(`Added ${newIds.length} variation${newIds.length === 1 ? "" : "s"}`);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const removeSampleAt = async (idx: number) => {
    const next = currentIds.slice();
    next.splice(idx, 1);
    await setSamples({ data: { passcode: getPass(), slot_id: slot.id, sample_ids: next } });
    invalidate();
  };

  const moveSample = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= currentIds.length) return;
    const next = currentIds.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    await setSamples({ data: { passcode: getPass(), slot_id: slot.id, sample_ids: next } });
    invalidate();
  };

  const saveName = async () => {
    if ((slot.label ?? "") === name) return;
    await update({ data: { passcode: getPass(), id: slot.id, label: name || null } });
    invalidate();
  };

  const saveOverride = async () => {
    await update({
      data: { passcode: getPass(), id: slot.id, humanization: overrideOn ? hum : null },
    });
    toast.success("Slot humanization saved");
    invalidate();
  };

  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-3">
        <span className="w-8 text-center text-xs font-mono text-foreground/60">
          #{slot.slot_index + 1}
        </span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="Slot name (e.g. Pluck A, Kick)"
          className="flex-1 text-sm"
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={!canRemove}
          onClick={onRemove}
          className="text-red-400"
          title={canRemove ? "Remove slot" : "At least one slot required"}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Multi-file dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length) uploadFiles(files);
        }}
        className={`mt-3 rounded-md border border-dashed p-3 text-center text-xs transition ${
          dragOver ? "border-emerald-400/60 bg-emerald-500/5" : "border-white/15 bg-black/20"
        }`}
      >
        <label className="inline-flex cursor-pointer flex-col items-center gap-1">
          <Upload className="h-4 w-4 text-foreground/60" />
          <span className="text-foreground/70">
            {busy ? "Uploading…" : `Drop .wav files or click to browse`}
          </span>
          <span className="text-[10px] text-foreground/45">
            Drop 3–4 variations of the same sound for organic round-robin playback. More variations =
            less machine-gun repetition. ({slot.samples.length}/{MAX_SAMPLES_PER_SLOT})
          </span>
          <input
            type="file"
            accept="audio/wav"
            multiple
            className="hidden"
            disabled={busy || remaining <= 0}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) uploadFiles(files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {/* Current variation list */}
      {slot.samples.length > 0 && (
        <ul className="mt-3 space-y-1">
          {slot.samples.map((s, idx) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded border border-white/5 bg-white/[0.02] px-2 py-1 text-xs"
            >
              <span className="w-5 text-foreground/45 font-mono">{idx + 1}</span>
              <span className="flex-1 truncate">{s.name}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => auditionSample(s.storage_path)}
                title="Preview"
              >
                <Play className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={idx === 0}
                onClick={() => moveSample(idx, -1)}
                title="Move up"
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={idx === slot.samples.length - 1}
                onClick={() => moveSample(idx, 1)}
                title="Move down"
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeSampleAt(idx)}
                className="text-red-400"
                title="Remove"
              >
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          id={`ov-${slot.id}`}
          type="checkbox"
          checked={overrideOn}
          onChange={(e) => setOverrideOn(e.target.checked)}
        />
        <label htmlFor={`ov-${slot.id}`} className="text-xs text-foreground/70">
          Override pack humanization
        </label>
      </div>
      {overrideOn && (
        <div className="mt-3 space-y-3">
          <HumanizerControls value={hum} onChange={setHum} />
        </div>
      )}
      {(overrideOn || slot.humanization !== null) && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="ghost" onClick={saveOverride}>
            <Save className="h-3 w-3 mr-2" /> Save override
          </Button>
        </div>
      )}
    </div>
  );
}