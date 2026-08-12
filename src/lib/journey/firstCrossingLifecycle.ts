import type {
  FirstCrossingCoordinator,
  FirstCrossingCoordinatorResult,
} from "./firstCrossingCoordinator";

export type FirstCrossingMusicalTransportControls = Readonly<{
  pause(): void;
  resume(): void;
  suspendForBackground(): void;
  resumeFromBackground(): void;
}>;

export type FirstCrossingLifecycleControls = Readonly<{
  pause(): FirstCrossingCoordinatorResult;
  resume(): FirstCrossingCoordinatorResult;
  suspendForBackground(): FirstCrossingCoordinatorResult;
  resumeFromBackground(): FirstCrossingCoordinatorResult;
}>;

/**
 * One command boundary for the two approved, deliberately separate time
 * owners. This object owns no state or clock: the coordinator remains journey
 * authority and the supplied transport remains musical authority.
 */
export function coordinateFirstCrossingLifecycle(
  coordinator: FirstCrossingCoordinator,
  musicalTransport: FirstCrossingMusicalTransportControls,
): FirstCrossingLifecycleControls {
  return Object.freeze({
    pause() {
      const result = coordinator.pause();
      musicalTransport.pause();
      return result;
    },
    resume() {
      const result = coordinator.resume();
      musicalTransport.resume();
      return result;
    },
    suspendForBackground() {
      const result = coordinator.suspendForBackground();
      musicalTransport.suspendForBackground();
      return result;
    },
    resumeFromBackground() {
      const result = coordinator.resumeFromBackground();
      musicalTransport.resumeFromBackground();
      return result;
    },
  });
}
