export type FirstCrossingVisibilitySource = Readonly<{
  hidden: boolean;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}>;

export type FirstCrossingVisibilityControls = Readonly<{
  suspendForBackground(): unknown;
  resumeFromBackground(): unknown;
}>;

/**
 * Thin browser-lifecycle adapter for SYS-008.
 *
 * Browser globals and listeners stay outside the pure session model. This
 * intentionally mirrors the approved engineClock visibility semantics while
 * keeping journey time and musical time as separate authorities.
 */
export function installFirstCrossingVisibility(
  source: FirstCrossingVisibilitySource,
  session: FirstCrossingVisibilityControls,
): () => void {
  const onVisibilityChange = () => {
    if (source.hidden) session.suspendForBackground();
    else session.resumeFromBackground();
  };

  source.addEventListener("visibilitychange", onVisibilityChange);
  onVisibilityChange();

  return () => source.removeEventListener("visibilitychange", onVisibilityChange);
}

export function installDocumentFirstCrossingVisibility(
  session: FirstCrossingVisibilityControls,
): () => void {
  if (typeof document === "undefined") return () => undefined;
  return installFirstCrossingVisibility(document, session);
}
