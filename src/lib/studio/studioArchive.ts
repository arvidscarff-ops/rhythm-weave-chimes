import type { AdminPack } from "../admin/packs.functions.ts";
import type { AdminScale } from "../admin/scales.functions.ts";
import type { SceneRow } from "../admin/scenes.functions.ts";
import { R4_ORBITAL_COMPOSITION } from "../rhythm/orbitalFamily.ts";
import { R4_PENDULUM_COMPOSITION } from "../rhythm/pendulumFamily.ts";
import { R4_STRING_NETWORK_COMPOSITION } from "../rhythm/stringNetworkFamily.ts";
import type { ReferenceComposition } from "../rhythm/referenceAuthority.ts";
import type { PresetRow } from "./presets.functions.ts";
import type { PresetMap, StoredPreset } from "./sceneBuilderStore.ts";

export const STUDIO_ARCHIVE_KIND = "phase-studio-archive";
export const STUDIO_ARCHIVE_VERSION = 1;

export type StudioPrototypeId = "r4-pendulum" | "r4-orbital" | "r4-string-network";

export type StudioEngineFamily = {
  prototypeId: StudioPrototypeId;
  name: string;
  compositionId: string;
  compositionVersion: number;
  macroCycleTicks: string;
  timingAuthority: "r3-reference-authority";
  tuningStatus: "provisional-a4-432-engineering-fixture";
  voices: Array<{
    id: string;
    subdivisions: number;
    frequencyHz: number;
    hue: number;
  }>;
};

export type StudioArchive = {
  kind: typeof STUDIO_ARCHIVE_KIND;
  schemaVersion: typeof STUDIO_ARCHIVE_VERSION;
  exportedAt: string;
  scope: "private-owner-studio";
  engineFamilies: StudioEngineFamily[];
  content: {
    packs: AdminPack[];
    scales: AdminScale[];
    scenes: SceneRow[];
    composerPresets: PresetRow[];
    localBuilderBlueprints: StoredPreset[];
  };
};

export type StudioArchiveInput = {
  exportedAt?: string;
  packs: AdminPack[];
  scales: AdminScale[];
  scenes: SceneRow[];
  composerPresets: PresetRow[];
  localBuilderBlueprints: PresetMap;
};

const ENGINE_SOURCES: ReadonlyArray<{
  prototypeId: StudioPrototypeId;
  name: string;
  composition: ReferenceComposition;
}> = [
  {
    prototypeId: "r4-pendulum",
    name: "Pendulum Fan",
    composition: R4_PENDULUM_COMPOSITION,
  },
  {
    prototypeId: "r4-orbital",
    name: "Orbital Sweep",
    composition: R4_ORBITAL_COMPOSITION,
  },
  {
    prototypeId: "r4-string-network",
    name: "Resonant String Network",
    composition: R4_STRING_NETWORK_COMPOSITION,
  },
];

export function studioEngineFamilies(): StudioEngineFamily[] {
  return ENGINE_SOURCES.map(({ prototypeId, name, composition }) => ({
    prototypeId,
    name,
    compositionId: composition.id,
    compositionVersion: composition.version,
    macroCycleTicks: composition.macroCycleTicks.toString(),
    timingAuthority: "r3-reference-authority",
    tuningStatus: "provisional-a4-432-engineering-fixture",
    voices: composition.voices.map((voice) => ({ ...voice })),
  }));
}

export function createStudioArchive(input: StudioArchiveInput): StudioArchive {
  return {
    kind: STUDIO_ARCHIVE_KIND,
    schemaVersion: STUDIO_ARCHIVE_VERSION,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    scope: "private-owner-studio",
    engineFamilies: studioEngineFamilies(),
    content: {
      packs: input.packs
        .map((pack) => ({
          ...pack,
          slots: pack.slots
            .map((slot) => ({
              ...slot,
              samples: [...slot.samples].sort(
                (a, b) => a.position - b.position || a.id.localeCompare(b.id),
              ),
            }))
            .sort((a, b) => a.slot_index - b.slot_index || a.id.localeCompare(b.id)),
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      scales: input.scales
        .map((scale) => ({
          ...scale,
          steps: [...scale.steps].sort(
            (a, b) => a.step_order - b.step_order || a.id.localeCompare(b.id),
          ),
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      scenes: [...input.scenes].sort((a, b) => a.id.localeCompare(b.id)),
      composerPresets: [...input.composerPresets].sort((a, b) => a.id.localeCompare(b.id)),
      localBuilderBlueprints: Object.values(input.localBuilderBlueprints).sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
    },
  };
}

export function serializeStudioArchive(archive: StudioArchive): string {
  return `${JSON.stringify(archive, null, 2)}\n`;
}

export function isStudioArchive(value: unknown): value is StudioArchive {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StudioArchive>;
  if (
    candidate.kind !== STUDIO_ARCHIVE_KIND ||
    candidate.schemaVersion !== STUDIO_ARCHIVE_VERSION ||
    candidate.scope !== "private-owner-studio" ||
    typeof candidate.exportedAt !== "string" ||
    !Array.isArray(candidate.engineFamilies) ||
    !candidate.content ||
    typeof candidate.content !== "object"
  ) {
    return false;
  }

  return (
    Array.isArray(candidate.content.packs) &&
    Array.isArray(candidate.content.scales) &&
    Array.isArray(candidate.content.scenes) &&
    Array.isArray(candidate.content.composerPresets) &&
    Array.isArray(candidate.content.localBuilderBlueprints)
  );
}

export function studioArchiveFilename(exportedAt: string): string {
  const date = exportedAt.slice(0, 10);
  return `phase-studio-backup-${date}.json`;
}
