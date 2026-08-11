export const PACK_IDS = ["moss", "prism", "obsidian"] as const;
export type PackId = (typeof PACK_IDS)[number];
