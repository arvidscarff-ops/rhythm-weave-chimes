import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  listMyPresets,
  savePreset,
  renamePreset,
  deletePreset,
  duplicatePreset,
  type PresetRow,
} from "@/lib/studio/presets.functions";
import { ChevronLeft, Copy, Download, Pencil, Play, Plus, Trash2, Upload } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { auditionSample } from "@/lib/dev/samplePlayer";

const tabSchema = z.object({
  tab: z.enum(["presets", "packs", "scenes"]).optional(),
});

export const Route = createFileRoute("/_authenticated/studio")({
  validateSearch: tabSchema,
  component: StudioPage,
});

type Tab = "presets" | "packs" | "scenes";

function StudioPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab: Tab = search.tab ?? "presets";
  const setTab = (t: Tab) =>
    navigate({ search: { tab: t === "presets" ? undefined : t }, replace: true });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-foreground/60 hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="text-base font-medium tracking-wide">My Studio</h1>
        </div>
        <nav className="flex gap-1 text-[11px] uppercase tracking-[0.18em]">
          {(["presets", "packs", "scenes"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 transition ${
                tab === t
                  ? "bg-white/10 text-foreground"
                  : "text-foreground/55 hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {tab === "presets" && <PresetsTab />}
        {tab === "packs" && <PacksTab />}
        {tab === "scenes" && <ComingSoon kind="Scene Studio" />}
      </main>
    </div>
  );
}

function ComingSoon({ kind }: { kind: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-center">
      <p className="text-sm font-medium">{kind}</p>
      <p className="mt-1 text-xs text-foreground/55">Coming in the next build phase.</p>
    </div>
  );
}

function PresetsTab() {
  const list = useServerFn(listMyPresets);
  const rename = useServerFn(renamePreset);
  const del = useServerFn(deletePreset);
  const dup = useServerFn(duplicatePreset);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-presets"],
    queryFn: () => list(),
  });

  const renameM = useMutation({
    mutationFn: (v: { id: string; name: string }) => rename({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-presets"] }),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Preset deleted");
      qc.invalidateQueries({ queryKey: ["my-presets"] });
    },
  });
  const dupM = useMutation({
    mutationFn: (id: string) => dup({ data: { id } }),
    onSuccess: () => {
      toast.success("Preset duplicated");
      qc.invalidateQueries({ queryKey: ["my-presets"] });
    },
  });

  if (isLoading) {
    return <p className="text-sm text-foreground/60">Loading…</p>;
  }
  if (error) {
    return <p className="text-sm text-destructive">Failed to load presets.</p>;
  }
  const rows = data ?? [];

  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-sm font-medium">Composer Presets</h2>
          <p className="text-xs text-foreground/55">
            Saved from the dock&apos;s Compose menu. Load any preset back into the live mix.
          </p>
        </div>
        <Link
          to="/"
          className="text-[11px] uppercase tracking-[0.18em] text-foreground/60 hover:text-foreground"
        >
          + Save from dock
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-center">
          <p className="text-sm">No presets yet.</p>
          <p className="mt-1 text-xs text-foreground/55">
            Open <span className="text-foreground/80">Compose → Save preset</span> in the main view.
          </p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <PresetRowItem
              key={r.id}
              row={r}
              onRename={(name) => renameM.mutate({ id: r.id, name })}
              onDelete={() => deleteM.mutate(r.id)}
              onDuplicate={() => dupM.mutate(r.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PresetRowItem({
  row,
  onRename,
  onDelete,
  onDuplicate,
}: {
  row: PresetRow;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.name);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(row.preset_json, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${row.name.replace(/[^\w-]+/g, "_")}.preset.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <li className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (name.trim() && name !== row.name) onRename(name.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setName(row.name);
                setEditing(false);
              }
            }}
            className="w-full rounded bg-white/5 px-2 py-1 text-sm outline-none"
          />
        ) : (
          <p className="truncate text-sm">{row.name}</p>
        )}
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-foreground/45">
          v{row.schema_version} · {new Date(row.updated_at).toLocaleDateString()}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="icon" onClick={() => setEditing(true)} title="Rename">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDuplicate} title="Duplicate">
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={exportJson} title="Export JSON">
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (confirm(`Delete "${row.name}"?`)) onDelete();
          }}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}

