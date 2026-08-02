# PHASE Audio & Rhythm Architecture

**Document role:** Musical and technical architecture  
**Run:** 3 of the PHASE Project Bible documentation plan  
**Authority:** Governing target behavior for rhythm, timing, Trigger Engines, and audiovisual synchronization  
**Evidence boundary:** Defines known invariants and safe contracts; it does not claim that the current repository already implements them  
**Last updated:** 2026-08-02

---

## 1. Purpose

This document protects the musical heart of PHASE.

PHASE depends on a stronger promise than “audio and animation happen at roughly the same time.” Its sound, geometry, route progression, visual motion, and eventual environmental influences must behave as expressions of a shared temporal system.

The central architectural rule is:

> **Musical time is authoritative. All audiovisual consumers derive their state from it.**

This rule exists for both technical and creative reasons:

- synchronization must remain exact across long sessions;
- Trigger Engines must agree about where they are in a cycle;
- visual frame rate must not redefine musical behavior;
- collisions and animation callbacks must not decide when notes occur;
- pause, resume, background throttling, and dropped frames must not create permanent drift;
- polyrhythmic voices must close deterministically;
- Phase Zero must remain an exact, testable boundary;
- weather and transit systems must not create competing clocks;
- a rendered frame must be reconstructable from authoritative state rather than from accumulated visual approximation.

---

## 2. Status language

| Label | Meaning in this document |
|---|---|
| **INVARIANT** | Locked architectural behavior. A change requires an explicit recorded decision. |
| **REQUIRED CONTRACT** | Target interface/behavior implied by the invariants; exact code shape may vary. |
| **PLANNED** | Intended capability whose final mapping is not decided. |
| **UNRESOLVED** | Insufficient canon or code evidence to prescribe one implementation. |
| **PROHIBITED** | Known failure mode that violates the architecture. |
| **RECOMMENDED** | Safe engineering guidance, not canon by itself. |

---

## 3. Normative vocabulary

### Rhythm authority

The single logical owner of authoritative musical position.

It may internally use one or more platform clocks, schedulers, workers, or audio APIs, but the application must expose one coherent musical truth.

### Transport

The control and state layer governing start, stop, pause, resume, seek/reconstruction, and the current authoritative musical position.

“Transport” here is musical terminology. It is distinct from an in-world glider transit.

### Voice

One repeating rhythmic/musical stream within a Trigger Engine or composition.

A voice may have its own subdivision count, rhythmic ratio, sound assignment, geometry, phase offset, gain, timbre, or other parameters. It does not own an independent wall-clock timeline.

### Cycle

One complete traversal of a defined repeating rhythmic unit.

### Macro-cycle

The complete shared period after which all participating repeating voices return to their starting relationship.

The macro-cycle is usually derived from the participating rhythmic periods or subdivision relationships. The precise mathematical representation must be explicit in implementation.

### Phase

Normalized position within a cycle.

Unless a more specific type states otherwise:

```text
0.0 <= phase < 1.0
```

### Normalized progress

A unitless representation of position in a known interval. For rhythmic phases, it is normally a wrapped value in `[0, 1)`. For finite route/transit progress, it may be clamped in `[0, 1]`.

### Phase Zero

The exact boundary at which a cycle begins and participating phases realign according to their defined relationship.

For a macro-cycle, Phase Zero is the canonical closure point shared by all participating voices.

### Trigger Engine

A parameterized audiovisual component that expresses rhythm through sound and geometry.

A Trigger Engine consumes authoritative rhythmic state. It does not own time.

### Geometry

The visual/spatial representation of rhythmic relationships: positions, paths, nodes, rotations, intersections, pulses, illumination, trails, or other forms.

Geometry may reveal when a musical event occurs. It must not authoritatively cause that event.

### Note event

A deterministic musical event derived from rhythmic state and voice rules.

### Route progress

Normalized progress through an in-world transit. Route progress and musical phase may be related, but they are not automatically the same value.

---

## 4. Architectural invariants

### I-001 — One rhythm authority

**INVARIANT**

There is one logical authoritative source of musical time.

No Trigger Engine, voice, visual component, particle system, route card, animation loop, or weather effect may maintain a second musical truth.

Multiple technical clocks may exist only behind an explicit synchronization boundary. They must not be exposed as equal authorities.

### I-002 — Normalized phase

**INVARIANT**

Consumers receive normalized rhythmic progress rather than inferring it from visual position, elapsed animation frames, or collision state.

Canonical wrapped phase:

```text
phase = wrap01((musicalPosition - cycleOrigin) / cycleDuration)
```

Equivalent integer/tick-based formulations are acceptable and often preferable. The required property is semantic equivalence, not this exact floating-point expression.

### I-003 — Deterministic macro-cycle closure

**INVARIANT**

The relationship among all voices must close exactly at the macro-cycle boundary.

Given the same:

- composition definition;
- seed, if randomness is used;
- starting state;
- authoritative musical position;

the system must derive the same:

- voice phases;
- event indices;
- note-event decisions;
- Phase Zero boundary;
- geometry state, within the renderer’s documented numerical tolerance.

### I-004 — Exact Phase Zero

**INVARIANT**

