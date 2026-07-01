import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { auditionSample } from "@/lib/dev/samplePlayer";

export const Route = createFileRoute("/dev")({
  component: DevPage,
});

type Pack = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_public: boolean;
  is_builtin: boolean;
};

type Sample = {
  id: string;
  name: string;
  storage_path: string;
  duration_sec: number | null;
  sample_rate_hz: number | null;
  channels: number | null;
  bit_depth: number | null;
  size_bytes: number | null;
};

type Slot = {
  id: string;
  pack_id: string;
  slot_index: number;
  sample_id: string | null;
  label: string | null;
  gain_db: number;
  pan: number;
  pitch_offset_semitones: number;
};

const SHELL: React.CSSProperties = {
  background: "var(--pr-bg-grad)",
  color: "var(--pr-text)",
};

function DevPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={SHELL}>
        <span className="pr-label text-white/55">LOADING…</span>
      </main>
    );
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6" style={SHELL}>
        <div className="max-w-sm text-center">
          <div className="pr-label text-white/55 mb-3">PHASE® / DEV</div>
          <p className="text-sm text-white/70 mb-6">
            This area is restricted to the project owner.
          </p>
          <Link to="/" className="pr-label text-white/40 hover:text-white/80">← BACK TO WHEEL</Link>
        </div>
      </main>
    );
  }

  return <DevConsole />;
}

