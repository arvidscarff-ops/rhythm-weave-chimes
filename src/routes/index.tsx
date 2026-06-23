import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Phase — Generative Polyrhythm Engine" },
      { name: "description", content: "A tactile, browser-native generative ambient instrument built on three phasing polyrhythmic lanes." },
      { property: "og:title", content: "Phase — Generative Polyrhythm Engine" },
      { property: "og:description", content: "A tactile, browser-native generative ambient instrument built on three phasing polyrhythmic lanes." },
    ],
  }),
  component: Index,
});

type LaneConfig = {
  id: "A" | "B" | "C";
  freq: number; // base note
  colorVar: string;
  glowVar: string;
  label: string;
};

const LANES: LaneConfig[] = [
  { id: "A", freq: 261.63, colorVar: "var(--pr-lane-a)", glowVar: "var(--pr-glow-a)", label: "Node A · C4" },
  { id: "B", freq: 392.0,  colorVar: "var(--pr-lane-b)", glowVar: "var(--pr-glow-b)", label: "Node B · G4" },
  { id: "C", freq: 523.25, colorVar: "var(--pr-lane-c)", glowVar: "var(--pr-glow-c)", label: "Node C · C5" },
];

function Index() {
  const [playing, setPlaying] = useState(false);
  const [durations, setDurations] = useState<[number, number, number]>([4, 5, 6]);

  // refs that the animation/audio loop reads without re-subscribing
  const durationsRef = useRef(durations);
  durationsRef.current = durations;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  // visual progress 0..1 per lane
  const progressRef = useRef<[number, number, number]>([0, 0, 0]);
  const flashRef = useRef<[number, number, number]>([0, 0, 0]);
  const [, force] = useState(0);

  // audio graph
  const audioRef = useRef<{
    ctx: AudioContext;
    master: GainNode;
    filter: BiquadFilterNode;
    delay: DelayNode;
    feedback: GainNode;
    wet: GainNode;
  } | null>(null);

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0.5;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2200;
    filter.Q.value = 0.4;

    const delay = ctx.createDelay(5.0);
    delay.delayTime.value = 0.55;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.55;
    const wet = ctx.createGain();
    wet.gain.value = 0.45;

    filter.connect(master);
    filter.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(master);
    master.connect(ctx.destination);

    audioRef.current = { ctx, master, filter, delay, feedback, wet };
    return audioRef.current;
  }, []);

  const trigger = useCallback((freq: number) => {
    const a = audioRef.current;
    if (!a) return;
    const { ctx, filter } = a;
    const now = ctx.currentTime;
    // Two detuned sines + a soft fifth for a warm chime
    const partials = [
      { f: freq, g: 0.35 },
      { f: freq * 2.01, g: 0.12 },
      { f: freq * 3.0, g: 0.05 },
    ];
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(1, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
    env.connect(filter);
    partials.forEach((p) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = p.f;
      const g = ctx.createGain();
      g.gain.value = p.g;
      osc.connect(g);
      g.connect(env);
      osc.start(now);
      osc.stop(now + 3.3);
    });
  }, []);

  // main loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      if (playingRef.current) {
        const p = progressRef.current;
        const d = durationsRef.current;
        for (let i = 0; i < 3; i++) {
          p[i] += dt / d[i];
          if (p[i] >= 1) {
            p[i] -= 1;
            flashRef.current[i] = 1;
            trigger(LANES[i].freq);
          }
        }
      }
      // decay flashes always
      for (let i = 0; i < 3; i++) {
        flashRef.current[i] = Math.max(0, flashRef.current[i] - dt * 2.2);
      }
      force((x) => (x + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [trigger]);

  const togglePlay = async () => {
    const a = ensureAudio();
    if (a.ctx.state === "suspended") await a.ctx.resume();
    setPlaying((p) => !p);
  };

  return (
    <div className="min-h-screen w-full" style={{ background: "var(--pr-bg)", color: "var(--pr-text)" }}>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="flex items-end justify-between mb-10">
          <div>
            <div className="text-[11px] tracking-[0.35em] uppercase" style={{ color: "var(--pr-muted)" }}>
              Generative · Polyrhythm · Engine
            </div>
            <h1 className="text-4xl font-light tracking-tight mt-2">Phase</h1>
          </div>
          <button
            onClick={togglePlay}
            className="group relative h-14 px-7 rounded-full font-medium tracking-wide text-sm transition-all"
            style={{
              background: playing ? "var(--pr-accent)" : "var(--pr-panel-2)",
              color: playing ? "var(--pr-bg)" : "var(--pr-text)",
              boxShadow: playing ? "0 0 30px oklch(0.85 0.15 90 / 0.45)" : "inset 0 0 0 1px var(--pr-line)",
            }}
          >
            {playing ? "■  PAUSE" : "▶  PLAY"}
          </button>
        </header>

        <section
          className="rounded-2xl p-6"
          style={{ background: "var(--pr-panel)", boxShadow: "inset 0 0 0 1px var(--pr-line)" }}
        >
          <div className="space-y-5">
            {LANES.map((lane, i) => (
              <Lane
                key={lane.id}
                lane={lane}
                duration={durations[i]}
                progress={progressRef.current[i]}
                flash={flashRef.current[i]}
              />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {LANES.map((lane, i) => (
            <div
              key={lane.id}
              className="rounded-xl p-5"
              style={{ background: "var(--pr-panel)", boxShadow: "inset 0 0 0 1px var(--pr-line)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: lane.colorVar, boxShadow: lane.glowVar }}
                  />
                  <span className="text-xs tracking-[0.25em] uppercase" style={{ color: "var(--pr-muted)" }}>
                    Lane {lane.id}
                  </span>
                </div>
                <span className="text-sm tabular-nums" style={{ color: "var(--pr-text)" }}>
                  {durations[i].toFixed(2)}s
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={20}
                step={0.05}
                value={durations[i]}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setDurations((d) => {
                    const n = [...d] as [number, number, number];
                    n[i] = v;
                    return n;
                  });
                }}
                className="pr-slider mt-4 w-full"
                style={{ accentColor: "oklch(0.85 0.15 90)" }}
              />
            </div>
          ))}
        </section>

        <footer className="mt-10 text-[11px] tracking-[0.3em] uppercase text-center" style={{ color: "var(--pr-muted)" }}>
          Three lanes · phasing in irrational time · listen for the re-alignment
        </footer>
      </div>
    </div>
  );
}

function Lane({
  lane,
  duration,
  progress,
  flash,
}: {
  lane: LaneConfig;
  duration: number;
  progress: number;
  flash: number;
}) {
  // Tick marks every 1s
  const ticks: number[] = [];
  for (let s = 1; s < duration; s++) ticks.push(s / duration);

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full transition-all"
            style={{
              background: lane.colorVar,
              boxShadow: flash > 0.02 ? lane.glowVar : "none",
              opacity: 0.6 + flash * 0.4,
            }}
          />
          <span className="text-xs tracking-[0.25em] uppercase" style={{ color: "var(--pr-muted)" }}>
            {lane.label}
          </span>
        </div>
        <span className="text-[10px] tabular-nums tracking-widest" style={{ color: "var(--pr-muted)" }}>
          {(progress * duration).toFixed(2)} / {duration.toFixed(2)}s
        </span>
      </div>
      <div
        className="relative h-16 rounded-lg overflow-hidden"
        style={{
          background: "var(--pr-panel-2)",
          boxShadow: `inset 0 0 0 1px var(--pr-line)${flash > 0.02 ? `, ${lane.glowVar}` : ""}`,
          transition: "box-shadow 60ms linear",
        }}
      >
        {/* flash overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: lane.colorVar,
            opacity: flash * 0.18,
            transition: "opacity 60ms linear",
          }}
        />
        {/* ticks */}
        {ticks.map((t, idx) => (
          <div
            key={idx}
            className="absolute top-0 bottom-0"
            style={{ left: `${t * 100}%`, width: 1, background: "var(--pr-line)" }}
          />
        ))}
        {/* trail */}
        <div
          className="absolute top-0 bottom-0 left-0"
          style={{
            width: `${progress * 100}%`,
            background: `linear-gradient(90deg, transparent, color-mix(in oklab, ${lane.colorVar} 18%, transparent))`,
          }}
        />
        {/* playhead */}
        <div
          className="absolute top-0 bottom-0"
          style={{
            left: `${progress * 100}%`,
            width: 2,
            background: lane.colorVar,
            boxShadow: lane.glowVar,
            transform: "translateX(-1px)",
          }}
        />
      </div>
    </div>
  );
}