Phase Zero is a semantic boundary, not “the frame where a value happens to look almost like zero.”

The engine must be able to identify the boundary deterministically and expose it without relying on:

- equality comparisons against accumulated floating-point animation state;
- a collision occurring at the correct instant;
- a render frame landing exactly on the boundary;
- component mount timing;
- independent timers coincidentally aligning.

### I-005 — Trigger Engines consume time

**INVARIANT**

Trigger Engines receive authoritative state or query it through a defined read interface.

They do not:

- start their own authoritative intervals;
- derive note times from requestAnimationFrame counts;
- resynchronize themselves independently;
- decide the global tempo;
- accumulate their own musical elapsed time;
- alter shared timing because their geometry changed.

### I-006 — Geometry expresses rhythm

**INVARIANT**

Visual geometry is a projection of musical structure.

The mapping may be complex, nonlinear, artistic, or parameterized, but must run in this direction:

```text
authoritative musical state
            ↓
voice phase / event state
            ↓
geometry
```

Not:

```text
geometry or collision
            ↓
note timing
```

### I-007 — No collision-derived authoritative notes

**PROHIBITED**

Physics-engine collisions, DOM intersection checks, bounding-box overlap, canvas hit testing, or rendered-object contact must not be the authoritative source of note events.

These mechanisms are:

- frame-rate dependent;
- vulnerable to missed intersections;
- sensitive to geometry changes;
- difficult to reconstruct after pause/seek;
- nondeterministic across devices;
- liable to double-fire;
- logically backward for PHASE.

A collision may provide visual feedback for an event already determined by musical state. It cannot decide whether or when the event exists.

### I-008 — Shared state for audio and visuals

**INVARIANT**

Audio and visuals must derive from the same musical event model and authoritative position.

This does not require them to be scheduled through the same API. Audio may need lookahead scheduling; visuals may render current/interpolated state. Their displayed/heard outcomes must refer to the same event indices and timestamps.

### I-009 — Frame rate is not tempo

**INVARIANT**

Rendering frequency may change visual smoothness. It must not change:

- tempo;
- phase;
- event count;
- note ordering;
- macro-cycle duration;
- closure behavior.

### I-010 — Configuration changes are explicit

**REQUIRED CONTRACT**

Changes to voice count, ratios, subdivision, scale, tuning, duration, seed, or other composition-defining inputs must occur through an explicit transition policy.

The system must not silently mutate the meaning of the current phase midway through a cycle without defining whether the change:

- takes effect immediately;
- quantizes to the next event;
- quantizes to the next cycle;
- quantizes to the next Phase Zero;
- creates a crossfade between composition states;
- starts a new composition identity.

### I-011 — Long-duration stability

**INVARIANT**

The system must remain musically coherent across the long sessions central to PHASE.

It must not rely on continuously accumulating low-precision deltas where error grows with every frame.

### I-012 — Reconstructability

**REQUIRED CONTRACT**

At any authoritative musical position, the system should be able to derive the correct current phase and relevant event state without replaying every rendered frame since the beginning.

This supports:

- pause and resume;
- background throttling recovery;
- visual remounts;
- route restoration;
- testing;
- deterministic debugging;
- eventual save/resume policies.

---

## 5. Logical architecture

The implementation language and framework may vary, but responsibility should remain separated.

```text
Composition Definition
  - voices
  - ratios/subdivisions
  - macro-cycle rules
  - scale/tuning reference
  - sound assignments
  - geometry mappings
  - seed/version
              │
              ▼
      Rhythm Authority / Transport
  - authoritative position
  - play state
  - tempo or duration mapping
  - event indices
  - Phase Zero
              │
      ┌───────┼────────┐
      ▼       ▼        ▼
 Event Model  Audio    Visual Snapshot
 /Scheduler   Output   /Interpolation
      │                  │
      ▼                  ▼
 note events       Trigger Engines
                   environment/UI
```

### 5.1 Composition definition

**REQUIRED CONTRACT**

A composition definition should contain enough immutable or versioned data to reproduce its musical structure.

Conceptually:

```ts
type CompositionDefinition = {
  id: string
  version: number
  seed?: string
  macroCycle: MacroCycleDefinition
  voices: VoiceDefinition[]
  tuning: TuningReference
  scale: ScaleDefinition
  geometryMappingVersion: number
}
```

This is an illustrative contract, not a required source-language interface.

The important qualities are:

- explicit versioning;
- stable identity;
- serializable parameters where feasible;
- separation between definition and runtime state;
- no hidden timing rules inside visual components.

### 5.2 Rhythm authority

The rhythm authority owns:

- play/pause state;
- canonical musical origin;
- authoritative current position;
- macro-cycle position;
- boundary/event computation;
- configuration-transition scheduling;
- the mapping from real elapsed time to musical position;
- correction/reconstruction after suspension.

It does not need to own:

- visual shapes;
- component-specific materials;
- UI layout;
- particle simulation;
- lore;
- the exact audio synthesis graph.

### 5.3 Event model

The event model derives discrete musical events from continuous or integer musical position.

For each voice it should answer, at minimum:

- current phase;
- current event index;
- whether a new event boundary was crossed since the last processed position;
- authoritative timestamp of each event;
- whether the macro-cycle wrapped;
- whether Phase Zero occurred.

