/**
 * SYS-006 — chase camera (PROTOTYPE, NON-CANON).
 *
 * Fully separate from movement: it only ever READS a MovementState and owns
 * its own smoothing state. Nothing here is final PHASE camera behaviour.
 */
import type { MovementState } from "./movementModel";

export interface CameraParams {
  /** How hard the camera pulls toward its ideal offset (1/s). */
  followStrength: number;
  /** How far ahead the camera aims, in seconds of current velocity. */
  lookAhead: number;
  /** Smoothing on the aim point (1/s). Lower = laggier, floatier. */
  damping: number;
  /** Distance behind the craft along -Z. */
  distance: number;
  /** Height above the craft along +Y. */
  height: number;
}

export interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

export const DEFAULT_CAMERA_PARAMS: CameraParams = {
  followStrength: 3.5,
  lookAhead: 0.6,
  damping: 4,
  distance: 14,
  height: 4,
};

export function createCameraState(
  move?: MovementState,
  params: CameraParams = DEFAULT_CAMERA_PARAMS,
): CameraState {
  const p = move?.position ?? { x: 0, y: 0, z: 0 };
  return {
    position: { x: p.x, y: p.y + params.height, z: p.z - params.distance },
    target: { x: p.x, y: p.y, z: p.z },
  };
}

const approach = (rate: number, dt: number) => 1 - Math.exp(-Math.max(0, rate) * dt);

export function stepCamera(
  cam: CameraState,
  move: MovementState,
  dt: number,
  params: CameraParams,
): CameraState {
  const step = Math.max(0, Math.min(dt, 0.05));
  const kf = approach(params.followStrength, step);
  const kd = approach(params.damping, step);

  const desiredX = move.position.x;
  const desiredY = move.position.y + params.height;
  const desiredZ = move.position.z - params.distance;

  const aimX = move.position.x + move.velocity.x * params.lookAhead;
  const aimY = move.position.y + move.velocity.y * params.lookAhead;
  const aimZ = move.position.z + move.velocity.z * params.lookAhead;

  return {
    position: {
      x: cam.position.x + (desiredX - cam.position.x) * kf,
      y: cam.position.y + (desiredY - cam.position.y) * kf,
      z: cam.position.z + (desiredZ - cam.position.z) * kf,
    },
    target: {
      x: cam.target.x + (aimX - cam.target.x) * kd,
      y: cam.target.y + (aimY - cam.target.y) * kd,
      z: cam.target.z + (aimZ - cam.target.z) * kd,
    },
  };
}
