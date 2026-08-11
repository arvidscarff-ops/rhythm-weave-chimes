# Reset R7 Graphics Laboratory

**Status:** EXPERIMENTAL / COMPARATIVE EVIDENCE ONLY

**Rendering-stack decision:** UNRESOLVED

**Development URL:** `/dev/graphics`

## Purpose

This isolated laboratory preserves two small browser-native atmosphere experiments without selecting a final PHASE renderer or changing the production player.

It compares:

- layered Canvas 2D atmosphere;
- raw WebGL2 procedural atmosphere;
- an explicit renderer boundary;
- adaptive decorative fidelity;
- reduced motion;
- bounded decorative time after hidden-tab gaps;
- measurement through the existing SYS-005 performance system;
- asset-provenance requirements.

It does not define:

- the final renderer;
- a production performance budget;
- a cockpit, canopy, glider silhouette, or hardware frame;
- canonical weather, route, anomaly, or world content;
- musical, note, transport, rhythm, crossing, or gameplay authority.

## Current visual target

Both renderers explore the same Reset target: an unobstructed exterior forward view at extreme altitude, enormous sightlines, a stable distant horizon, cloud geography mainly below the viewer, open upper atmosphere, multiple cloud scales, slow monumental motion, and a cold blue/white baseline. The intended emotional range is awe, serenity, solitude, and slight uncanniness.

The primary laboratory view intentionally contains no cockpit, canopy, wings, nose, dashboard, or other hardware framing.

## Architecture boundary

The laboratory owns one `requestAnimationFrame` loop and one active decorative renderer. Changing renderer, quality, or motion mode disposes the previous renderer and loop before creating the next one.

The laboratory does not import the rhythm authority, create an audio context, schedule notes, or convert rendered geometry into events. Its visual time is decorative only. Frame gaps are capped at 50 milliseconds, so returning from a hidden or suspended tab cannot fast-forward the atmosphere. Reduced motion freezes decorative time while preserving the stable scene.

SYS-005 remains the sole frame-performance measurement system. Open `/dev/graphics?perf=1` to measure the active renderer, then inspect or export the result at `/dev/performance`. The separate R7 `GraphicsFrameMetrics` implementation from the reset branch was intentionally not recovered.

## Prototype modes

### Canvas 2D

- layered cold-sky gradients and atmospheric light;
- blurred procedural cloud bands below the horizon;
- deterministic decorative particulates;
- multiple scales and slow parallax;
- no third-party rendering dependency.

### WebGL2

- one full-screen triangle;
- project-authored value noise and fractal cloud layering;
- procedural sky, sun, cloud field, horizon, vignette, and bounded grain;
- no third-party rendering dependency.

### Reduced motion and fidelity

Reduced motion freezes decorative atmospheric time and lowers decorative work while retaining the view, horizon, controls, and status. Fidelity changes render scale, cloud layers, and particles only. Neither control can affect musical or semantic state.

## Asset pipeline

No external asset, package, font, texture, model, or shader source was added.

`fixtures/r7-graphics-asset-manifest.v1.json` records the project-authored procedural source and the minimum metadata required before a future open-source, CC0, or commercial asset may enter the project.

## Evidence still required before any rendering-stack decision

- owner visual comparison against the PHASE visual checklist;
- representative iOS, Android, integrated-GPU, and low-power hardware;
- production-build and GPU measurements where supported;
- memory, battery, and thermal behavior;
- WebGL context-loss recovery;
- 10-, 30-, and 90-minute sessions;
- background/foreground and device-suspension runs;
- compositing with an authoritative Trigger Engine without sharing timing ownership;
- photosensitivity, reduced-motion, contrast, keyboard, and responsive review;
- any licensed-asset intake and attribution rehearsal.

Canvas 2D and WebGL2 remain comparative evidence. This laboratory makes no final renderer-selection recommendation.
