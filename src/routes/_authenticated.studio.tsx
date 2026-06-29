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