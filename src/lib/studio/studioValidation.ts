import type { AdminPack } from "../admin/packs.functions.ts";
import type { AdminScale } from "../admin/scales.functions.ts";
import type { SceneRow } from "../admin/scenes.functions.ts";
import type { Humanization } from "../admin/humanization.ts";
import { validateSceneAssetPath } from "./studioSecurity.ts";

export type StudioValidationIssue = {
  path: string;
  message: string;
};

export function validatePackForPublication(pack: AdminPack): StudioValidationIssue[] {
  const issues: StudioValidationIssue[] = [];
  requireName(issues, "name", pack.name);

  if (pack.slots.length === 0) {
    issue(issues, "slots", "add at least one sample slot");
  }
  if (pack.slots.length > 12) {
    issue(issues, "slots", "cannot contain more than 12 slots");
  }

  const slotIndexes = new Set<number>();
  for (const [slotPosition, slot] of pack.slots.entries()) {
    const slotPath = `slots[${slotPosition}]`;
    if (!Number.isInteger(slot.slot_index) || slot.slot_index < 0 || slot.slot_index >= 12) {
      issue(issues, `${slotPath}.slot_index`, "must be an integer from 0 to 11");
    }
    if (slotIndexes.has(slot.slot_index)) {
      issue(issues, `${slotPath}.slot_index`, "must be unique within the pack");
    }
    slotIndexes.add(slot.slot_index);
    if (slot.samples.length === 0) {
      issue(issues, `${slotPath}.samples`, "assign at least one audio sample");
    }
    if (slot.samples.length > 6) {
      issue(issues, `${slotPath}.samples`, "cannot contain more than 6 samples");
    }
    for (const [samplePosition, sample] of slot.samples.entries()) {
      try {
        validateSceneAssetPath(sample.storage_path);
      } catch {
        issue(
          issues,
          `${slotPath}.samples[${samplePosition}].storage_path`,
          "must be a safe relative storage path",
        );
      }
    }
    validateHumanization(issues, `${slotPath}.humanization`, slot.humanization);
  }
  validateHumanization(issues, "humanization", pack.humanization);

  return issues;
}

export function validateScaleForPublication(scale: AdminScale): StudioValidationIssue[] {
  const issues: StudioValidationIssue[] = [];
  requireName(issues, "name", scale.name);

  if (scale.pitches.length < 1 || scale.pitches.length > 24) {
    issue(issues, "pitches", "must contain between 1 and 24 pitches");
  }
  if (scale.pool_size !== scale.pitches.length) {
    issue(issues, "pool_size", "must match the number of authored pitches");
  }
  if (new Set(scale.pitches).size !== scale.pitches.length) {
    issue(issues, "pitches", "cannot contain duplicate pitches");
  }
  if (scale.pitches.some((pitch) => !pitch.trim())) {
    issue(issues, "pitches", "cannot contain an empty pitch");
  }
  if (scale.steps.length === 0) {
    issue(issues, "steps", "add at least one progression step");
  }

  const stepOrders = new Set<number>();
  for (const [stepPosition, step] of scale.steps.entries()) {
    const stepPath = `steps[${stepPosition}]`;
    if (!Number.isInteger(step.step_order) || step.step_order < 0) {
      issue(issues, `${stepPath}.step_order`, "must be a non-negative integer");
    }
    if (stepOrders.has(step.step_order)) {
      issue(issues, `${stepPath}.step_order`, "must be unique within the scale");
    }
    stepOrders.add(step.step_order);
    if (
      !Number.isInteger(step.duration_bars) ||
      step.duration_bars < 1 ||
      step.duration_bars > 32
    ) {
      issue(issues, `${stepPath}.duration_bars`, "must be an integer from 1 to 32");
    }
    const chord = new Set(step.chord_tones);
    const accent = new Set(step.accent_tones);
    if (chord.size + accent.size === 0) {
      issue(issues, stepPath, "assign at least one chord or accent tone");
    }
    for (const tone of [...chord, ...accent]) {
      if (!Number.isInteger(tone) || tone < 0 || tone >= scale.pitches.length) {
        issue(issues, stepPath, "tone indexes must reference the authored pitch pool");
        break;
      }
    }
    if ([...chord].some((tone) => accent.has(tone))) {
      issue(issues, stepPath, "a tone cannot be both chord and accent");
    }
  }

  return issues;
}

export function validateSceneForPublication(scene: SceneRow): StudioValidationIssue[] {
  const issues: StudioValidationIssue[] = [];
  requireName(issues, "name", scene.name);

  if (!Number.isInteger(scene.base_laps) || scene.base_laps < 1 || scene.base_laps > 40) {
    issue(issues, "base_laps", "must be an integer from 1 to 40");
  }
  if (
    !Number.isFinite(scene.macro_cycle_seconds) ||
    scene.macro_cycle_seconds < 2 ||
    scene.macro_cycle_seconds > 180
  ) {
    issue(issues, "macro_cycle_seconds", "must be between 2 and 180 seconds");
  }
  if (!Number.isInteger(scene.note_count) || scene.note_count < 4 || scene.note_count > 24) {
    issue(issues, "note_count", "must be an integer from 4 to 24");
  }

  if (scene.background_path) {
    try {
      validateSceneAssetPath(scene.background_path);
    } catch {
      issue(issues, "background_path", "must be a safe relative storage path");
    }
  }

  for (const [key, color] of Object.entries(scene.ui_theme_colors)) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      issue(issues, `ui_theme_colors.${key}`, "must be a six-digit hexadecimal color");
    }
  }
  bounded(issues, "visual_fx.backgroundBlur", scene.visual_fx.backgroundBlur, 0, 40);
  bounded(issues, "visual_fx.backgroundGlow", scene.visual_fx.backgroundGlow, 0, 1);
  bounded(issues, "visual_fx.trailPersistence", scene.visual_fx.trailPersistence, 0, 0.5);
  bounded(issues, "audio_reactive.amplitude", scene.audio_reactive.amplitude, 0, 2);
  bounded(issues, "audio_reactive.threshold", scene.audio_reactive.threshold, 0, 1);

  return issues;
}

export function assertPublicationReady(
  contentType: "pack" | "scale" | "scene",
  issues: StudioValidationIssue[],
): void {
  if (issues.length === 0) return;
  const summary = issues.map(({ path, message }) => `${path}: ${message}`).join("; ");
  throw new Error(`Cannot publish ${contentType}: ${summary}`);
}

function requireName(issues: StudioValidationIssue[], path: string, name: string): void {
  if (!name.trim()) issue(issues, path, "is required");
  if (name.length > 80) issue(issues, path, "cannot exceed 80 characters");
}

function validateHumanization(
  issues: StudioValidationIssue[],
  path: string,
  humanization: Humanization | null,
): void {
  if (!humanization) return;
  bounded(issues, `${path}.velocityPct`, humanization.velocityPct, 0, 1);
  bounded(issues, `${path}.detuneCents`, humanization.detuneCents, 0, 200);
  bounded(issues, `${path}.panPct`, humanization.panPct, 0, 1);
  if (humanization.cutoffHz) {
    const [low, high] = humanization.cutoffHz;
    if (!Number.isFinite(low) || !Number.isFinite(high) || low <= 0 || high <= 0 || low > high) {
      issue(issues, `${path}.cutoffHz`, "must be an ascending pair of positive frequencies");
    }
  }
}

function bounded(
  issues: StudioValidationIssue[],
  path: string,
  value: number,
  min: number,
  max: number,
): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    issue(issues, path, `must be between ${min} and ${max}`);
  }
}

function issue(issues: StudioValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}
