import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Archive, ArrowUpRight, Boxes, CircleGauge, Database, Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { listAdminPacks } from "@/lib/admin/packs.functions";
import { listAdminScales } from "@/lib/admin/scales.functions";
import { listAdminScenes } from "@/lib/admin/scenes.functions";
import { listMyPresets } from "@/lib/studio/presets.functions";
import { loadPresets } from "@/lib/studio/sceneBuilderStore";
import {
  createStudioArchive,
  serializeStudioArchive,
  studioArchiveFilename,
  studioEngineFamilies,
} from "@/lib/studio/studioArchive";

export const Route = createFileRoute("/studio/")({
  ssr: false,
  component: StudioOverview,
});

function StudioOverview() {
  const listPacks = useServerFn(listAdminPacks);
  const listScales = useServerFn(listAdminScales);
  const listScenes = useServerFn(listAdminScenes);
  const listPresets = useServerFn(listMyPresets);
  const contentQ = useQuery({
    queryKey: ["studio", "overview"],
    queryFn: async () => {
      const [packs, scales, scenes, composerPresets] = await Promise.all([
        listPacks(),
        listScales(),
        listScenes(),
        listPresets(),
      ]);
      return { packs, scales, scenes, composerPresets };
    },
  });

  const content = contentQ.data;
  const families = studioEngineFamilies();

  const downloadBackup = () => {
    if (!content) return;
    const archive = createStudioArchive({
      ...content,
      localBuilderBlueprints: loadPresets(),
    });
    const blob = new Blob([serializeStudioArchive(archive)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = studioArchiveFilename(archive.exportedAt);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success("Studio backup exported", {
      description: "Schema v1 · private owner content only",
    });
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-5 border border-white/10 bg-white/[0.025] p-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.22em] text-foreground/40">
            <CircleGauge className="h-3.5 w-3.5" /> Reset R5 · private owner workspace
          </div>
          <h2 className="mt-3 text-2xl font-medium tracking-tight">
            Authoritative content control
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/55">
            Packs, scales, scenes, compositions, and approved Trigger Engine fixtures are
            inventoried here before the legacy authoring paths are consolidated.
          </p>
        </div>
        <Button onClick={downloadBackup} disabled={!content || contentQ.isFetching}>
          <Download className="mr-2 h-4 w-4" />
          {contentQ.isFetching ? "Reading Studio…" : "Export backup"}
        </Button>
      </section>

      {contentQ.isError && (
        <section className="border border-red-400/25 bg-red-400/[0.06] p-4 text-sm text-red-100">
          Studio content could not be inventoried. No partial backup will be exported.
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Database className="h-4 w-4 text-foreground/45" />
          <h3 className="text-sm uppercase tracking-[0.18em] text-foreground/70">
            Content inventory
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InventoryCard label="Sound packs" count={content?.packs.length} to="/studio/packs" />
          <InventoryCard label="Scales" count={content?.scales.length} to="/studio/scales" />
          <InventoryCard label="Scenes" count={content?.scenes.length} to="/studio/scenes" />
          <InventoryCard
            label="Composer presets"
            count={content?.composerPresets.length}
            to="/studio/builder"
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Boxes className="h-4 w-4 text-foreground/45" />
          <h3 className="text-sm uppercase tracking-[0.18em] text-foreground/70">
            Approved Trigger Engine family
          </h3>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {families.map((family) => (
            <article key={family.prototypeId} className="border border-white/10 p-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-300/70">
                R3 authority · exact closure
              </div>
              <h4 className="mt-2 text-base">{family.name}</h4>
              <dl className="mt-4 grid grid-cols-2 gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/45">
                <div>
                  <dt>Voices</dt>
                  <dd className="mt-1 text-foreground/80">{family.voices.length}</dd>
                </div>
                <div>
                  <dt>Composition</dt>
                  <dd className="mt-1 truncate text-foreground/80">{family.compositionId}</dd>
                </div>
              </dl>
              <Button asChild variant="ghost" size="sm" className="mt-4 px-0">
                <Link to="/" search={{ prototype: family.prototypeId }}>
                  Open authoritative preview <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </article>
          ))}
        </div>
        <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-foreground/35">
          A4=432 Hz remains a provisional engineering fixture; temperament is unresolved.
        </p>
      </section>

      <section className="flex items-start gap-3 border border-white/10 p-4">
        <Archive className="mt-0.5 h-4 w-4 text-foreground/45" />
        <p className="text-xs leading-relaxed text-foreground/50">
          Backup schema v1 is deterministic and validation-ready. This increment exports data only;
          it does not overwrite, import, publish, or delete Studio content.
        </p>
      </section>
    </div>
  );
}

function InventoryCard({
  label,
  count,
  to,
}: {
  label: string;
  count: number | undefined;
  to: "/studio/packs" | "/studio/scales" | "/studio/scenes" | "/studio/builder";
}) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between border border-white/10 p-4 transition hover:border-white/20 hover:bg-white/[0.025]"
    >
      <span className="text-sm text-foreground/65">{label}</span>
      <span className="font-mono text-lg text-foreground/85">
        {count === undefined ? "—" : count}
      </span>
    </Link>
  );
}