### 5.4 Audio scheduler

Audio normally requires scheduling slightly ahead of playback to avoid main-thread jitter.

The scheduler may maintain a lookahead queue, but it remains subordinate to the rhythm authority. It schedules authoritative events; it does not invent them.

### 5.5 Visual snapshot

The visual layer receives or derives:

- current authoritative position;
- current macro phase;
- per-voice normalized phases;
- discrete event state;
- composition parameters;
- optional interpolation metadata;
- environmental modulation values that have already passed through the composition contract.

It renders the best available representation for the current frame.

If a frame is dropped, the next frame computes the correct new state rather than replaying the missed visual trajectory as musical truth.

---

## 6. Time domains

PHASE will eventually contain several legitimate forms of time. They must be named and related deliberately.

| Time domain | Meaning | Authority |
|---|---|---|
| **Wall-clock time** | Real-world UTC/local time used for persistent world simulation and forecasts | Server/world system |
| **Monotonic runtime time** | Non-decreasing elapsed time used for local scheduling | Platform runtime |
| **Audio clock time** | High-resolution playback/scheduling time | Audio subsystem, synchronized to rhythm authority |
| **Musical position** | Canonical position in the composition | Rhythm authority |
| **Macro-cycle phase** | Normalized position in the shared closure period | Derived from musical position |
| **Voice phase** | Normalized position for one voice | Derived from musical position and voice definition |
| **Transit elapsed time** | Elapsed duration of the in-world crossing | Transit system |
| **Route progress** | Normalized completed portion of the crossing | Transit system, possibly derived from authoritative transit timing |
| **Render time** | Timestamp of the current visual frame | Renderer only |

### 6.1 These domains must not be conflated

Examples of unsafe conflation:

- using route progress directly as voice phase without a declared mapping;
- using a render timestamp as the audio event source;
- treating server weather-update time as musical time;
- using audio-context start time as persistent world time;
- assuming a paused musical composition pauses the global weather system;
- assuming macro-cycle closure must equal route arrival.

Relationships among domains are allowed and central to PHASE. They must be explicit transformations.

---

## 7. Normalized progress contract

### 7.1 Wrapped versus finite progress

Two related types must remain distinct.

**Wrapped rhythmic phase:**

```text
0.0 <= phase < 1.0
```

At closure, it wraps to `0.0`.

**Finite route progress:**

```text
0.0 <= progress <= 1.0
```

At arrival, it may equal `1.0`.

Using the same untyped numeric field for both invites boundary bugs.

### 7.2 Semantic types

**RECOMMENDED**

Use distinct types or clearly named structures:

```ts
type WrappedPhase = number
type FiniteProgress = number
type MusicalPosition = bigint | number
type EventIndex = bigint | number
```

Runtime validation should enforce domains where practical.

### 7.3 Boundary behavior

The implementation must specify:

- whether phase is `[0,1)` or `(0,1]`;
- how exact `1.0` inputs are normalized;
- behavior for negative positions;
- behavior after seek;
- rounding policy;
- comparison tolerance for display only;
- integer event-index derivation;
- behavior at configuration transitions.

The canonical recommendation is `[0,1)` for repeating phase and `[0,1]` for finite progress.

### 7.4 Avoid accumulated phase

**PROHIBITED**

Do not make the canonical phase:

```text
phase += frameDelta / duration
```

for the lifetime of a long session.

Instead, derive phase from an authoritative origin and current position, or use integer ticks/sample frames where appropriate.

---

## 8. Polyrhythm and voice architecture

### 8.1 One authority, many rates

Polyrhythm does not require multiple clocks.

Each voice is a deterministic mapping from shared musical position to:

- its cycle count;
- normalized phase;
- event index;
- event boundary;
- sound and geometry state.

### 8.2 Ratios and subdivisions

The exact current voice model is not recoverable from the conversation alone. A safe conceptual representation is:

```ts
type VoiceDefinition = {
  id: string
  subdivisions: number
  phaseOffset?: number
  pattern?: PatternDefinition
  sound: SoundDefinition
  geometry: GeometryDefinition
}
```

Alternative ratio-, period-, tick-, or rational-number models are valid if they preserve exact closure.

### 8.3 Macro-cycle derivation

For integer subdivision counts within one shared base cycle, all voices naturally close at the base-cycle boundary.

For voices with independent rational periods, the macro-cycle is their least common repeating period.

**REQUIRED CONTRACT**

The implementation must document which model PHASE uses. It must not mix models implicitly.

### 8.4 Rational relationships

**RECOMMENDED**

Represent canonical rhythmic relationships with integers or rational values for as long as possible.

Floating-point values may be used for rendering and audio API timestamps, but should not be the only record of:

- subdivision;
- event index;
- phase relationship;
- macro-cycle length;
- closure.

### 8.5 Voice independence

A voice may vary in:

- pattern;
- timbre;
- spatial position;
- geometry;
- density;
- accent;
- silence/rest behavior;
- octave/register;
- phase offset.

It may not independently redefine the shared transport.

---

## 9. Phase Zero

### 9.1 Definition

