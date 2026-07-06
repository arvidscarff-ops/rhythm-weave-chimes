/**
 * Palette engine — resolves per-track colors for the Scene Builder.
 * Interpolates between two anchor hex colors in linear RGB space (good
 * enough for glow orbs), or resolves a named preset. Returned colors
 * are plain `#rrggbb` strings so callers can pipe them straight into
 * canvas `fillStyle` / `strokeStyle` with alpha via `globalAlpha`.
 */

import type { AestheticConfig, PalettePresetId } from "@/lib/engine/pathTransformer";

export type PalettePreset = {
  id: PalettePresetId;
  label: string;
  start: string;
  end: string;
};

export const PALETTE_PRESETS: PalettePreset[] = [
  { id: "neonCyberpunk", label: "Neon Cyberpunk", start: "#00F5FF", end: "#FF00A8" },
  { id: "deepOcean",     label: "Deep Ocean",     start: "#02203C", end: "#5FE1FF" },
  { id: "autumnHorizon", label: "Autumn Horizon", start: "#FFB347", end: "#8E24AA" },
  { id: "phosphorLime",  label: "Phosphor Lime",  start: "#0B3D0B", end: "#B7FF3B" },
  { id: "violetDusk",    label: "Violet Dusk",    start: "#1A0033", end: "#E066FF" },
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, "");
  const s = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0");
  const n = parseInt(s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const to = (n: number) => clamp(n).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function resolveAnchors(cfg: AestheticConfig["palette"]): [string, string] {
  if (cfg.mode === "preset" && cfg.presetId) {
    const p = PALETTE_PRESETS.find((x) => x.id === cfg.presetId);
    if (p) return [p.start, p.end];
  }
  return [cfg.startHex, cfg.endHex];
}

/** Per-track color; `i` in [0..N-1]. Falls back to start when N<=1. */
export function paletteAt(cfg: AestheticConfig["palette"], i: number, N: number): string {
  const [aHex, bHex] = resolveAnchors(cfg);
  const t = N <= 1 ? 0 : Math.max(0, Math.min(1, i / (N - 1)));
  const [r1, g1, b1] = hexToRgb(aHex);
  const [r2, g2, b2] = hexToRgb(bHex);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Midpoint color — useful for ambient flashes. */
export function paletteMid(cfg: AestheticConfig["palette"]): string {
  return paletteAt(cfg, 1, 3);
}

/** Convert `#rrggbb` + alpha to an rgba() string. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}