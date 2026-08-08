/**
 * SYS-005 mount point for the dev-only in-player probe.
 *
 * Kept in its own module because TanStack route splitting drops module-scope
 * runtime siblings from the player's split component chunk — the lazy() handle
 * and flag check must live in an imported module, not in the route file.
 *
 * Renders nothing (and never loads the probe chunk) unless the page was opened
 * with ?perf=1.
 */
import { Suspense, lazy, useEffect, useState } from "react";
import { PERF_MODE_AT_LOAD } from "@/lib/perf/perfFlag";

const PerformanceProbe = lazy(() => import("./PerformanceProbe"));

export function PerfProbeMount() {
  // Applied via effect so SSR and first client render stay identical.
  const [enabled, setEnabled] = useState(false);
  useEffect(() => setEnabled(PERF_MODE_AT_LOAD), []);

  if (!enabled) return null;
  return (
    <Suspense fallback={null}>
      <PerformanceProbe />
    </Suspense>
  );
}