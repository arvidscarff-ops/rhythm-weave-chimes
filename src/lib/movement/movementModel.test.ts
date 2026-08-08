import { describe, expect, it } from "vitest";
import {
  DEFAULT_MOVEMENT_PARAMS,
  MAX_STEP_DT,
  createMovementState,
  headingOf,
  lateralSpeedOf,
  resetMovementState,
  speedOf,
  stepMovement,
  type MovementInput,
  type MovementParams,
} from "./movementModel";

const NEUTRAL: MovementInput = { steerX: 0, steerY: 0 };
const P: MovementParams = { ...DEFAULT_MOVEMENT_PARAMS };

const run = (
  steps: number,
  input: MovementInput,
  dt = 1 / 60,
  params: MovementParams = P,
  state = createMovementState(params),
) => {
  let s = state;
  for (let i = 0; i < steps; i++) s = stepMovement(s, input, dt, params);
  return s;
};

describe("SYS-006 movement model", () => {
  it("keeps forward motion at the baseline with zero input", () => {
    const s = run(60 * 60, NEUTRAL); // one minute of inactivity
    expect(s.velocity.z).toBeCloseTo(P.baseSpeed, 6);
    expect(s.velocity.x).toBe(0);
    expect(s.velocity.y).toBe(0);
    expect(s.position.z).toBeGreaterThan(0);
    // no drift explosion
    expect(Math.abs(s.position.x)).toBeLessThan(1e-9);
    expect(Number.isFinite(s.position.z)).toBe(true);
  });

  it("is deterministic for the same input and dt sequence", () => {
    const seq = [0.016, 0.02, 0.004, 0.033, 0.05];
    const play = () => {
      let s = createMovementState(P);
      for (let i = 0; i < 200; i++) {
        const input = i % 3 === 0 ? { steerX: 1, steerY: -1 } : NEUTRAL;
        s = stepMovement(s, input, seq[i % seq.length]!, P);
      }
      return s;
    };
    expect(play()).toEqual(play());
  });

  it("caps the COMBINED lateral magnitude on diagonal input", () => {
    const s = run(2000, { steerX: 1, steerY: 1 });
    expect(lateralSpeedOf(s)).toBeLessThanOrEqual(P.maxLateralSpeed + 1e-9);
    // and it actually reaches the limit rather than stalling early
    expect(lateralSpeedOf(s)).toBeGreaterThan(P.maxLateralSpeed * 0.99);
    // per-axis therefore sits below the cap on a diagonal
    expect(Math.abs(s.velocity.x)).toBeLessThan(P.maxLateralSpeed);
  });

  it("caps single-axis steering at maxLateralSpeed", () => {
    const s = run(2000, { steerX: 1, steerY: 0 });
    expect(s.velocity.x).toBeLessThanOrEqual(P.maxLateralSpeed + 1e-9);
    expect(s.velocity.x).toBeCloseTo(P.maxLateralSpeed, 4);
  });

  it("never lets steering raise the forward component", () => {
    const s = run(1200, { steerX: 1, steerY: 1 });
    expect(s.velocity.z).toBeCloseTo(P.baseSpeed, 6);
    // total speed may naturally exceed baseline while carving
    expect(speedOf(s)).toBeGreaterThan(P.baseSpeed);
  });

  it("damps lateral velocity after release without bleeding forward speed", () => {
    const steered = run(120, { steerX: 1, steerY: 0 });
    const lateralAtRelease = lateralSpeedOf(steered);
    expect(lateralAtRelease).toBeGreaterThan(1);

    let s = steered;
    for (let i = 0; i < 600; i++) s = stepMovement(s, NEUTRAL, 1 / 60, P);
    expect(lateralSpeedOf(s)).toBeLessThan(lateralAtRelease * 0.01);
    expect(s.velocity.z).toBeCloseTo(P.baseSpeed, 6);
  });

  it("clamps pathological deltas so a stalled tab cannot teleport", () => {
    const before = createMovementState(P);
    const big = stepMovement(before, { steerX: 1, steerY: 0 }, 5, P);
    const clamped = stepMovement(before, { steerX: 1, steerY: 0 }, MAX_STEP_DT, P);
    expect(big).toEqual(clamped);
    expect(big.position.z).toBeLessThan(P.baseSpeed * MAX_STEP_DT + 1e-6);
  });

  it("stays finite with hostile inputs and params", () => {
    const bad: MovementParams = {
      ...P,
      baseSpeed: Number.NaN,
      steeringStrength: Number.POSITIVE_INFINITY,
    };
    let s = createMovementState(P);
    for (let i = 0; i < 100; i++) {
      s = stepMovement(s, { steerX: Number.NaN, steerY: 99 }, Number.NaN, bad);
    }
    for (const v of [s.position.x, s.position.y, s.position.z, s.velocity.x, s.velocity.y, s.velocity.z]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("reset restores a clean state through the initializer helper", () => {
    const dirty = run(300, { steerX: -1, steerY: 1 });
    expect(dirty.position.x).not.toBe(0);
    const fresh = resetMovementState(P);
    expect(fresh).toEqual(createMovementState(P));
    expect(fresh.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(fresh.velocity).toEqual({ x: 0, y: 0, z: P.baseSpeed });
  });

  it("derives heading from velocity", () => {
    expect(headingOf(createMovementState(P)).yaw).toBeCloseTo(0, 6);
    const right = run(300, { steerX: 1, steerY: 0 });
    expect(headingOf(right).yaw).toBeGreaterThan(0);
    const up = run(300, { steerX: 0, steerY: 1 });
    expect(headingOf(up).pitch).toBeGreaterThan(0);
  });

  it("is frame-rate independent over the same wall-clock time", () => {
    const fine = run(600, { steerX: 1, steerY: 0 }, 1 / 120);
    const coarse = run(300, { steerX: 1, steerY: 0 }, 1 / 60);
    expect(fine.velocity.x).toBeCloseTo(coarse.velocity.x, 2);
  });
});