Phase Zero is the exact origin and closure boundary of a defined cycle.

At macro Phase Zero:

- the macro-cycle index advances;
- macro phase becomes zero;
- all voices occupy their defined origin relationship;
- deterministic systems may commit quantized configuration changes;
- tests can assert closure;
- visual and audio consumers can realign from the same boundary.

Phase Zero does not require every voice to emit a note. Silence at the boundary may be part of a pattern.

### 9.2 Detection

Preferred detection is based on integer or rational boundary crossing:

```text
previousMacroIndex != currentMacroIndex
```

or an equivalent scheduler event.

Avoid:

```text
if (phase === 0)
```

on values derived from accumulated floating-point animation state.

### 9.3 Event delivery

If a frame or callback spans multiple event boundaries, the system must decide whether to:

- deliver every missed event to the audio scheduler if still schedulable;
- suppress events already in the past;
- reconstruct only current visual state;
- emit a summarized wrap/realignment notification.

This policy must be deterministic and tested. Visual consumers should generally reconstruct current state rather than animate all missed frames.

### 9.4 Quantized changes

Phase Zero is the safest default boundary for changes that alter global rhythmic meaning:

- voice-set replacement;
- ratio/subdivision changes;
- macro-cycle changes;
- composition seed changes;
- scale/tuning changes requiring a new musical state;
- major environment-to-composition remapping.

Not every parameter change must wait for Phase Zero. The policy should be explicit by parameter class.

---

## 10. Trigger Engine contract

### 10.1 Trigger Engine responsibilities

A Trigger Engine may:

- declare voice and geometry configuration;
- render geometric representations of voice phase;
- select or reference sounds;
- map event state to light, pulse, motion, material, particles, or trails;
- expose local controls that request quantized configuration changes;
- display macro-cycle relationships;
- respond to approved environmental modulation;
- emit non-authoritative UI/telemetry events.

### 10.2 Trigger Engine non-responsibilities

A Trigger Engine must not:

- own the authoritative musical clock;
- create a private tempo timer;
- derive note events from collision;
- alter global transport through visual side effects;
- use component mount time as musical origin;
- become permanently desynchronized when hidden or remounted;
- assume one rendered frame per event;
- couple audio timing to animation completion;
- use random values that cannot be reproduced when determinism is required.

### 10.3 Required inputs

Conceptually:

```ts
type TriggerEngineFrame = {
  compositionId: string
  compositionVersion: number
  transportState: "stopped" | "playing" | "paused"
  musicalPosition: MusicalPosition
  macroCycleIndex: EventIndex
  macroPhase: WrappedPhase
  voices: Array<{
    id: string
    eventIndex: EventIndex
    phase: WrappedPhase
    isBoundary: boolean
  }>
  environmentalModulation?: ApprovedModulation
}
```

This is a semantic contract, not a required React prop shape.

### 10.4 Output separation

The Trigger Engine’s visual output and the audio scheduler’s output should be sibling consumers of the event model, not parent and child.

Unsafe:

```text
Trigger Engine animation
        ↓ collision
        ↓
play sound
```

Safe:

```text
Rhythm event
   ├── schedule sound
   └── render corresponding visual state
```

### 10.5 Lifecycle

Mounting, unmounting, tab visibility, viewport position, and renderer availability must not change musical truth.

A Trigger Engine mounted midway through a macro-cycle should render the correct current state immediately.

### 10.6 Multiple Trigger Engines

All simultaneously active Trigger Engines must:

- reference the same rhythm authority;
- identify the composition/transport context they belong to;
- remain coherent at shared boundaries;
- avoid duplicated global scheduling;
- avoid global mutable state hidden inside one instance.

---

## 11. Audio scheduling

### 11.1 Scheduler principles

The audio scheduler should:

- use authoritative event times;
- schedule with enough lookahead to tolerate main-thread jitter;
- avoid duplicate scheduling;
- maintain stable identifiers for scheduled events;
- respond explicitly to pause, seek, reset, and composition changes;
- distinguish generated events from rendered frames;
- provide observability for late or dropped events.

### 11.2 Audio clock and rhythm authority

The browser or platform audio clock is often the best high-resolution playback reference, but it should be integrated deliberately.

Two safe patterns are possible:

1. **Audio-clock-led transport:** musical position is anchored to audio clock time.
2. **Logical transport with synchronized audio projection:** a logical transport maps events onto audio clock timestamps.

The repository audit must determine the current approach. The project should adopt and document one.

### 11.3 Lookahead is not a second authority

A scheduler may know about future authoritative events. That does not make it the owner of musical structure.

It must be possible to cancel or invalidate scheduled events when:

- playback stops;
- a seek occurs;
- the composition version changes;
- a quantized transition replaces future events.

### 11.4 Late events

The implementation must define:

- threshold for considering an event late;
- whether a late event plays immediately, is skipped, or is rescheduled;
- how late-event behavior affects visual representation;
- telemetry for diagnosing scheduler health.

The policy may differ for percussive events, sustained textures, and ambient layers.

---

## 12. Visual synchronization

### 12.1 Visual state is sampled

The renderer samples authoritative state at its own frame rate.

It may interpolate for smoothness, but interpolation cannot alter event ordering or phase identity.

