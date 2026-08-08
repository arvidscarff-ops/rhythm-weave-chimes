/**
 * Tiny injectable monotonic time source (SYS-007 prototype).
 *
 * The crossing runtime never calls `performance.now()` directly, so tests —
 * and any future coordinated time authority — can swap this boundary without
 * touching runtime logic. Deliberately not a clock framework: one function,
 * seconds, monotonic, no epoch meaning.
 */
export type TimeSource = () => number;

/** Production default: monotonic seconds. */
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
