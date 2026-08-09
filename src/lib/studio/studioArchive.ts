import type { AdminPack } from "../admin/packs.functions";
import type { AdminScale } from "../admin/scales.functions";
import type { SceneRow } from "../admin/scenes.functions";
import { R4_ORBITAL_GEOMETRY } from "../rhythm/orbitalFamily";
import { R4_PENDULUM_STRANDS } from "../rhythm/pendulumFamily";
import { R4_SHARED_LAB_COMPOSITION, R4_SHARED_LAB_MACRO_SECONDS } from "../rhythm/r4SharedLab";
import { R4_STRING_NETWORK_GEOMETRY } from "../rhythm/stringNetworkFamily";
import type { PresetRow } from "./presets.functions";
import type { PresetMap, StoredPreset } from "./sceneBuilderStore";

export const STUDIO_ARCHIVE_KIND = "phase-studio-archive";
export const STUDIO_ARCHIVE_VERSION = 1;

export type StudioPrototypeId = "r4-pendulum" | "r4-orbital" | "r4-string-network";

export type StudioR4LabFamily = {
  prototypeId: StudioPrototypeId;
  name: string;
  voiceIds: string[];
};

export type StudioR4LaboratoryEvidence = {
  status: "development-only-comparative-lab";
  timingAuthority: "shared-exact-rational-authoritative-timeline";
  composition: {
    id: string;
    version: number;
    macroCycleDurationSeconds: {
      numerator: string;
      denominator: string;
    };
    voices: Array<{ id: string; eventsPerMacroCycle: number }>;
  };
  families: StudioR4LabFamily[];
};

export type StudioArchive = {
  kind: typeof STUDIO_ARCHIVE_KIND;
  schemaVersion: typeof STUDIO_ARCHIVE_VERSION;
  exportedAt: string;
  scope: "private-owner-studio";
  rhythmLaboratories: {
    r4SharedFamilyLab: StudioR4LaboratoryEvidence;
  };
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

const LAB_FAMILY_SOURCES: ReadonlyArray<{
  prototypeId: StudioPrototypeId;
  name: string;
  voiceIds: readonly string[];
}> = [
  {
    prototypeId: "r4-pendulum",
    name: "Pendulum Fan",
    voiceIds: R4_PENDULUM_STRANDS.map((voice) => voice.voiceId),
  },
  {
    prototypeId: "r4-orbital",
    name: "Orbital Sweep",
    voiceIds: R4_ORBITAL_GEOMETRY.map((voice) => voice.voiceId),
  },
  {
    prototypeId: "r4-string-network",
    name: "Resonant String Network",
    voiceIds: R4_STRING_NETWORK_GEOMETRY.map((voice) => voice.voiceId),
  },
];

export function studioR4Laboratory(): StudioR4LaboratoryEvidence {
  return {
    status: "development-only-comparative-lab",
    timingAuthority: "shared-exact-rational-authoritative-timeline",
    composition: {
      id: R4_SHARED_LAB_COMPOSITION.id,
      version: R4_SHARED_LAB_COMPOSITION.version,
      macroCycleDurationSeconds: {
        numerator: R4_SHARED_LAB_MACRO_SECONDS.secondsNumerator.toString(),
        denominator: R4_SHARED_LAB_MACRO_SECONDS.secondsDenominator.toString(),
      },
      voices: R4_SHARED_LAB_COMPOSITION.voices.map((voice) => ({ ...voice })),
    },
    families: LAB_FAMILY_SOURCES.map(({ prototypeId, name, voiceIds }) => ({
      prototypeId,
      name,
      voiceIds: [...voiceIds],
    })),
  };
}

export function createStudioArchive(input: StudioArchiveInput): StudioArchive {
  return {
    kind: STUDIO_ARCHIVE_KIND,
    schemaVersion: STUDIO_ARCHIVE_VERSION,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    scope: "private-owner-studio",
    rhythmLaboratories: {
      r4SharedFamilyLab: studioR4Laboratory(),
    },
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
    !candidate.rhythmLaboratories?.r4SharedFamilyLab ||
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
