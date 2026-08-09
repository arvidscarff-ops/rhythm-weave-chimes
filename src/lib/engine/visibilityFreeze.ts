import { engineClock } from "./clock";

export type BackgroundFreezableTransport = Readonly<{
  suspendForBackground(): void;
  resumeFromBackground(): void;
}>;

export type VisibilitySource = Readonly<{
  hidden: boolean;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}>;

/**
 * Keep document lifecycle ownership upstream in the single live transport.
 * The rhythm adapter remains pure and sees only the frozen/preserved position.
 */
export function installVisibilityFreeze(
  source: VisibilitySource,
  transport: BackgroundFreezableTransport,
): () => void {
  const onVisibilityChange = () => {
    if (source.hidden) transport.suspendForBackground();
    else transport.resumeFromBackground();
  };
  source.addEventListener("visibilitychange", onVisibilityChange);
  onVisibilityChange();
  return () => source.removeEventListener("visibilitychange", onVisibilityChange);
}

export function installEngineClockVisibilityFreeze(): () => void {
  if (typeof document === "undefined") return () => undefined;
  return installVisibilityFreeze(document, engineClock);
}