### 12.2 Visual latency compensation

Audio output and display pipelines may have different latency.

**PLANNED / ENGINEERING REQUIREMENT**

The system should support measured or configured visual compensation so perceived audiovisual alignment remains credible.

Compensation must be centralized or consistently applied. Individual Trigger Engines must not each invent unexplained offsets.

### 12.3 Boundary visualization

A pulse, collision-like flash, node activation, or crossing animation may visually mark an event.

The rendered contact is representational. The event existed first in the musical model.

### 12.4 Reduced motion and performance modes

Changing visual fidelity, particle count, frame rate, or motion accessibility settings must not change music.

At reduced fidelity, the system should preserve:

- event timing;
- phase relationships;
- primary geometry;
- important state legibility.

---

## 13. Determinism

### 13.1 Deterministic core

Given identical versioned inputs, the composition’s rhythmic event structure must be reproducible.

Inputs include:

- composition definition;
- seed where applicable;
- starting musical origin;
- environment-to-composition parameter snapshot;
- transition schedule.

### 13.2 Where nondeterminism may exist

Nondeterministic detail may be acceptable in:

- purely decorative particles;
- noise textures;
- non-semantic micro-animation;
- room/reverb variation that does not alter rhythmic events;
- environment rendering that does not change gameplay or musical structure.

If a detail affects:

- note existence;
- note timing;
- route outcome;
- Phase Zero;
- progression;
- shared-world interpretation;

it must use an authoritative or reproducible input.

### 13.3 Seed scope

Seeds should be scoped and named. A single global random stream can create accidental coupling where changing one decorative call changes every subsequent musical decision.

Potential scopes:

- composition;
- route;
- transit instance;
- voice;
- weather snapshot;
- anomaly encounter;
- decorative visual layer.

The final seed model is unresolved.

### 13.4 Versioning

Reproducibility requires versioned algorithms.

If an algorithm changes, a saved composition/transit may need:

- its original algorithm version;
- migration;
- explicit acceptance that replay differs.

---

## 14. Transit duration and composition time

Transit is an audiovisual composition, but route progress and musical phase are not automatically identical.

### 14.1 Known intent

**PLANNED**

Weather may shorten or lengthen a transit and affect the composition.

Examples include tailwind accelerating a crossing and headwind extending it.

### 14.2 The architectural problem

Naively multiplying tempo by live weather can:

- break macro-cycle closure at arrival;
- cause abrupt audible changes;
- make event scheduling unstable;
- create different outcomes across clients;
- desynchronize route progress and musical form;
- make saved/resumed transits irreproducible.

### 14.3 Candidate mappings

No candidate is canon yet.

#### Model A — Fixed musical tempo, changed number of macro-cycles

Weather changes total route duration by changing how many cycles or sections the crossing contains.

**Strengths:**

- stable local musical feel;
- exact cycle behavior;
- easy closure.

**Risks:**

- duration changes may be coarse;
- removing/adding content needs formal design.

#### Model B — Fixed formal structure, globally time-scaled

The whole composition retains the same normalized structure but is stretched or compressed to the effective transit duration.

**Strengths:**

- arrival and composition closure align exactly;
- route duration maps cleanly.

**Risks:**

- tempo/timbre can move outside desirable ranges;
- live duration changes require smooth remapping.

#### Model C — Quantized tempo regions

Weather selects or transitions among approved tempo states at defined musical boundaries.

**Strengths:**

- musically controllable;
- weather feels active;
- changes remain quantized.

**Risks:**

- arrival alignment requires planning;
- forecasts and live changes need deterministic schedules.

#### Model D — Tempo stable, orchestration/density changes

Weather changes layers, density, effects, accents, or geometry while route duration is handled separately.

**Strengths:**

- preserves timing invariants;
- rich audiovisual response.

**Risks:**

- does not literally make the composition faster/slower;
- may weaken the intuitive tailwind relationship.

#### Model E — Hierarchical mapping

Route duration controls a high-level formal timeline, while local Trigger Engine cycles remain exact and quantized within it.

**Strengths:**

- supports long-form composition;
- separates transit arc from local rhythm;
- allows controlled weather influence.

**Risks:**

- greater implementation and authoring complexity;
- needs formal rules for section boundaries.

### 14.4 Current safe rule

Until a mapping is chosen:

> **Weather may provide authoritative modulation parameters, but no environmental subsystem may directly mutate Trigger Engine clocks.**

The composition layer receives a versioned/quantized modulation plan and applies it according to one declared model.

### 14.5 Arrival

Whether arrival must coincide with macro Phase Zero is unresolved.

Recommended possibilities:

- exact Phase Zero arrival;
- completion at a higher-level formal boundary containing multiple macro-cycles;
- a designed coda entered at the final valid boundary.

Arbitrary truncation of a composition at route completion should be avoided.

---

## 15. Environmental modulation contract

### 15.1 World state versus modulation

Raw world data should not be consumed independently by every Trigger Engine.

Preferred flow:

```text
Authoritative world/weather state
               ↓
Transit/environment interpretation
               ↓
Approved musical modulation plan
               ↓
Rhythm/composition system
               ↓
Audio + Trigger Engine visual state
```