function DevConsole() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshPacks = useCallback(async () => {
    const { data, error } = await supabase
      .from("packs")
      .select("id, slug, name, description, is_public, is_builtin")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setPacks(data ?? []);
  }, []);

  const refreshSamples = useCallback(async () => {
    const { data, error } = await supabase
      .from("samples")
      .select("id, name, storage_path, duration_sec, sample_rate_hz, channels, bit_depth, size_bytes")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setSamples(data ?? []);
  }, []);

  const refreshSlots = useCallback(async (packId: string | null) => {
    if (!packId) { setSlots([]); return; }
    const { data, error } = await supabase
      .from("pack_slots")
      .select("*, pack_slot_samples(sample_id, position)")
      .eq("pack_id", packId)
      .order("slot_index");
    if (error) { setError(error.message); return; }
    type Row = {
      id: string;
      pack_id: string;
      slot_index: number;
      label: string | null;
      gain_db: number;
      pan: number;
      pitch_offset_semitones: number;
      pack_slot_samples: Array<{ sample_id: string; position: number }> | null;
    };
    setSlots(
      ((data ?? []) as unknown as Row[]).map((r) => {
        const first = (r.pack_slot_samples ?? [])
          .slice()
          .sort((a, b) => a.position - b.position)[0];
        return {
          id: r.id,
          pack_id: r.pack_id,
          slot_index: r.slot_index,
          sample_id: first?.sample_id ?? null,
          label: r.label,
          gain_db: r.gain_db,
          pan: r.pan,
          pitch_offset_semitones: r.pitch_offset_semitones,
        };
      }),
    );
  }, []);

  useEffect(() => {
    refreshPacks();
    refreshSamples();
  }, [refreshPacks, refreshSamples]);

  useEffect(() => {
    refreshSlots(selectedPackId);
  }, [selectedPackId, refreshSlots]);

  const createPack = async () => {
    const name = window.prompt("Pack name?")?.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("packs")
      .insert({ name, slug, owner_id: u.user?.id, is_public: false })
      .select()
      .single();
    setBusy(false);
    if (error) { setError(error.message); return; }
    // initialise 1 empty slot; dynamic pack model
    await supabase.from("pack_slots").insert({ pack_id: data.id, slot_index: 0 });
    await refreshPacks();
    setSelectedPackId(data.id);
  };

  const deletePack = async (id: string) => {
    if (!window.confirm("Delete this pack? Slots will be removed; samples remain.")) return;
    const { error } = await supabase.from("packs").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    if (selectedPackId === id) setSelectedPackId(null);
    await refreshPacks();
  };

  const togglePublic = async (p: Pack) => {
    await supabase.from("packs").update({ is_public: !p.is_public }).eq("id", p.id);
    refreshPacks();
  };

  return (
    <main className="min-h-screen px-8 py-10" style={SHELL}>
      <header className="flex items-center justify-between mb-10">
        <div>
          <div className="pr-label text-white/55">PHASE® / DEV MODE</div>
          <h1 className="text-2xl text-white/85 tracking-tight mt-1">Sound Pack Studio</h1>
        </div>
        <Link to="/" className="pr-label text-white/45 hover:text-white/80">← WHEEL</Link>
      </header>

      {error && (
        <div className="mb-6 text-xs text-rose-200/80 border border-rose-200/20 px-3 py-2 rounded">
          {error} <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_320px] gap-6">
        {/* PACKS COLUMN */}
        <Panel title="PACKS" action={<button onClick={createPack} disabled={busy} className="pr-label text-white/70 hover:text-white">+ NEW</button>}>
          <ul className="space-y-1">
            {packs.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setSelectedPackId(p.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                    selectedPackId === p.id ? "bg-white/10 text-white/90" : "text-white/60 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{p.name}</span>
                    <span className="pr-label text-white/35">{p.is_builtin ? "BUILT-IN" : p.is_public ? "PUBLIC" : "PRIVATE"}</span>
                  </div>
                  <div className="pr-label text-white/35">{p.slug}</div>
                </button>
              </li>
            ))}
            {packs.length === 0 && (
              <li className="pr-label text-white/40 px-3 py-6">NO PACKS YET</li>
            )}
          </ul>
        </Panel>

        {/* SLOTS */}
        <Panel title={selectedPackId ? "SLOTS" : "SELECT A PACK"}>
          {selectedPackId ? (
            <SlotsEditor
              packId={selectedPackId}
              slots={slots}
              samples={samples}
              onChange={() => refreshSlots(selectedPackId)}
              pack={packs.find((p) => p.id === selectedPackId)}
              onTogglePublic={togglePublic}
              onDelete={deletePack}
            />
          ) : (
            <div className="pr-label text-white/40 px-3 py-12 text-center">PICK OR CREATE A PACK ON THE LEFT</div>
          )}
        </Panel>

        {/* SAMPLES LIBRARY */}
        <Panel title="SAMPLES" action={<UploadButton onUploaded={refreshSamples} />}>
          <SampleList samples={samples} onChanged={refreshSamples} />
        </Panel>
      </div>
    </main>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl p-5"
      style={{
        background: "rgba(10,14,18,0.32)",
        backdropFilter: "blur(22px)",
        WebkitBackdropFilter: "blur(22px)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="pr-label text-white/55">{title}</span>
        {action}
      </div>
      {children}
    </section>
  );
}

function UploadButton({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${u.user?.id}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from("samples").upload(path, file, {
        contentType: file.type || "audio/wav",
        upsert: false,
      });
      if (upErr) throw upErr;
      // Decode for metadata
      let duration: number | null = null;
      let sr: number | null = null;
      let ch: number | null = null;
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctor();
        const buf = await ctx.decodeAudioData(await file.arrayBuffer());
        duration = buf.duration;
        sr = buf.sampleRate;
        ch = buf.numberOfChannels;
        ctx.close();
      } catch { /* ignore */ }
      const { error: insErr } = await supabase.from("samples").insert({
        name: file.name,
        storage_path: path,
        mime_type: file.type || "audio/wav",
        size_bytes: file.size,
        duration_sec: duration,
        sample_rate_hz: sr,
        channels: ch,
        owner_id: u.user?.id,
      });
      if (insErr) throw insErr;
      onUploaded();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="audio/*,.wav,.flac,.aiff" hidden onChange={handle} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="pr-label text-white/70 hover:text-white disabled:opacity-50"
      >
        {busy ? "UPLOADING…" : "+ UPLOAD"}
      </button>
    </>
  );
}

