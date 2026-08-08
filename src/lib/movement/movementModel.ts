/**
 * SYS-006 — pure transit movement simulation (PROTOTYPE, NON-CANON).
 *
 * Owns nothing but maths: no rendering, no input devices, no rAF loop, no
 * clock. The caller owns the loop and passes a delta time in seconds.
 *
 * ---------------------------------------------------------------------------
 * PROTOTYPE COORDINATE FRAME
 *   +Z = forward transit direction
 *   +X = lateral (right)
 *   +Y = vertical (up)
 *
 *   `baseSpeed` controls the FORWARD (z) component only.
 *   `steeringStrength`, `acceleration`, `damping` and `maxLateralSpeed`
 *   operate on the LATERAL/VERTICAL (x, y) components only.
 *   `maxLateralSpeed` caps the COMBINED magnitude sqrt(vx^2 + vy^2); the pair
 *   is scaled proportionally, never clamped per-axis, so a diagonal steer
 *   cannot exceed the intended lateral limit.
 *
 * Invariants (all covered by tests):
 *   - zero input keeps producing forward motion at the baseline
 *   - damping after release never bleeds forward transit speed
 *   - lateral steering never increases the forward component
 *   - maxLateralSpeed caps lateral/vertical magnitude, not total velocity
 *   - total speed may naturally exceed baseSpeed while carving; the forward
 *     component remains the single clear baseline
 * ---------------------------------------------------------------------------
 *
 * Model assumption (prototype only): forward transit is already happening. The
 * player never holds "forward"; input only bends lateral/vertical direction.
 * Zero input is a valid, stable, non-failing play state.
 *
 * Authoritative state is position + velocity ONLY. Base speed and steer input
 * are per-frame params/inputs, never stored; heading is derived from velocity
 * rather than simulated as a second source of truth.
 */

/** Normalized device-agnostic input. Produced by adapters, never by devices. */
export interface MovementInput {
  /** -1 (left) .. 1 (right) */
  steerX: number;
  /** -1 (down) .. 1 (up) */
  steerY: number;
}

/** Authoritative simulation state. Nothing else lives here. */
export interface MovementState {
  position: { x: number; y: number; z: number };
  /** World velocity in units/second. z is forward. */
  velocity: { x: number; y: number; z: number };
}

/** Developer-tunable feel parameters. Prototype defaults, none canon. */
export interface MovementParams {
  /** Baseline FORWARD (z) speed. Never touched by steering or damping. */
  baseSpeed: number;
  /** Fraction of maxLateralSpeed a full steer deflection requests. */
  steeringStrength: number;
  /** Approach rate (1/s) toward requested lateral velocity while steering. */
  acceleration: number;
  /** Approach rate (1/s) back toward zero lateral velocity after release. */
  damping: number;
  /** Cap on the combined lateral/vertical velocity magnitude. */
  maxLateralSpeed: number;
  /**
   * How quickly the forward component relaxes to baseSpeed (1/s). Only ever
   * pulls z toward baseSpeed, so a baseSpeed change eases in rather than
   * snapping. It can never be driven by steering.
   */
  forwardResponse: number;
}

/**
 * Pathological-delta clamp. Tab stalls, breakpoints and background throttling
 * hand us multi-second deltas; clamping at the simulation boundary keeps a
 * resumed tab from teleporting. 50 ms ~= 20 fps worst case.
 */
export const MAX_STEP_DT = 0.05;

export const DEFAULT_MOVEMENT_PARAMS: MovementParams = {
  baseSpeed: 30,
  steeringStrength: 1,
  acceleration: 4,
  damping: 2.2,
  maxLateralSpeed: 18,
  forwardResponse: 3,
};

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const finite = (v: number, fallback = 0) => (Number.isFinite(v) ? v : fallback);

/**
 * Explicit initializer / reset helper. The sandbox route and the tests both go
 * through this, so "reset" is a property of the model, not of route state.
 */
export function createMovementState(
  params: MovementParams = DEFAULT_MOVEMENT_PARAMS,
): MovementState {
  return {
    position: { x: 0, y: 0, z: 0 },
    // Start already in transit at the baseline: the craft is never at rest.
    velocity: { x: 0, y: 0, z: Math.max(0, finite(params.baseSpeed)) },
  };
}