### 15.2 Why an interpretation layer is required

Raw wind speed or precipitation does not inherently define:

- tempo;
- scale;
- voice count;
- reverb;
- density;
- geometry;
- macro-cycle duration.

Those relationships are creative rules and must be authored, bounded, tested, and versioned.

### 15.3 Modulation classes

Possible classes, not yet locked:

- continuous visual-only modulation;
- continuous audio-effect modulation;
- quantized density change;
- quantized orchestration change;
- quantized tempo state;
- formal-section selection;
- event probability using an authoritative seed;
- route-duration mapping.

Each parameter must declare:

- source;
- valid range;
- smoothing;
- quantization boundary;
- determinism requirements;
- effect on closure;
- behavior after pause/resume.

### 15.4 Shared world consistency

If two players experience the same route and world condition at the same time, the system must decide which aspects should match:

- route availability;
- duration;
- weather class;
- macro form;
- exact event sequence;
- anomalies;
- decorative detail.

The answer is unresolved, but shared gameplay-relevant facts must not be independently randomized.

---

## 16. Scale and tuning

### 16.1 Locked intent

All notes/scales in PHASE use a **432 Hz tuning reference**.

### 16.2 Safe technical interpretation

“All notes are tuned to 432 Hz” cannot literally mean every pitch has frequency 432 Hz.

The only musically coherent default interpretation is:

> **The tuning system uses A4 = 432 Hz unless a later explicit decision defines another reference note or world-specific standard.**

This document records that as the safe engineering interpretation, not as proof that the creator explicitly selected A4.

### 16.3 Frequency derivation

For twelve-tone equal temperament under the safe default:

```text
frequency(n) = 432 × 2^((n - 69) / 12)
```

where MIDI note 69 is A4.

This formula is illustrative. PHASE has not locked twelve-tone equal temperament as its only tuning system.

### 16.4 Scale definition

A scale must be represented independently from the reference frequency.

Conceptually:

```ts
type TuningReference = {
  referencePitch: "A4"
  referenceFrequencyHz: 432
  temperamentId: string
}

type ScaleDefinition = {
  id: string
  root: PitchClass | Frequency
  degrees: ScaleDegree[]
  tuningReferenceId: string
}
```

### 16.5 Unresolved tuning questions

- Is A4 = 432 Hz the intended reference?
- Is equal temperament assumed?
- Are just intonation, microtonal scales, or alternate temperaments planned?
- Does every sound pack obey one global tuning system?
- Can environmental/harmonic phenomena bend pitch continuously?
- Is 432 Hz an objective world-physics rule, an MTC standard, cultural belief, or artistic rule?
- How should samples recorded at another tuning be handled?

Until resolved:

- do not hard-code arbitrary per-component tuning;
- centralize the tuning reference;
- preserve explicit scale identity;
- do not market unverified scientific claims about 432 Hz.

---

## 17. Sound architecture boundaries

The conversation establishes rhythm and tuning principles but does not establish a full synthesis/mixing architecture.

### 17.1 Known requirements

- Sound events derive from authoritative rhythmic state.
- Multiple voices may form polyrhythmic relationships.
- Sound packs and additional layers may be part of progression.
- Environment/weather may eventually alter the sound world.
- Long-duration listening must remain musically viable.

### 17.2 Unresolved

- synthesis versus samples;
- audio engine/API;
- polyphony limits;
- voice stealing;
- effects routing;
- spatial audio;
- buses and mastering;
- limiter/loudness policy;
- reverb architecture;
- mobile/browser constraints;
- offline rendering;
- user sound packs;
- dynamic range modes for background work.

### 17.3 Safe separation

Rhythmic event generation should not depend on a particular synthesizer or sample player.

Preferred:

```text
authoritative note event
          ↓
sound renderer / instrument
```

This allows sound design to evolve without rewriting timing truth.

---

## 18. State, pause, resume, and suspension

### 18.1 State categories

Separate:

- composition definition;
- transport state;
- current authoritative position;
- scheduled audio events;
- ephemeral visual state;
- transit/world state;
- saved progression.

### 18.2 Pause

The exact gameplay pause policy is unresolved.

If musical playback pauses:

- the rhythm authority must preserve a canonical position;
- already scheduled future audio must be cancelled or gated correctly;
- resumption must not create duplicated events;
- visuals must reconstruct from the resumed position;
- global persistent weather may continue independently.

### 18.3 Background suspension

Browsers and operating systems may throttle:

- animation frames;
- timers;
- workers;
- audio;
- network activity.

The system must detect suspension and choose a declared recovery policy:

- resume from the preserved musical position;
- advance according to elapsed real time;
- request authoritative state;
- enter a safe paused condition.

It must not unknowingly continue with desynchronized local accumulators.

### 18.4 Seek and restore

Even if seeking is not exposed to players, test and restore tooling should be able to reconstruct:

- macro-cycle index;
- voice event indices;
- normalized phases;
- deterministic seeded state;
- visual snapshot.

---

## 19. Precision and numerical policy

### 19.1 Integer-first musical representation

**RECOMMENDED**

Use integer:

- samples;
- ticks;
- event indices;
- rational subdivisions;

for canonical musical relationships where possible.

