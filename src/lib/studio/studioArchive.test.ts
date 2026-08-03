import assert from "node:assert/strict";
import test from "node:test";

import {
  createStudioArchive,
  isStudioArchive,
  serializeStudioArchive,
  STUDIO_ARCHIVE_KIND,
  STUDIO_ARCHIVE_VERSION,
  studioArchiveFilename,
} from "./studioArchive.ts";

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

  assert.equal(archive.kind, STUDIO_ARCHIVE_KIND);
  assert.equal(archive.schemaVersion, STUDIO_ARCHIVE_VERSION);
  assert.deepEqual(
    archive.content.packs.map((pack) => pack.id),
    ["pack-a", "pack-b"],
  );
  assert.deepEqual(
    archive.content.packs[1].slots.map((slot) => slot.slot_index),
    [0, 1],
  );
  assert.deepEqual(
    packs[0].slots.map((slot) => slot.slot_index),
    [1, 0],
  );
});

test("Studio backup serializes approved engine fixtures without bigint values", () => {
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

  assert.equal(isStudioArchive(parsed), true);
  assert.deepEqual(
    archive.engineFamilies.map((family) => family.prototypeId),
    ["r4-pendulum", "r4-orbital", "r4-string-network"],
  );
  assert.ok(
    archive.engineFamilies.every(
      (family) =>
        family.timingAuthority === "r3-reference-authority" &&
        family.tuningStatus === "provisional-a4-432-engineering-fixture",
    ),
  );
  assert.equal(studioArchiveFilename(exportedAt), "phase-studio-backup-2026-08-03.json");
});

test("Studio backup guard rejects unknown schemas", () => {
  assert.equal(
    isStudioArchive({
      kind: STUDIO_ARCHIVE_KIND,
      schemaVersion: 99,
      exportedAt,
      scope: "private-owner-studio",
      engineFamilies: [],
      content: {
        packs: [],
        scales: [],
        scenes: [],
        composerPresets: [],
        localBuilderBlueprints: [],
      },
    }),
    false,
  );
});