function SampleList({ samples, onChanged }: { samples: Sample[]; onChanged: () => void }) {
  const remove = async (s: Sample) => {
    if (!window.confirm(`Delete ${s.name}?`)) return;
    await supabase.storage.from("samples").remove([s.storage_path]);
    await supabase.from("samples").delete().eq("id", s.id);
    onChanged();
  };
  if (samples.length === 0) {
    return <div className="pr-label text-white/40 px-3 py-6 text-center">NO SAMPLES YET</div>;
  }
  return (
    <ul className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
      {samples.map((s) => (
        <li key={s.id} className="px-3 py-2 rounded hover:bg-white/5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-white/85" title={s.name}>{s.name}</span>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => auditionSample(s.storage_path)} className="pr-label text-white/60 hover:text-white">▸</button>
              <button onClick={() => remove(s)} className="pr-label text-white/40 hover:text-rose-300">×</button>
            </div>
          </div>
          <div className="pr-label text-white/35 mt-0.5">
            {s.duration_sec ? `${s.duration_sec.toFixed(2)}S` : "—"} · {s.sample_rate_hz ?? "—"}HZ · {s.channels ?? "—"}CH
          </div>
        </li>
      ))}
    </ul>
  );
}

function SlotsEditor({
  packId,
  slots,
  samples,
  pack,
  onChange,
  onTogglePublic,
  onDelete,
}: {
  packId: string;
  slots: Slot[];
  samples: Sample[];
  pack?: Pack;
  onChange: () => void;
  onTogglePublic: (p: Pack) => void;
  onDelete: (id: string) => void;
}) {
  const update = async (slot: Slot, patch: Partial<Slot>) => {
    await supabase.from("pack_slots").update(patch).eq("id", slot.id);
    onChange();
  };

  return (
    <div>
      {pack && (
        <div className="flex items-center justify-between mb-4 px-1">
          <div>
            <div className="text-white/85 text-sm">{pack.name}</div>
            <div className="pr-label text-white/40">{pack.slug}</div>
          </div>
          <div className="flex gap-3 items-center">
            {!pack.is_builtin && (
              <button onClick={() => onTogglePublic(pack)} className="pr-label text-white/60 hover:text-white">
                {pack.is_public ? "MAKE PRIVATE" : "MAKE PUBLIC"}
              </button>
            )}
            {!pack.is_builtin && (
              <button onClick={() => onDelete(pack.id)} className="pr-label text-white/40 hover:text-rose-300">DELETE</button>
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {slots.map((slot) => {
          const sample = samples.find((s) => s.id === slot.sample_id) ?? null;
          return (
            <div
              key={slot.id}
              className="rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="pr-label text-white/55">SLOT {slot.slot_index + 1}</span>
                <button
                  onClick={() => sample && auditionSample(sample.storage_path, {
                    pitchSemitones: slot.pitch_offset_semitones,
                    pan: slot.pan,
                    gainDb: slot.gain_db,
                  })}
                  disabled={!sample}
                  className="pr-label text-white/60 hover:text-white disabled:opacity-30"
                >▸ AUDITION</button>
              </div>

              <select
                value={slot.sample_id ?? ""}
                onChange={(e) => update(slot, { sample_id: e.target.value || null })}
                className="w-full bg-transparent border-b border-white/15 py-1.5 text-sm text-white/85 focus:outline-none focus:border-white/40 mb-3"
              >
                <option value="" className="bg-neutral-900">— EMPTY —</option>
                {samples.map((s) => (
                  <option key={s.id} value={s.id} className="bg-neutral-900">{s.name}</option>
                ))}
              </select>

              <input
                type="text"
                placeholder="LABEL"
                value={slot.label ?? ""}
                onChange={(e) => update(slot, { label: e.target.value })}
                className="w-full bg-transparent border-b border-white/10 py-1 text-xs text-white/75 focus:outline-none focus:border-white/30 mb-3"
              />

              <NumberRow label="PITCH ST" min={-24} max={24} step={1} value={slot.pitch_offset_semitones} onChange={(v) => update(slot, { pitch_offset_semitones: v })} />
              <NumberRow label="GAIN DB" min={-24} max={6} step={0.5} value={slot.gain_db} onChange={(v) => update(slot, { gain_db: v })} />
              <NumberRow label="PAN" min={-1} max={1} step={0.05} value={slot.pan} onChange={(v) => update(slot, { pan: v })} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NumberRow({
  label, min, max, step, value, onChange,
}: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="pr-label text-white/45 w-16 shrink-0">{label}</span>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-white/70"
      />
      <span className="pr-label text-white/65 w-12 text-right tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}