Convert to floating-point seconds/phase at system boundaries.

### 19.2 Floating-point tolerance

Tolerance may be used for:

- rendering comparisons;
- display;
- interpolation;
- non-authoritative easing.

Tolerance must not define whether an event exists if an integer/rational formulation is available.

### 19.3 Long session overflow

Event and tick representations must be safe for intended session durations.

Avoid counters that lose integer precision or overflow during long transits or persistent use.

### 19.4 Clock drift

If logical and audio clocks both exist, measure and correct drift through one documented synchronization strategy.

Do not let every consumer compensate independently.

---

## 20. Performance principles

### 20.1 Audio priority

Visual degradation is preferable to audio timing failure.

Under load, the system should reduce:

- particle count;
- trail length;
- geometry detail;
- postprocessing;
- visual update frequency;

before compromising authoritative scheduling.

### 20.2 Avoid render-driven global state

High-frequency phase updates should not force unnecessary whole-application rerenders.

Framework-specific optimization belongs to implementation, but likely approaches include:

- external stores with selective subscription;
- mutable render refs for per-frame state;
- worker/worklet computation;
- batched snapshots;
- renderer-local interpolation.

No one approach is canon.

### 20.3 Many Trigger Engines

The architecture should scale by sharing:

- one transport;
- one event computation pipeline where practical;
- stable definitions;
- batched visual state;
- centralized audio scheduling.

It should not scale by multiplying:

- timers;
- global listeners;
- audio contexts;
- requestAnimationFrame loops;
- duplicated event queues.

### 20.4 Instrumentation

Performance telemetry should distinguish:

- audio scheduling lateness;
- render frame drops;
- event-generation cost;
- Trigger Engine render cost;
- network/world-state latency;
- clock drift.

---

## 21. Accessibility and user control

Accessibility settings must preserve musical truth.

### 21.1 Reduced motion

Reduce:

- camera movement;
- strobing;
- particle motion;
- rapid scale changes;
- excessive rotation.

Retain:

- phase legibility;
- event indication;
- route state;
- synchronization.

### 21.2 Photosensitivity

Provide bounded luminance and flash behavior. A note event does not require a full-screen flash.

### 21.3 Audio control

Future implementation should consider independent control over:

- musical voices;
- ambience;
- transmissions;
- effects;
- interface sound;
- master output.

The exact bus structure is unresolved.

### 21.4 Background/focus use

The mix should support long listening without forcing maximum density or loudness.

---

## 22. Testing requirements

The invariants must be executable as tests, not preserved only by comments.

### 22.1 Unit tests

Test:

- normalized phase domains;
- wrap behavior;
- negative and large positions;
- event-index derivation;
- macro-cycle length;
- voice closure;
- Phase Zero detection;
- deterministic seeded output;
- configuration quantization;
- tuning conversion;
- route progress versus wrapped phase types.

### 22.2 Property-based tests

For many generated valid voice configurations:

- phases remain in range;
- macro closure returns every voice to its origin relationship;
- event indices are monotonic while playing forward;
- identical inputs produce identical events;
- frame sampling frequency does not change event results.

### 22.3 Simulation tests

Simulate:

- 10-, 20-, 45-, and 90-minute transits;
- long background suspensions;
- dropped render frames;
- jittery timer callbacks;
- pause/resume near event boundaries;
- resume near Phase Zero;
- component unmount/remount;
- many simultaneous Trigger Engines;
- weather modulation at valid transition boundaries;
- clock correction.

### 22.4 Audio/visual alignment tests

Where tooling permits:

- record event timestamps;
- compare scheduled audio times with visual event times;
- measure latency and jitter distributions;
- test compensation settings;
- detect double- and missed-trigger events.

### 22.5 Regression fixtures

Maintain canonical composition fixtures with expected:

- macro-cycle duration;
- event sequence;
- Phase Zero locations;
- selected frequencies;
- seed/version output.

Changing a fixture should require an intentional review.

---

## 23. Observability and debugging

The system should expose a developer diagnostics view capable of showing:

- transport state;
- authoritative musical position;
- macro-cycle index;
- macro phase;
- each voice’s event index and phase;
- next scheduled audio events;
- late/dropped event count;
- visual frame rate;
- measured clock offset/drift;
- composition ID and version;
- seed;
- environmental modulation snapshot;
- last Phase Zero timestamp.

Diagnostics must read authoritative state. They must not become another owner of it.

Useful debug operations:

- pause at next Phase Zero;
- step through events;
- seek to macro-cycle boundary;
- force a known seed;
- simulate frame drops;
- simulate background suspension;
- apply a test modulation plan;
- compare two Trigger Engines against the same transport.

---

## 24. Anti-pattern register

