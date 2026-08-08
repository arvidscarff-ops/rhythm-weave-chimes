/**
 * PROTOTYPE-ONLY route data for SYS-007.
 *
 * One origin/destination pair with placeholder labels. Proper-noun naming is
 * unresolved in the lore docs, so nothing here is canon. Shape is data-driven
 * so additional pairs are purely additive.
 */
export type CrossingNode = { id: string; label: string };

export type CrossingRoute = {
  id: string;
  originId: string;
  destinationId: string;
  /** Suggested developer duration, seconds. Not product canon. */
  defaultDurationSeconds: number;
};

export const CROSSING_NODES: Record<string, CrossingNode> = {
  "node-origin": { id: "node-origin", label: "Origin (placeholder)" },
  "node-destination": { id: "node-destination", label: "Destination (placeholder)" },
};

export const FIRST_CROSSING_ROUTE: CrossingRoute = {
  id: "route-first-crossing",
  originId: "node-origin",
  destinationId: "node-destination",
  defaultDurationSeconds: 60,
};

export function nodeLabel(id: string): string {
  return CROSSING_NODES[id]?.label ?? id;
}
