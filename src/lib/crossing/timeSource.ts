/**
 * LEGACY SYS-007 DEBUG time source.
 *
 * Retained only for the quarantined crossing debug adapter. The production
 * crossing runtime accepts supplied active journey time and owns no clock.
 */
export type TimeSource = () => number;

/** Legacy debug-adapter default. Not a production journey-time authority. */
export const performanceTimeSource: TimeSource = () =>
  typeof performance !== "undefined" ? performance.now() / 1000 : Date.now() / 1000;

/** Test/dev helper: a hand-advanced monotonic clock. */
export function createManualTimeSource(start = 0) {
  let t = start;
  const source: TimeSource = () => t;
  return {
    source,
    set: (v: number) => {
      t = v;
    },
    advance: (dt: number) => {
      t += dt;
    },
  };
}
