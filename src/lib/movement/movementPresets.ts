/**
 * SYS-006 — DEVELOPMENT-ONLY starting points for comparison.
 *
 * NOT gameplay modes, difficulty settings or canon. They exist purely so two
 * feels can be A/B'd quickly in the sandbox.
 */
import { DEFAULT_MOVEMENT_PARAMS, type MovementParams } from "./movementModel";

export interface MovementPreset {
  id: "default" | "calm" | "responsive" | "drift";
  label: string;
  note: string;
  params: MovementParams;
}

export const MOVEMENT_PRESETS: MovementPreset[] = [
  {
    id: "default",
    label: "DEFAULT",
    note: "neutral starting point",
    params: { ...DEFAULT_MOVEMENT_PARAMS },
  },
  {
    id: "calm",
    label: "CALM",
    note: "slow, heavily damped, serene",
    params: {
      baseSpeed: 20,
      steeringStrength: 0.7,
      acceleration: 2.5,
      damping: 3.5,
      maxLateralSpeed: 10,
      forwardResponse: 2,
    },
  },
  {
    id: "responsive",
    label: "RESPONSIVE",
    note: "immediate steering, quick recentre",
    params: {
      baseSpeed: 38,
      steeringStrength: 1,
      acceleration: 8,
      damping: 6,
      maxLateralSpeed: 24,
      forwardResponse: 4,
    },
  },
  {
    id: "drift",
    label: "DRIFT",
    note: "heavy inertia, long settling",
    params: {
      baseSpeed: 32,
      steeringStrength: 1,
      acceleration: 1.6,
      damping: 0.7,
      maxLateralSpeed: 26,
      forwardResponse: 1.5,
    },
  },
];
