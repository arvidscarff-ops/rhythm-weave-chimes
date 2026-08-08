/**
 * SYS-005 dev-only flag capture.
 *
 * Read at module evaluation, before the router normalises the URL (unknown
 * search params are stripped) and before the player writes its session hash.
 * Imported from src/router.tsx purely so this evaluates as early as possible.
 * Costs one URL parse on load and nothing else when the flag is absent.
 */
function detect(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("perf") === "1") return true;
    return window.location.hash.includes("perf=1");
  } catch {
    return false;
  }
}

export const PERF_MODE_AT_LOAD = detect();