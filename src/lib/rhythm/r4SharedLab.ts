import type { RhythmCompositionDefinition } from "./authoritativeTimeline";
import {
  createLiveTimelineAdapter,
  exactTransportSeconds,
  type LiveTimelineAdapter,
} from "./liveTimelineAdapter";

/**
 * Shared, diagnostic-only composition for comparing the three Reset R4
 * geometry families against the exact same authority.
 *
 * The voice IDs describe event relationships rather than visual families so
 * one snapshot can drive every renderer. This is laboratory data, not a
 * production composition or tuning decision.
 */
export const R4_SHARED_LAB_COMPOSITION: RhythmCompositionDefinition = Object.freeze({
  id: "reset-r4-shared-family-lab",
  version: 1,
  voices: Object.freeze(
    [3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((eventsPerMacroCycle) =>
      Object.freeze({
        id: `rate-${eventsPerMacroCycle}`,
        eventsPerMacroCycle,
      }),
    ),
  ),
});

/**
 * Physical transport duration for the manual lab scrubber only.
 *
 * Twenty-four seconds is not a musical tick grid or a production tempo. The
 * adapter converts supplied physical time into exact macro position, while
 * event relationships remain eventIndex / eventCount.
 */
export const R4_SHARED_LAB_MACRO_SECONDS = exactTransportSeconds(24n);

/** Return a fresh pure adapter; there is intentionally no shared live runtime. */
export function createR4SharedLabAdapter(): LiveTimelineAdapter {
  return createLiveTimelineAdapter({
    composition: R4_SHARED_LAB_COMPOSITION,
    macroCycleDuration: R4_SHARED_LAB_MACRO_SECONDS,
  });
}