// Re-export for the dock's quick-save flow.
export { savePreset };

/* ============================================================
 * Packs Tab — full Sound Pack Studio for signed-in users.
 * Browser supabase client; RLS enforces ownership.
 * ============================================================ */

type PackRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_public: boolean;
  is_builtin: boolean;
  updated_at: string;
};

type SlotRow = {
  id: string;
  pack_id: string;
  slot_index: number;
  sample_id: string | null;
  label: string | null;
  gain_db: number;
  pan: number;
  pitch_offset_semitones: number;
};

type SampleRow = {
  id: string;
  name: string;
  storage_path: string;
  duration_sec: number | null;
  sample_rate_hz: number | null;
  channels: number | null;
  size_bytes: number | null;
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pack";
}

function PacksTab() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const packsQ = useQuery({
    queryKey: ["studio", "packs"],
    queryFn: async (): Promise<PackRow[]> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("packs")
        .select("id, slug, name, description, is_public, is_builtin, updated_at")
        .eq("owner_id", u.user.id)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as PackRow[];
    },
  });

  const slotsQ = useQuery({
    queryKey: ["studio", "slots", selectedId],
    enabled: !!selectedId,
    queryFn: async (): Promise<SlotRow[]> => {
      const { data, error } = await supabase
        .from("pack_slots")
        .select("id, pack_id, slot_index, sample_id, label, gain_db, pan, pitch_offset_semitones")
        .eq("pack_id", selectedId!)
        .order("slot_index");
      if (error) throw new Error(error.message);
      return (data ?? []) as SlotRow[];
    },
  });

  const samplesQ = useQuery({
    queryKey: ["studio", "samples"],
    queryFn: async (): Promise<SampleRow[]> => {
      const { data, error } = await supabase
        .from("samples")
        .select("id, name, storage_path, duration_sec, sample_rate_hz, channels, size_bytes")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as SampleRow[];
    },
  });

  const createPack = useMutation({
    mutationFn: async (name: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const slug = `${slugify(name)}-${Date.now().toString(36).slice(-4)}`;
      const { data: pack, error } = await supabase
        .from("packs")
        .insert({ name, slug, owner_id: u.user.id, is_public: false, is_builtin: false })
        .select("id, slug, name, description, is_public, is_builtin, updated_at")
        .single();
      if (error || !pack) throw new Error(error?.message ?? "Create failed");
      const rows = Array.from({ length: 6 }, (_, i) => ({ pack_id: pack.id, slot_index: i }));
      const { error: sErr } = await supabase.from("pack_slots").insert(rows);
      if (sErr) throw new Error(sErr.message);
      return pack as PackRow;
    },
    onSuccess: (pack) => {
      toast.success(`Created "${pack.name}"`);
      qc.invalidateQueries({ queryKey: ["studio", "packs"] });
      setSelectedId(pack.id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Create failed"),
  });

  const renamePack = useMutation({
    mutationFn: async (v: { id: string; name: string }) => {
      const { error } = await supabase.from("packs").update({ name: v.name }).eq("id", v.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio", "packs"] }),
  });

  const deletePack = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("packs").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, id) => {
      toast.success("Pack deleted");
      if (selectedId === id) setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["studio", "packs"] });
    },
  });

  const dupPack = useMutation({
    mutationFn: async (id: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data: src, error: e1 } = await supabase
        .from("packs")
        .select("name, description, is_public")
        .eq("id", id)
        .single();
      if (e1 || !src) throw new Error(e1?.message ?? "Not found");
      const name = `${src.name} (copy)`;
      const slug = `${slugify(name)}-${Date.now().toString(36).slice(-4)}`;
      const { data: pack, error: e2 } = await supabase
        .from("packs")
        .insert({
          name,
          slug,
          description: src.description,
          owner_id: u.user.id,
          is_public: false,
          is_builtin: false,
        })
        .select("id")
        .single();
      if (e2 || !pack) throw new Error(e2?.message ?? "Duplicate failed");
      const { data: oldSlots, error: e3 } = await supabase
        .from("pack_slots")
        .select("slot_index, sample_id, label, gain_db, pan, pitch_offset_semitones")
        .eq("pack_id", id);
      if (e3) throw new Error(e3.message);
      const rows = (oldSlots ?? []).map((s) => ({ ...s, pack_id: pack.id }));
      if (rows.length) {
        const { error: e4 } = await supabase.from("pack_slots").insert(rows);
        if (e4) throw new Error(e4.message);
      }
      return pack.id;
    },
    onSuccess: (newId) => {
      toast.success("Pack duplicated");
      qc.invalidateQueries({ queryKey: ["studio", "packs"] });
      setSelectedId(newId);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Duplicate failed"),
  });

  const packs = packsQ.data ?? [];
  const selected = packs.find((p) => p.id === selectedId) ?? null;

  // Auto-select first pack on load
  useEffect(() => {
    if (!selectedId && packs.length) setSelectedId(packs[0].id);
  }, [packs, selectedId]);

  return (
    <section className="grid gap-4 lg:grid-cols-[240px_1fr_300px]">
      {/* Packs list */}
      <Panel
        title="My Packs"
        action={
          <button
            onClick={() => {
              const name = window.prompt("Pack name?")?.trim();
              if (name) createPack.mutate(name);
            }}
            disabled={createPack.isPending}
            className="flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-foreground/60 hover:text-foreground disabled:opacity-50"
          >
            <Plus className="h-3 w-3" /> New
          </button>
        }
      >
        {packsQ.isLoading ? (
          <p className="px-3 py-6 text-xs text-foreground/45">Loading…</p>
        ) : packs.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-foreground/45">
            No packs yet. Click + New.
          </p>
        ) : (
          <ul className="space-y-1">
            {packs.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    selectedId === p.id
                      ? "bg-white/10 text-foreground"
                      : "text-foreground/65 hover:bg-white/5"
                  }`}
                >
                  <div className="truncate">{p.name}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-foreground/40">
                    {new Date(p.updated_at).toLocaleDateString()}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Slot editor */}
      <Panel title={selected ? selected.name : "Select a pack"}>
        {selected ? (
          <PackEditor
            pack={selected}
            slots={slotsQ.data ?? []}
            samples={samplesQ.data ?? []}
            slotsLoading={slotsQ.isLoading}
            onRename={(name) => renamePack.mutate({ id: selected.id, name })}
            onDelete={() => {
              if (confirm(`Delete "${selected.name}"?`)) deletePack.mutate(selected.id);
            }}
            onDuplicate={() => dupPack.mutate(selected.id)}
            onChanged={() => qc.invalidateQueries({ queryKey: ["studio", "slots", selected.id] })}
          />
        ) : (
          <p className="px-3 py-12 text-center text-xs text-foreground/45">
            Create or pick a pack on the left.
          </p>
        )}
      </Panel>

      {/* Samples */}
      <Panel
        title="My Samples"
        action={
          <SampleUploadButton
            onUploaded={() => qc.invalidateQueries({ queryKey: ["studio", "samples"] })}
          />
        }
      >
        <SamplesList
          samples={samplesQ.data ?? []}
          loading={samplesQ.isLoading}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["studio", "samples"] });
            qc.invalidateQueries({ queryKey: ["studio", "slots"] });
          }}
        />
      </Panel>
    </section>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.18em] text-foreground/55">{title}</span>
        {action}
      </div>
      {children}
    </section>
  );
}

function PackEditor({
  pack,
  slots,
  samples,
  slotsLoading,
  onRename,
  onDelete,
  onDuplicate,
  onChanged,
}: {
  pack: PackRow;
  slots: SlotRow[];
  samples: SampleRow[];
  slotsLoading: boolean;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onChanged: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(pack.name);
  useEffect(() => setName(pack.name), [pack.id, pack.name]);

  const exportJson = () => {
    const dto = {
      version: 1,
      name: pack.name,
      slug: pack.slug,
      description: pack.description,
      slots: slots.map((s) => {
        const sample = samples.find((x) => x.id === s.sample_id) ?? null;
        return {
          slot_index: s.slot_index,
          label: s.label,
          pitch_offset_semitones: s.pitch_offset_semitones,
          gain_db: s.gain_db,
          pan: s.pan,
          sample: sample
            ? { name: sample.name, storage_path: sample.storage_path }
            : null,
        };
      }),
    };
    const blob = new Blob([JSON.stringify(dto, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pack.slug}.pack.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        {editingName ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setEditingName(false);
              if (name.trim() && name !== pack.name) onRename(name.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setName(pack.name);
                setEditingName(false);
              }
            }}
            className="flex-1 rounded bg-white/5 px-2 py-1 text-sm outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="flex-1 truncate rounded px-1 text-left text-sm hover:bg-white/5"
            title="Click to rename"
          >
            {pack.name}
          </button>
        )}
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" onClick={() => setEditingName(true)} title="Rename">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDuplicate} title="Duplicate">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={exportJson} title="Export JSON">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {slotsLoading ? (
        <p className="px-3 py-6 text-xs text-foreground/45">Loading slots…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              samples={samples}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SlotCard({
  slot,
  samples,
  onChanged,
}: {
  slot: SlotRow;
  samples: SampleRow[];
  onChanged: () => void;
}) {
  // Local state for snappy UI + debounced DB writes
  const [local, setLocal] = useState(slot);
  useEffect(() => setLocal(slot), [slot.id, slot.sample_id, slot.label, slot.gain_db, slot.pan, slot.pitch_offset_semitones]);

  const writeTimer = useRef<number | null>(null);
  const schedule = (patch: Partial<SlotRow>, debounceMs = 250) => {
    const next = { ...local, ...patch };
    setLocal(next);
    if (writeTimer.current) window.clearTimeout(writeTimer.current);
    writeTimer.current = window.setTimeout(async () => {
      const { error } = await supabase.from("pack_slots").update(patch).eq("id", slot.id);
      if (error) toast.error(error.message);
      onChanged();
    }, debounceMs);
  };

  const sample = samples.find((s) => s.id === local.sample_id) ?? null;

  const audition = () => {
    if (!sample) return;
    auditionSample(sample.storage_path, {
      pitchSemitones: local.pitch_offset_semitones,
      pan: local.pan,
      gainDb: local.gain_db,
    });
  };

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-foreground/55">
          Slot {slot.slot_index + 1}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={audition}
          disabled={!sample}
          title="Audition"
        >
          <Play className="h-3.5 w-3.5" />
        </Button>
      </div>

      <select
        value={local.sample_id ?? ""}
        onChange={(e) => schedule({ sample_id: e.target.value || null }, 0)}
        className="mb-2 w-full rounded bg-white/5 px-2 py-1.5 text-xs text-foreground outline-none"
      >
        <option value="" className="bg-neutral-900">— empty —</option>
        {samples.map((s) => (
          <option key={s.id} value={s.id} className="bg-neutral-900">
            {s.name}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Label"
        value={local.label ?? ""}
        onChange={(e) => schedule({ label: e.target.value })}
        className="mb-3 w-full rounded bg-white/5 px-2 py-1 text-xs text-foreground outline-none placeholder:text-foreground/35"
      />

      <SliderRow
        label="Pitch"
        unit="st"
        min={-24}
        max={24}
        step={1}
        value={local.pitch_offset_semitones}
        onChange={(v) => schedule({ pitch_offset_semitones: v })}
      />
      <SliderRow
        label="Gain"
        unit="dB"
        min={-24}
        max={6}
        step={0.5}
        value={local.gain_db}
        onChange={(v) => schedule({ gain_db: v })}
      />
      <SliderRow
        label="Pan"
        unit=""
        min={-1}
        max={1}
        step={0.05}
        value={local.pan}
        onChange={(v) => schedule({ pan: v })}
      />
    </div>
  );
}

function SliderRow({
  label,
  unit,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <span className="w-10 shrink-0 text-[10px] uppercase tracking-[0.18em] text-foreground/45">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-white/70"
      />
      <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-foreground/60">
        {step >= 1 ? value.toFixed(0) : value.toFixed(2)}
        {unit}
      </span>
    </div>
  );
}

function SampleUploadButton({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${u.user.id}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage
        .from("samples")
        .upload(path, file, { contentType: file.type || "audio/wav", upsert: false });
      if (upErr) throw upErr;

      let duration: number | null = null;
      let sr: number | null = null;
      let ch: number | null = null;
      try {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctor();
        const buf = await ctx.decodeAudioData(await file.arrayBuffer());
        duration = buf.duration;
        sr = buf.sampleRate;
        ch = buf.numberOfChannels;
        ctx.close();
      } catch {
        /* ignore decode errors — non-fatal */
      }

      const { error: insErr } = await supabase.from("samples").insert({
        name: file.name,
        storage_path: path,
        mime_type: file.type || "audio/wav",
        size_bytes: file.size,
        duration_sec: duration,
        sample_rate_hz: sr,
        channels: ch,
        owner_id: u.user.id,
      });
      if (insErr) throw insErr;
      toast.success(`Uploaded ${file.name}`);
      onUploaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.wav,.flac,.aiff,.mp3,.ogg"
        hidden
        onChange={handle}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-foreground/60 hover:text-foreground disabled:opacity-50"
      >
        <Upload className="h-3 w-3" /> {busy ? "Uploading…" : "Upload"}
      </button>
    </>
  );
}

function SamplesList({
  samples,
  loading,
  onChanged,
}: {
  samples: SampleRow[];
  loading: boolean;
  onChanged: () => void;
}) {
  const remove = async (s: SampleRow) => {
    if (!confirm(`Delete ${s.name}? Slots using it will be cleared.`)) return;
    const { error: stErr } = await supabase.storage.from("samples").remove([s.storage_path]);
    if (stErr) {
      toast.error(stErr.message);
      return;
    }
    const { error } = await supabase.from("samples").delete().eq("id", s.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sample deleted");
    onChanged();
  };

  if (loading) return <p className="px-3 py-6 text-xs text-foreground/45">Loading…</p>;
  if (samples.length === 0)
    return (
      <p className="px-3 py-8 text-center text-xs text-foreground/45">
        No samples yet. Upload above.
      </p>
    );

  return (
    <ul className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
      {samples.map((s) => (
        <li
          key={s.id}
          className="group rounded-lg px-2 py-2 text-xs hover:bg-white/5"
        >
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-foreground/85" title={s.name}>
              {s.name}
            </span>
            <button
              onClick={() => auditionSample(s.storage_path)}
              className="text-foreground/55 hover:text-foreground"
              title="Audition"
            >
              <Play className="h-3 w-3" />
            </button>
            <button
              onClick={() => remove(s)}
              className="text-foreground/40 hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-foreground/35">
            {s.duration_sec ? `${s.duration_sec.toFixed(2)}s` : "—"} ·{" "}
            {s.sample_rate_hz ?? "—"}Hz · {s.channels ?? "—"}ch
          </div>
        </li>
      ))}
    </ul>
  );
}