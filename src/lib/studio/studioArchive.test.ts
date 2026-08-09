import { expect, test } from "vitest";

import {
  createStudioArchive,
  isStudioArchive,
  serializeStudioArchive,
  STUDIO_ARCHIVE_KIND,
  STUDIO_ARCHIVE_VERSION,
  studioArchiveFilename,
} from "./studioArchive";

const exportedAt = "2026-08-03T12:00:00.000Z";

test("Studio backup is versioned, deterministic, and sorted without mutating input", () => {
  const packs = [
    {
      id: "pack-b",
      name: "B",
      slug: "b",
      description: null,
      is_published: false,
      cover_image_url: null,
      humanization: null,
      updated_at: exportedAt,
      slots: [
        {
          id: "slot-b",
          slot_index: 1,
          label: null,
          gain_db: 0,
          pan: 0,
          pitch_offset_semitones: 0,
          humanization: null,
          samples: [],
        },
        {
          id: "slot-a",
          slot_index: 0,
          label: null,
          gain_db: 0,
          pan: 0,
          pitch_offset_semitones: 0,
          humanization: null,
          samples: [],
        },
      ],
    },
    {
      id: "pack-a",
      name: "A",
      slug: "a",
      description: null,
      is_published: true,
      cover_image_url: null,
      humanization: null,
      updated_at: exportedAt,
      slots: [],
    },
  ];

  const archive = createStudioArchive({
    exportedAt,
    packs,
    scales: [],
    scenes: [],
    composerPresets: [],
    localBuilderBlueprints: {},
  });

  expect(archive.kind).toBe(STUDIO_ARCHIVE_KIND);
  expect(archive.schemaVersion).toBe(STUDIO_ARCHIVE_VERSION);
  expect(archive.content.packs.map((pack) => pack.id)).toEqual(["pack-a", "pack-b"]);
  expect(archive.content.packs[1].slots.map((slot) => slot.slot_index)).toEqual([0, 1]);
  expect(packs[0].slots.map((slot) => slot.slot_index)).toEqual([1, 0]);
  expect(serializeStudioArchive(archive)).toBe(
    serializeStudioArchive(
      createStudioArchive({
        exportedAt,
        packs: [...packs].reverse(),
        scales: [],
        scenes: [],
        composerPresets: [],
        localBuilderBlueprints: {},
      }),
    ),
  );
});

test("Studio backup serializes current R4 laboratory evidence without bigint values", () => {
  const archive = createStudioArchive({
    exportedAt,
    packs: [],
    scales: [],
    scenes: [],
    composerPresets: [],
    localBuilderBlueprints: {},
  });
  const serialized = serializeStudioArchive(archive);
  const parsed: unknown = JSON.parse(serialized);

  expect(isStudioArchive(parsed)).toBe(true);
  const lab = archive.rhythmLaboratories.r4SharedFamilyLab;
  expect(lab.status).toBe("development-only-comparative-lab");
  expect(lab.timingAuthority).toBe("shared-exact-rational-authoritative-timeline");
  expect(lab.composition.id).toBe("reset-r4-shared-family-lab");
  expect(lab.composition.macroCycleDurationSeconds).toEqual({
    numerator: "24",
    denominator: "1",
  });
  expect(lab.families.map((family) => family.prototypeId)).toEqual([
    "r4-pendulum",
    "r4-orbital",
    "r4-string-network",
  ]);
  expect(studioArchiveFilename(exportedAt)).toBe("phase-studio-backup-2026-08-03.json");
});

test("Studio backup guard rejects unknown schemas", () => {
  expect(
    isStudioArchive({
      kind: STUDIO_ARCHIVE_KIND,
      schemaVersion: 99,
      exportedAt,
      scope: "private-owner-studio",
      rhythmLaboratories: {},
      content: {
        packs: [],
        scales: [],
        scenes: [],
        composerPresets: [],
        localBuilderBlueprints: [],
      },
    }),
  ).toBe(false);
});
