/**
 * Canvas → WebM recorder (debug tool).
 *
 * Records the given canvas element for `seconds` seconds using the
 * browser-native MediaRecorder + `canvas.captureStream()` pipeline.
 * Silent (no audio track); intended for capturing short visual
 * references of trigger engines to share with other tools.
 */

export type RecordOptions = {
  seconds: number;
  fps: number;
  /** Called every 1s while recording, with remaining whole seconds. */
  onTick?: (secondsLeft: number) => void;
};

const CODEC_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mt of CODEC_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(mt)) return mt;
    } catch {
      // ignore
    }
  }
  return null;
}

export function isRecordingSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    pickMimeType() !== null
  );
}

export async function recordSceneCanvas(
  canvas: HTMLCanvasElement,
  opts: RecordOptions,
): Promise<Blob> {
  const mimeType = pickMimeType();
  if (!mimeType) {
    throw new Error("MediaRecorder / WebM not supported in this browser.");
  }
  const stream = canvas.captureStream(opts.fps);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = (e) => reject((e as ErrorEvent).error ?? new Error("Recorder error"));
  });

  recorder.start(250);

  // Countdown ticker.
  const started = performance.now();
  const totalMs = opts.seconds * 1000;
  let lastReported = Math.ceil(opts.seconds);
  opts.onTick?.(lastReported);
  const tickHandle = window.setInterval(() => {
    const elapsed = performance.now() - started;
    const left = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
    if (left !== lastReported) {
      lastReported = left;
      opts.onTick?.(left);
    }
  }, 200);

  window.setTimeout(() => {
    window.clearInterval(tickHandle);
    try {
      recorder.stop();
    } catch {
      // ignore
    }
    // Stop the tracks so the browser drops the capture.
    for (const track of stream.getTracks()) track.stop();
  }, totalMs);

  return done;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}