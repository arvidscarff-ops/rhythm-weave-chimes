export type NeuralPreset = {
  id: string;
  label: string;
  color: [number, number, number];   // base RGB 0..1
  colorB?: [number, number, number]; // optional gradient partner
};

export const NEURAL_PRESETS: NeuralPreset[] = [
  { id: "aurora",  label: "Aurora",      color: [0.20, 0.85, 0.78], colorB: [0.35, 0.55, 0.95] },
  { id: "lagoon",  label: "Lagoon",      color: [0.15, 0.55, 0.65] },
  { id: "ember",   label: "Ember",       color: [0.95, 0.45, 0.15], colorB: [0.85, 0.18, 0.55] },
  { id: "violet",  label: "Violet Mist", color: [0.45, 0.30, 0.85], colorB: [0.85, 0.40, 0.95] },
  { id: "phase",   label: "Phase Pink",  color: [0.90, 0.20, 0.40] },
  { id: "mono",    label: "Mono",        color: [0.92, 0.94, 1.00] },
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