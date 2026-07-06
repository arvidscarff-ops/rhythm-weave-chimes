import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listPublishedScenes,
  signedSceneAssetUrl,
  type SceneRow,
} from "@/lib/admin/scenes.functions";
import {
  getActiveScene,
  loadPersistedSceneId,
  setActiveScene,
  subscribeActiveScene,
} from "@/lib/scenes/activeScene";
import { onDispatch } from "@/lib/engine/triggerBus";

/**
 * Full-viewport background layer that renders the admin-selected published
 * scene: image or video media + palette CSS vars + audio-reactive pulse.
 *
 * Mounts below the app content. Palette CSS variables are set on <html>
 * so downstream engines that read them (--node-glow, --wire-color)
 * receive the theme without any prop drilling.
 */
export function SceneBackground() {
  const listFn = useServerFn(listPublishedScenes);
  const signFn = useServerFn(signedSceneAssetUrl);
  const { data: scenes } = useQuery({
    queryKey: ["published-scenes"],
    queryFn: () => listFn(),
    staleTime: 60_000,
  });

  const [active, setActive] = useState<SceneRow | null>(null);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const intensityRef = useRef(0);

  useEffect(() => {
    if (!scenes) return;
    const persistedId = loadPersistedSceneId();
    const found = persistedId ? (scenes.find((s) => s.id === persistedId) ?? null) : null;
    if (found) setActiveScene(found);
    setActive(getActiveScene());
    return subscribeActiveScene((s) => setActive(s));
  }, [scenes]);

  useEffect(() => {
    let cancelled = false;
    if (!active?.background_path) {
      setBgUrl(null);
      return;
    }
    signFn({ data: { path: active.background_path } })
      .then(({ url }) => {
        if (!cancelled) setBgUrl(url);
      })
      .catch(() => {
        if (!cancelled) setBgUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [active?.background_path, signFn]);

  useEffect(() => {
    const root = document.documentElement;
    if (!active) {
      root.style.removeProperty("--node-glow");
      root.style.removeProperty("--wire-color");
      root.style.removeProperty("--dock-accent");
      root.style.removeProperty("--text-accent");
      return;
    }
    const t = active.ui_theme_colors;
    root.style.setProperty("--node-glow", t.nodeGlow);
    root.style.setProperty("--wire-color", t.wireframe);
    root.style.setProperty("--dock-accent", t.dockAccent);
    root.style.setProperty("--text-accent", t.textAccent);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const r = active.audio_reactive;
    const fx = active.visual_fx;
    const unsub = onDispatch((ev) => {
      if (ev.velocity < r.threshold) return;
      intensityRef.current = Math.min(1, intensityRef.current + ev.velocity);
    });
    let raf = 0;
    const tick = () => {
      intensityRef.current *= 0.9;
      const el = wrapRef.current;
      if (el) {
        const i = intensityRef.current * r.amplitude;
        el.style.setProperty("--scene-scale", r.scalePulse ? String(1 + i * 0.06) : "1");
        el.style.setProperty(
          "--scene-opacity",
          r.opacityPulse
            ? String(0.4 + fx.backgroundGlow * 0.6 + i * 0.3)
            : String(0.4 + fx.backgroundGlow * 0.6),
        );
        el.style.setProperty(
          "--scene-blur",
          `${fx.backgroundBlur + (r.blurPulse ? i * 10 : 0)}px`,
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      unsub();
      cancelAnimationFrame(raf);
    };
  }, [active]);

  if (!active || !bgUrl) return null;

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 0, transition: "opacity 600ms ease" }}
    >
      {active.background_type === "video" ? (
        <video
          src={bgUrl}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            transform: "scale(var(--scene-scale, 1))",
            opacity: "var(--scene-opacity, 1)",
            filter: "blur(var(--scene-blur, 0px))",
            transition: "transform 80ms linear, opacity 80ms linear",
          }}
        />
      ) : (
        <img
          src={bgUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            transform: "scale(var(--scene-scale, 1))",
            opacity: "var(--scene-opacity, 1)",
            filter: "blur(var(--scene-blur, 0px))",
            transition: "transform 80ms linear, opacity 80ms linear",
          }}
        />
      )}
    </div>
  );
}