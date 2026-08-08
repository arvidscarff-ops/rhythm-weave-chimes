# SYS-005 — Performance measurement harness (dev-only prototype)

Measurement tooling only. No optimization, no rendering refactor, nothing player-facing.

## Architecture finding

There is no existing profiling surface. The only dev surface is `/dev/crossing` (SYS-007),
which established the pattern: isolated route, plain diagnostic styling, a pure logic module
plus unit tests, and no coupling to `engineClock`, scheduler, audio, or scenes. SYS-005
follows the same shape. Scene identity is readable without coupling via `getActiveScene()` /
`subscribeActiveScene()` in `src/lib/scenes/activeScene.ts` (a client-side registry, not an
engine touchpoint), so it can be recorded as optional context.

## What gets built

**1. `src/lib/perf/frameStats.ts` — pure statistics, no timers, no DOM**

- `computeFrameStats(samplesMs: number[]): FrameStats`, operating on a copied, sorted array.
- Fields: `sampleCount`, `averageFrameMs`, `medianFrameMs`, `p95FrameMs`, `p99FrameMs`,
  `worstFrameMs`, `averageFps` (1000 / averageFrameMs), `slowFrames16`, `slowFrames33`,
  `slowFrames50` — each slow-frame entry is `{ count, percent }` against explicit thresholds
  16.67 / 33.33 / 50 ms (strictly greater than).
- Explicit empty-array behaviour: zeroed stats, `sampleCount: 0`, never NaN.
- Percentile method documented in the file (nearest-rank on the sorted array) so results are
  reproducible and comparable across runs. No composite "performance score".

**2. `src/lib/perf/frameCollector.ts` — cheap sampling loop**

- `createFrameCollector({ capacity })` owns one `requestAnimationFrame` loop that runs only
  while measuring. Per frame it does one subtraction and one ring-buffer write — no sorting,
  no allocation, no React state update.
- Fixed-size ring buffer (default capacity 36000, about 10 minutes at 60fps) so an indefinite
  session cannot grow unbounded; overflow drops oldest samples and sets a `truncated` flag.
- The first frame after start is discarded (no valid previous timestamp).
- API: `start()`, `stop()`, `reset()`, `getSamples()`, and a low-cadence `onTick` callback
  fired roughly twice per second for live display — the only thing driving React re-renders.
- Time comes from the rAF timestamp argument, not `Date.now()`.

**3. `src/lib/perf/session.ts` — result snapshot assembly**

- `PerfResult` = `label`, `startedAtIso` + `startedAtEpochMs`, `durationMs`, the full
  `FrameStats`, plus an optional `context` block.
- Epoch timestamps are intentional here: this is history/measurement data, not simulation
  timing, and is explicitly not a clock authority.
- Context is best-effort and omits anything unavailable: `route` (current pathname),
  `sceneName` (from `getActiveScene()`, omitted when null), `viewport` (inner width/height),
  `devicePixelRatio`. Nothing is scraped or invented; the active Trigger Engine is included
  only if already exposed on the selected scene row, otherwise omitted.

**4. `src/routes/dev.performance.tsx` — the dev surface at `/dev/performance`**

- `ssr: false`, `robots: noindex`, not linked from the player or the dock.
- Monospace diagnostic readout: STATE (IDLE / MEASURING / COMPLETE), FPS, FRAME, P95, P99,
  SLOW >33 as `count / total`, SESSION as mm:ss. Live values refresh on the collector's
  ~2Hz tick, never per frame.
- Controls: label text input, START MEASUREMENT, STOP, RESET.
- On stop: full result table plus COPY RESULTS (JSON to clipboard) and EXPORT JSON
  (Blob download, `phase-perf-<label>-<timestamp>.json`).
- Deliberately plain — explicitly not PHASE HUD styling.

**5. `src/lib/perf/frameStats.test.ts`**

Covers the empty array, a single sample, a known fixed array with hand-checked
median/p95/p99/worst, slow-frame counts at each threshold boundary (exactly 16.67 not
counted, just above counted), and all-fast / all-slow arrays.

## Profiler overhead

The measured page is whatever is already running; the harness adds one rAF callback doing
constant-time work, a preallocated `Float64Array` ring buffer, and a state update twice per
second. Sorting and all percentile work happen once, at stop.

## Nothing else changes

No edits to `engineClock`, `scheduler`, audio, the crossing runtime, scenes, or the dock.

## Open questions for Codex

- `/dev/performance` renders no scene of its own, so it measures an idle page. Should the
  collector also be attachable to the live player route (overlay or keyboard toggle) so real
  Trigger Engine cost can be measured?
- Is a 10-minute ring buffer the right cap, or should long sessions downsample instead?
- Should results persist locally (a small run history) for A/B comparison, or stay
  export-only as specified?