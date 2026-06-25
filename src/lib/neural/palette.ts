export type NeuralPreset = {
  id: string;
  label: string;
  color: [number, number, number];   // base RGB 0..1
  colorB?: [number, number, number]; // optional gradient partner
  /** Optional override for the app stage background (CSS background value). */
  stage?: string;
};

export const NEURAL_PRESETS: NeuralPreset[] = [
  { id: "aurora",  label: "Aurora",  color: [0.30, 1.00, 0.85], colorB: [0.10, 0.45, 1.00] },
  { id: "ember",   label: "Ember",   color: [1.00, 0.45, 0.05], colorB: [0.85, 0.05, 0.25] },
  { id: "violet",  label: "Violet",  color: [0.95, 0.20, 0.95], colorB: [0.25, 0.10, 0.95] },
  { id: "acid",    label: "Acid",    color: [0.75, 1.00, 0.10], colorB: [0.00, 0.85, 0.35] },
  { id: "phase",   label: "Phase",   color: [1.00, 0.10, 0.55], colorB: [0.10, 0.35, 1.00] },
  {
    id: "obsidian",
    label: "Obsidian",
    color: [0.08, 0.10, 0.14],
    colorB: [0.18, 0.22, 0.32],
    stage:
      "radial-gradient(120% 90% at 70% 20%, oklch(14% 0.015 250 / 0.9) 0%, transparent 60%)," +
      "radial-gradient(120% 90% at 10% 95%, oklch(10% 0.01 260 / 0.95) 0%, transparent 65%)," +
      "linear-gradient(160deg, oklch(8% 0.008 260) 0%, oklch(5% 0.005 260) 60%, oklch(3% 0.004 260) 100%)",
  },
];

export const DEFAULT_PRESET_ID = "aurora";

export type NeuralSettings = {
  presetId: string;
  opacity: number; // 0..0.6
  speed: number;   // multiplier; 0..2
};

export const DEFAULT_NEURAL_SETTINGS: NeuralSettings = {
  presetId: DEFAULT_PRESET_ID,
  opacity: 0.22,
  speed: 0.55,
};

const STORAGE_KEY = "phase.neural.settings";
const EVENT = "phase:neural-settings";

export function loadNeuralSettings(): NeuralSettings {
  if (typeof window === "undefined") return DEFAULT_NEURAL_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NEURAL_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_NEURAL_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_NEURAL_SETTINGS;
  }
}

export function saveNeuralSettings(s: NeuralSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent(EVENT, { detail: s }));
  } catch {
    /* ignore */
  }
}

export function subscribeNeuralSettings(cb: (s: NeuralSettings) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<NeuralSettings>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

export function presetById(id: string): NeuralPreset {
  return NEURAL_PRESETS.find((p) => p.id === id) ?? NEURAL_PRESETS[0];
}