| Anti-pattern | Why it fails PHASE | Required correction |
|---|---|---|
| Timer per Trigger Engine | Creates drift and duplicated authority | Shared rhythm authority |
| `requestAnimationFrame` increments musical phase | Frame rate changes music | Derive phase from authoritative position |
| Collision plays note | Geometry determines timing | Rhythm event drives both note and visual |
| Audio callback updates visual position as the only state | Callback delivery may jitter | Shared timestamped event model |
| Visual callback schedules sound at contact | Main-thread/render latency becomes musical | Lookahead audio scheduler |
| Floating phase accumulated forever | Long-session numerical drift | Origin/tick-derived phase |
| Weather component mutates BPM directly | Introduces cross-system clock ownership | Approved modulation plan |
| Every component reads raw weather | Inconsistent mappings | Central environment interpretation |
| Route progress reused as phase | Confuses finite and wrapped progress | Typed mapping |
| Component remount restarts animation | Lifecycle changes music | Reconstruct from transport |
| Random calls during render define notes | Device/render differences alter composition | Seeded event generation |
| Independent audio contexts per engine | Resource cost and clock divergence | Shared audio architecture |
| Exact float equality detects closure | Boundaries can be missed | Integer/rational index change |
| Tempo changes immediately mid-event | Clicks, incoherence, nonreproducibility | Quantized/smoothed transition policy |
| Fidelity setting changes update cadence of events | Low-end devices hear different music | Decouple event model from rendering |

---

## 25. Change-control rules

The following changes require a recorded architectural decision:

- introducing a second rhythm authority;
- changing the normalized phase domain;
- changing Phase Zero semantics;
- allowing collision-derived musical events;
- changing macro-cycle closure behavior;
- making Trigger Engines own tempo;
- coupling musical event count to frame rate;
- changing the global tuning reference;
- choosing the weather-to-composition time model;
- defining arrival relative to formal closure;
- allowing nondeterminism to affect gameplay-relevant notes;
- changing pause/resume time semantics.

A decision record should state:

- problem;
- current behavior;
- proposed behavior;
- creative reason;
- technical reason;
- effect on determinism;
- effect on saved data;
- effect on tests;
- migration plan.

---

## 26. Required codebase audit questions

Before treating this target architecture as implemented, Codex must inspect the actual repository and answer:

1. What currently owns musical time?
2. How many timers, animation loops, audio contexts, and schedulers exist?
3. How is normalized progress represented?
4. Is phase accumulated or derived?
5. How are voice ratios/subdivisions represented?
6. How is the macro-cycle computed?
7. How is Phase Zero detected?
8. What currently causes a note event?
9. Are any notes triggered by collision/intersection?
10. Do visuals and audio consume the same event identity?
11. How do Trigger Engines mount, unmount, and resynchronize?
12. What happens under dropped frames or hidden tabs?
13. What is the tuning reference in code?
14. Are scales centralized?
15. Is randomness seeded?
16. How does current route/transit progress interact with music?
17. Does weather exist in code, and can it change timing?
18. Which invariants already have tests?
19. Where does Lovable-generated duplication exist?
20. What is well designed and must not be casually rewritten?

Confirmed implementation findings must remain separate from recommendations.

---

## 27. Open decisions

| ID | Decision | Status |
|---|---|---|
| ARA-001 | Canonical time representation: samples, ticks, seconds, or hybrid | **UNRESOLVED** |
| ARA-002 | Audio-clock-led versus logical-transport-led architecture | **UNRESOLVED** |
| ARA-003 | Exact voice/rhythm data model | **UNRESOLVED** |
| ARA-004 | Formal macro-cycle derivation used by current PHASE compositions | **UNRESOLVED** |
| ARA-005 | Arrival relationship to Phase Zero/formal closure | **UNRESOLVED** |
| ARA-006 | Weather-to-duration/composition mapping model | **UNRESOLVED** |
| ARA-007 | Pause and background-suspension semantics | **UNRESOLVED** |
| ARA-008 | Exact 432 Hz reference pitch and temperament | **UNRESOLVED** |
| ARA-009 | Sound synthesis/sample architecture | **UNRESOLVED** |
| ARA-010 | Deterministic seed scopes | **UNRESOLVED** |
| ARA-011 | Visual latency-compensation method | **UNRESOLVED** |
| ARA-012 | Shared versus personalized event detail during the same world conditions | **UNRESOLVED** |
| ARA-013 | User-authored Trigger Engine contract | **EXPLORATORY** |
| ARA-014 | Environmental pitch bending or microtonality | **EXPLORATORY** |

---

## 28. Compact implementation contract

Every implementation should be able to truthfully state:

1. There is one logical musical timeline.
2. Every voice phase is derived from it.
3. Every note event is derived from rhythmic state.
4. Every Trigger Engine consumes rhythmic state.
5. Geometry never authoritatively causes a note.
6. Frame rate never changes musical results.
7. All active voices close deterministically.
8. Phase Zero is exact and testable.
9. Audio and visuals reference the same event identities.
10. A mounted or resumed consumer can reconstruct current state.
11. Environmental influence enters through an explicit modulation contract.
12. The tuning reference and scale are centralized.
13. Long transits do not accumulate unbounded timing drift.
14. Changes to these rules require a recorded decision.

If any statement is false, the implementation conflicts with the target architecture.

---

## 29. Run boundary

This document completes **Run 3 only: musical and technical heart**.

It does not define:

- complete game mechanics;
- world lore;
- final weather simulation;
- final progression;
- final sound design;
- final visual direction;
- roadmap sequencing;
- the current repository’s actual architecture.

Those belong to later documents and the eventual codebase audit.
