import { R4_PENDULUM_COMPOSITION } from "./pendulumFamily";
import { ReferenceRuntime } from "./referenceRuntime";

/**
 * One transport/event runtime for the isolated R4.1 preview.
 *
 * The canvas renderer and Web Audio scheduler are sibling consumers of this
 * runtime. Neither the Pendulum geometry nor its component lifecycle creates
 * musical events.
 */
export const r4PendulumRuntime = new ReferenceRuntime(R4_PENDULUM_COMPOSITION, 0.24);
