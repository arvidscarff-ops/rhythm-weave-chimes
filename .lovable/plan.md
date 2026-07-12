## Export Test Video button

Add a one-click recorder that captures 10s of the live scene canvas and downloads it, so you can hand the file to another LLM as visual context.

### Approach
- Use the browser-native `HTMLCanvasElement.captureStream(fps)` + `MediaRecorder` — no libraries, no server round-trip.
- Record the existing scene canvas directly (whatever's already animating in the preview). No re-render pass, no separate offscreen composition — what you see is what gets exported.
- Output: `.webm` (VP9 if supported, else VP8). WebM is what MediaRecorder produces natively; every modern LLM that accepts video handles it. No ffmpeg / mp4 transcode step (would need a WASM lib or server function — not worth it for a debug tool).
- No audio track. This is a visual reference clip; keeping it silent avoids AudioContext/MediaStream plumbing and keeps the file small.

### UX
- Button lives in the `PhaseDock` alongside the existing controls, labeled "Export test video" (icon: `Video` from lucide).
- Click → button switches to a recording state showing a countdown (`Recording… 9s`), disabled during capture.
- On finish, auto-downloads `phase-<sceneId>-<timestamp>.webm`.
- Recording length: fixed 10s at 30fps.
- If the browser doesn't support the codec / MediaRecorder, toast an error and no-op.

### Implementation sketch
1. New helper `src/lib/dev/recordScene.ts`:
   - `recordSceneCanvas(canvas, { seconds, fps, onTick }) → Promise<Blob>` using `canvas.captureStream(fps)` + `MediaRecorder` with progressive codec fallback (`video/webm;codecs=vp9` → `vp8` → `video/webm`).
   - Small `downloadBlob(blob, filename)` util.
2. `PhaseDock.tsx`:
   - Add an "Export test video" button. On click, look up the scene canvas via a stable selector (e.g. `document.querySelector('canvas[data-scene-canvas]')` — I'll tag the canvas in `SceneBackground.tsx` with that attribute).
   - Local `useState` for `isRecording` + `secondsLeft`; a 1s interval drives the countdown UI while the recorder runs.
3. `SceneBackground.tsx`: add `data-scene-canvas` to the rendered `<canvas>` so the recorder can find it without prop drilling.

### Not touching
- Rhythm/audio engine, scene code, scheduler, macro-cycle — the recording just observes the canvas.
- Session URL, presets, admin routes.

### Quick assumptions worth confirming
- **Placement**: PhaseDock is fine, or would you rather have it in a debug-only spot (admin panel / hidden behind a keyboard shortcut) so it doesn't clutter the main UI?
- **Format**: `.webm` (native, no transcode). Say the word if you specifically need `.mp4` and I'll add a WASM ffmpeg transcode step (heavier, ~30MB dep).
- **Audio**: silent. Say if you want the ambient audio mixed in — I'll wire the WebAudio destination into the MediaRecorder stream.

I'll assume dock placement, webm, silent unless you say otherwise.
