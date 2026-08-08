/**
 * PROTOTYPE-ONLY transmission data for SYS-010.
 *
 * Developer placeholders. No canonical transmission text exists in the repo
 * (WORLD_LORE §24.2 describes tone only), so nothing here is narrative canon.
 * The windows are configuration values, not product canon.
 */
import type { TransmissionDefinition } from "./transmissionTypes";

export const SAMPLE_TRANSMISSIONS: TransmissionDefinition[] = [
  {
    id: "dev-a",
    label: "Transmission A",
    windowStart: 0.1,
    windowEnd: 0.25,
    durationSeconds: 6,
    weight: 1,
    oncePerCrossing: true,
  },
  {
    id: "dev-b",
    label: "Transmission B",
    windowStart: 0.35,
    windowEnd: 0.55,
    durationSeconds: 8,
    weight: 1,
    oncePerCrossing: true,
  },
  {
    id: "dev-c",
    label: "Transmission C",
    windowStart: 0.7,
    windowEnd: 0.88,
    durationSeconds: 5,
    weight: 1,
    oncePerCrossing: true,
  },
];
