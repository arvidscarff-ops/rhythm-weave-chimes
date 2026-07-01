# Fix: Preview showing stale Scales UI

## Diagnosis
- Source `src/routes/studio.scales.tsx` already renders the new `HandpanField` (circular tone slots + pitch dropdowns + polyphonic playback). No old intervals/pool-size code paths remain.
- The screenshot shows the pre-refactor UI. That means the preview iframe is running a cached JS bundle from before the last edit — HMR didn't swap the route module (common when route files change and the Router graph doesn't fully accept the update).

## Action
1. Restart the Vite dev server to force a clean rebuild of the route tree and hot module graph.
2. Hard-refresh the preview (`Ctrl/Cmd+Shift+R`) so the browser drops the cached chunk.
3. Navigate to `/studio/scales` and confirm the Handpan tone field renders with the center "ding" + surrounding note discs.

No code changes required.

## If it still shows the old UI after restart
Fallback investigation:
- Check the browser console for a route-module load error that would cause TanStack Router to fall back to a stale match.
- Confirm the deployed `routeTree.gen.ts` (already verified) still points at `./routes/studio.scales`.
- If the preview lockout persists, add a trivial cache-buster (e.g. a version comment in `studio.scales.tsx`) to force HMR to re-evaluate the module.