/** Alias for call sites that mean "put it back to a clean state". */
export const resetMovementState = createMovementState;

/**
 * Frame-rate independent exponential approach factor: 1 - e^(-rate*dt).
 * The same input over the same wall-clock time yields the same result at any
 * frame rate, which is why nothing here multiplies by dt linearly.
 */
const approach = (rate: number, dt: number) => 1 - Math.exp(-Math.max(0, rate) * dt);

/**
 * Advance the simulation by `dt` seconds. Pure: returns a new state and never
 * mutates its arguments. One small object per call — cheap enough for a sandbox.
 */
export function stepMovement(
  state: MovementState,
  input: MovementInput,
  dt: number,
  params: MovementParams,
): MovementState {
  const step = clamp(finite(dt), 0, MAX_STEP_DT);

  const steerX = clamp(finite(input.steerX), -1, 1);
  const steerY = clamp(finite(input.steerY), -1, 1);

  const maxLat = Math.max(0, finite(params.maxLateralSpeed));
  const strength = clamp(finite(params.steeringStrength, 1), 0, 4);

  // --- lateral / vertical: the only axes steering, acceleration, damping and
  // maxLateralSpeed touch.
  let targetX = steerX * strength * maxLat;
  let targetY = steerY * strength * maxLat;
  // Scale the requested vector as a whole so diagonals request at most maxLat.
  const targetMag = Math.hypot(targetX, targetY);
  if (targetMag > maxLat && targetMag > 0) {
    const s = maxLat / targetMag;
    targetX *= s;
    targetY *= s;
  }

  // Steering uses `acceleration`; a released axis falls back to `damping` —
  // this release/coast/recentre split is what the presets are compared on.
  const kx = approach(steerX === 0 ? params.damping : params.acceleration, step);
  const ky = approach(steerY === 0 ? params.damping : params.acceleration, step);

  const v = state.velocity;
  let vx = finite(v.x + (targetX - v.x) * kx);
  let vy = finite(v.y + (targetY - v.y) * ky);

  // Combined-magnitude cap: proportional scale-down, never a per-axis clamp.
  const lateralMag = Math.hypot(vx, vy);
  if (lateralMag > maxLat && lateralMag > 0) {
    const s = maxLat / lateralMag;
    vx *= s;
    vy *= s;
  }

  // --- forward: driven ONLY by baseSpeed. Steering cannot raise it and
  // damping cannot bleed it; it converges to baseSpeed and stays there.
  const baseSpeed = Math.max(0, finite(params.baseSpeed));
  const kz = approach(
    finite(params.forwardResponse, DEFAULT_MOVEMENT_PARAMS.forwardResponse),
    step,
  );
  const vz = finite(v.z + (baseSpeed - v.z) * kz, baseSpeed);

  const p = state.position;
  return {
    position: {
      x: finite(p.x + vx * step),
      y: finite(p.y + vy * step),
      z: finite(p.z + vz * step),
    },
    velocity: { x: vx, y: vy, z: vz },
  };
}

/** Total speed magnitude — naturally exceeds baseSpeed while carving. */
export function speedOf(state: MovementState): number {
  const { x, y, z } = state.velocity;
  return Math.sqrt(x * x + y * y + z * z);
}

/** Combined lateral/vertical speed — the quantity maxLateralSpeed governs. */
export function lateralSpeedOf(state: MovementState): number {
  return Math.hypot(state.velocity.x, state.velocity.y);
}

/**
 * Heading is DERIVED, never stored — yaw/pitch in radians relative to +Z.
 * Falls back to straight ahead when the forward component is degenerate.
 */
export function headingOf(state: MovementState): { yaw: number; pitch: number } {
  const { x, y, z } = state.velocity;
  const forward = Math.abs(z) < 1e-6 ? 1e-6 : z;
  const flat = Math.hypot(x, forward) || 1e-6;
  return { yaw: Math.atan2(x, forward), pitch: Math.atan2(y, flat) };
}
