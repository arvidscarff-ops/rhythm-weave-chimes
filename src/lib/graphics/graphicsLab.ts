export type GraphicsLabBackend = "canvas-2d" | "webgl-2";
export type GraphicsLabQuality = "auto" | "balanced" | "reduced";

export type GraphicsLabBudgetInput = {
  width: number;
  height: number;
  devicePixelRatio: number;
  quality: GraphicsLabQuality;
  reducedMotion: boolean;
};

export type GraphicsLabBudget = {
  renderScale: number;
  cloudLayers: number;
  particleCount: number;
};

/**
 * Decorative fidelity policy only. It never changes musical, route, or other
 * semantic state. SYS-005 remains the sole performance measurement system.
 */
export function resolveGraphicsLabBudget(input: GraphicsLabBudgetInput): GraphicsLabBudget {
  const pixelArea =
    Math.max(1, input.width) *
    Math.max(1, input.height) *
    Math.min(2, Math.max(1, input.devicePixelRatio)) ** 2;
  const constrainedViewport = pixelArea > 3_200_000;
  const reduced = input.reducedMotion || input.quality === "reduced";

  if (reduced) {
    return {
      renderScale: constrainedViewport ? 0.65 : 0.8,
      cloudLayers: 2,
      particleCount: 12,
    };
  }

  if (input.quality === "balanced" || constrainedViewport) {
    return {
      renderScale: constrainedViewport ? 0.7 : 0.85,
      cloudLayers: 4,
      particleCount: 36,
    };
  }

  return {
    renderScale: 1,
    cloudLayers: 6,
    particleCount: 64,
  };
}

/**
 * Local decorative time. Hidden-tab gaps are bounded, and reduced motion
 * freezes it. This value is never an event, transport, or rhythm authority.
 */
export function advanceDecorativeVisualTime(
  currentSeconds: number,
  elapsedFrameMs: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return currentSeconds;
  const boundedFrameMs = Math.min(50, Math.max(0, elapsedFrameMs));
  return currentSeconds + boundedFrameMs / 1000;
}

export type GraphicsAssetSourceType =
  "project-authored" | "cc0" | "open-source" | "commercial-license";

export type GraphicsAssetRecord = {
  id: string;
  sourceType: GraphicsAssetSourceType;
  author: string;
  licenseId: string;
  sourceUrl: string | null;
  attribution: string;
  approvedForDistribution: boolean;
};

export function validateGraphicsAssetRecord(record: GraphicsAssetRecord): string[] {
  const issues: string[] = [];
  if (!record.id.trim()) issues.push("Asset ID is required.");
  if (!record.author.trim()) issues.push("Asset author is required.");
  if (!record.licenseId.trim()) issues.push("A license identifier is required.");
  if (record.sourceType !== "project-authored" && !record.sourceUrl?.trim()) {
    issues.push("Third-party assets require a source URL.");
  }
  if (!record.approvedForDistribution) {
    issues.push("Asset is not approved for distribution.");
  }
  return issues;
}

export function deterministicUnit(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}
