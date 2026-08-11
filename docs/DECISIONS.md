# PHASE Decisions

**Document role:** Permanent architectural and creative decision memory  
**Run:** 7 of the PHASE Project Bible documentation plan  
**Authority:** Accepted decisions outrank general target descriptions where they directly conflict; unresolved items are not decisions  
**Last updated:** 2026-08-09

---

## 1. How to use this log

This is an Architectural/Creative Decision Record (ADR/CDR), not a list of ideas.

Each accepted record contains:

- decision;
- status;
- scope;
- rationale;
- consequences;
- prohibited regressions;
- source authority.

### Status

| Status | Meaning |
|---|---|
| **ACCEPTED** | Current governing decision. |
| **PROVISIONAL** | Selected direction with an explicitly unresolved detail. |
| **SUPERSEDED** | Replaced by a later numbered decision. |
| **REJECTED** | Deliberately not adopted. |

### Change process

To change an accepted decision:

1. add a new decision record;
2. state why the old decision is insufficient;
3. describe creative and technical effects;
4. identify migration and test consequences;
5. mark the old record superseded;
6. update affected documents.

Do not silently edit history to make a new decision appear old.

---

## D001 — PHASE is a hybrid product, not one conventional category

**Status:** ACCEPTED  
**Scope:** Product

### Decision

PHASE is an audiovisual game, generative instrument, ambient world, and focus companion.

### Rationale

Its identity depends on allowing focused and peripheral attention without reducing either to a secondary mode.

### Consequences

- mechanics must coexist with long listening;
- background use is an intended use case;
- interface and failure systems must respect shifting attention;
- product evaluation must include experiential quality.

### Prohibited regression

Do not redefine PHASE solely as a rhythm game, visualizer, idle game, DAW, or flight simulator.

### Source

`CONTEXT_INDEX.md`, `PHASE_VISION.md`

---

## D002 — Transit is the central experiential unit

**Status:** ACCEPTED  
**Scope:** Product/game design

### Decision

A transit is a playable long-form audiovisual composition, not fast travel or a loading screen.

### Rationale

Distance, duration, composition, world state, and arrival give the Navigator’s work meaning.

### Consequences

- one crossing must be proven before world scale;
- duration is a design material;
- route progress, environment, transmissions, and composition must integrate;
- arrival needs formal/emotional closure.

### Prohibited regression

Do not replace transit with a passive timer or disposable travel animation.

### Source

`PHASE_VISION.md`, `GAME_SYSTEMS.md`

---

## D003 — One logical rhythm authority

**Status:** ACCEPTED  
**Scope:** Architecture

### Decision

PHASE has one logical authoritative source of musical time.

### Rationale

Long-form audiovisual synchronization and polyrhythmic closure cannot depend on multiple independent clocks.

### Consequences

- Trigger Engines consume time;
- schedulers and renderers remain subordinate;
- environmental systems cannot own musical time;
- diagnostics must expose the authority.

### Prohibited regression

No timer per Trigger Engine or equal competing musical clocks.

### Source

`CONTEXT_INDEX.md`, `AUDIO_RHYTHM_ARCHITECTURE.md`

---

## D004 — Rhythmic progress is normalized

**Status:** ACCEPTED  
**Scope:** Architecture/data contract

### Decision

Repeating rhythmic position is exposed as normalized phase in `[0,1)`.

Finite route progress is a distinct `[0,1]` concept.

### Rationale

Normalized phase gives audio and geometry a shared unitless language while distinct semantic types prevent boundary mistakes.

### Consequences

- consumers do not infer phase from geometry;
- repeating and finite progress must not be conflated;
- wrap behavior is explicit.

### Source

`AUDIO_RHYTHM_ARCHITECTURE.md`

---

## D005 — Macro-cycle closure is deterministic

**Status:** ACCEPTED  
**Scope:** Musical architecture

### Decision

All participating repeating voices return exactly to their defined relationship at the macro-cycle boundary.

### Rationale

Deterministic closure is central to PHASE’s musical credibility and reconstructability.

### Consequences

- canonical rhythmic relationships should use integer/rational representations where practical;
- closure must have tests;
- frame sampling cannot change results.

### Source

`CONTEXT_INDEX.md`, `AUDIO_RHYTHM_ARCHITECTURE.md`

---

## D006 — Phase Zero is exact

**Status:** ACCEPTED  
**Scope:** Musical architecture

### Decision

Phase Zero is a semantic boundary identified deterministically, not a frame where accumulated animation happens to approximate zero.

### Rationale

Configuration transitions, closure, and audiovisual realignment require a reliable boundary.

### Consequences

- detect boundary through event/cycle indices;
- test exact behavior;
- use Phase Zero as the safe default for globally meaningful quantized changes.

### Source

`AUDIO_RHYTHM_ARCHITECTURE.md`

---

## D007 — Trigger Engines never own timing

**Status:** ACCEPTED  
**Scope:** Architecture

### Decision

Trigger Engines are audiovisual consumers of authoritative rhythmic state.

### Rationale

Their role is to express rhythm geometrically, not define it.

### Consequences

- mounting/unmounting cannot restart musical truth;
- visual configuration cannot silently change transport;
- multiple engines share one authority.

### Prohibited regression

No private tempo, elapsed-time accumulator, or authoritative interval inside a Trigger Engine.

### Source

`CONTEXT_INDEX.md`, `AUDIO_RHYTHM_ARCHITECTURE.md`

---

## D008 — Geometry never authoritatively triggers notes

**Status:** ACCEPTED  
**Scope:** Architecture

### Decision

Collision, intersection, rendered contact, animation completion, and visual position do not decide note timing.

### Rationale

Those mechanisms are frame-rate dependent, nondeterministic, and logically reverse the relationship between music and geometry.

### Consequences

- a rhythmic event schedules sound and visual response as sibling outputs;
- collision-like visuals remain representational;
- any current collision-authoritative implementation must be refactored.

### Source

`CONTEXT_INDEX.md`, `AUDIO_RHYTHM_ARCHITECTURE.md`

---

## D009 — Audio and visuals share event identity

**Status:** ACCEPTED  
**Scope:** Architecture/experience

### Decision

Audio and visual consumers derive from the same musical event model and authoritative position.

### Rationale

Approximate thematic synchronization is insufficient for a product built around visible harmony.

### Consequences

- audio may schedule ahead while visuals sample/interpolate;
- both refer to the same event index/timestamp;
- frame rate affects smoothness, not music.

### Source

`AUDIO_RHYTHM_ARCHITECTURE.md`

---

## D010 — Environmental systems use an explicit modulation contract

**Status:** ACCEPTED  
**Scope:** Cross-system architecture

### Decision

Weather/world state may influence composition only through an authored, bounded, versioned modulation layer.

### Rationale

Raw weather values do not inherently define tempo, density, scale, or form, and must not create a second clock.

### Consequences

- choose a weather-to-composition model before implementation;
- quantization/smoothing/closure effects must be declared;
- Trigger Engines do not read raw weather independently.

### Open detail

The exact mapping model is unresolved.

### Source

`AUDIO_RHYTHM_ARCHITECTURE.md`, `GAME_SYSTEMS.md`

---

## D011 — The tuning reference is centralized at 432 Hz

**Status:** PROVISIONAL  
**Scope:** Music

### Decision

PHASE uses one centralized 432 Hz tuning reference.

### Rationale

The creator explicitly established the 432 Hz rule; centralization prevents per-component tuning drift.

### Consequences

- scales reference one tuning definition;
- samples/instruments must declare tuning;
- do not use mystical real-world claims as justification.

### Open detail

The safe engineering interpretation is A4 = 432 Hz, but reference pitch and temperament require explicit confirmation.

### Source

`CONTEXT_INDEX.md`, `AUDIO_RHYTHM_ARCHITECTURE.md`

---

## D012 — The setting remains Earth

**Status:** ACCEPTED  
**Scope:** Lore

### Decision

PHASE takes place on future Earth, approximately 130 years after extraterrestrial arrival/contact.

### Rationale

The creator clarified that Kashmer-Alterra is not a replacement planet name.

### Consequences

- surviving geography/history should remain connected to Earth;
- Kashmer-Alterra remains a working setting label only;
- exact dates and map remain unresolved.

### Source

`CONTEXT_INDEX.md`, `WORLD_LORE.md`

---

## D013 — Transformation is convergence, not simple corruption

**Status:** ACCEPTED  
**Scope:** Lore/visual direction

### Decision

Altered matter, biology, and environments should be understood as transforming toward new configurations rather than merely rotting or becoming morally corrupted.

### Rationale

Convergence supports beauty, coherent wrongness, ecological ambiguity, and cosmic mystery.

### Consequences

- “corruption” cannot be the universal art/lore label;
- anomalies may be stable, beautiful, useful, or dangerous;
- gore is not the default.

### Source

`CONTEXT_INDEX.md`, `WORLD_LORE.md`, `VISUAL_DIRECTION.md`

---

## D014 — Horror is beautiful and daylight-capable

**Status:** ACCEPTED  
**Scope:** Creative direction

### Decision

PHASE’s defining horror is visible, beautiful, deeply frightening, and able to function in daylight.

### Rationale

Beauty is part of the danger; fear comes from coherent rules humanity cannot understand.

### Consequences

- avoid dependence on darkness, jump scares, gore, and constant panic;
- anomalies should attract and unsettle;
- ordinary calm must remain common enough for deviations to matter.

### Source

`PHASE_VISION.md`, `WORLD_LORE.md`, `VISUAL_DIRECTION.md`

---

## D015 — Humanity persists through routine

**Status:** ACCEPTED  
**Scope:** Emotional/narrative direction

### Decision

The emotional north star is minimal but persistent hope expressed through ordinary work.

### Rationale

PHASE is not nihilistic. Civilization continues through maintenance, crossing, forecasting, recording, feeding, and teaching without certainty of recovery.

### Consequences

- routine transmissions and daily life are essential;
- constant melodrama is inappropriate;
- good people and institutions may remain sincere.

### Source

`PHASE_VISION.md`, `WORLD_LORE.md`

---

## D016 — MTC is necessary and broadly benevolent

**Status:** ACCEPTED  
**Scope:** Lore/institution

### Decision

Meridian Transit Corporation is not a secretly evil megacorporation by default.

### Rationale

The creator selected a “utopian apocalypse” register in which institutions can retain integrity and civilization depends on MTC.

### Consequences

- MTC may make mistakes or possess incomplete knowledge;
- conflict cannot rely automatically on corruption;
- visual identity should communicate public utility, institutional continuity, and competence.

### Source

`CONTEXT_INDEX.md`, `WORLD_LORE.md`

---

## D017 — Navigator is the in-world vocation term

**Status:** ACCEPTED  
**Scope:** Terminology/lore

### Decision

Use **Navigator** rather than **pilot** as the preferred in-world profession.

### Rationale

The role involves perceiving and maintaining harmonic transit, not merely controlling an aircraft.

### Consequences

- “pilot” remains explanatory shorthand only;
- training, UI, narrative, and progression should use Navigator;
- “Attuned” is not the selected profession.

### Source

`CONTEXT_INDEX.md`, `WORLD_LORE.md`

---

## D018 — Meridian is not an ordinary rank

**Status:** PROVISIONAL  
**Scope:** Terminology/progression/lore

### Decision

Do not treat **Meridian** as a routine level in a standard rank ladder.

### Rationale

The stronger direction is a rare state, recognition, or relationship to harmonic alignment.

### Consequences

- do not implement Navigator → Meridian as a normal XP promotion;
- preserve potential multiple meanings;
- exact ontology remains unresolved.

### Source

`CONTEXT_INDEX.md`, `GAME_SYSTEMS.md`, `WORLD_LORE.md`

---

## D019 — Gliders embody efficiency rather than force

**Status:** ACCEPTED  
**Scope:** Lore/visual/product

### Decision

Gliders are the principal transit craft and must read as quiet, efficient, current/corridor-riding working vehicles rather than futuristic fighters.

### Rationale

They symbolize survival by adaptation and small possibility, not domination.

### Consequences

- avoid weapons/aggressive fighter language;
- design around lift, endurance, maintenance, and institutional history;
- auxiliary propulsion remains unresolved.

### Source

`CONTEXT_INDEX.md`, `WORLD_LORE.md`, `VISUAL_DIRECTION.md`

---

## D020 — The world’s weather is persistent and consequential

**Status:** ACCEPTED  
**Scope:** Game/world

### Decision

One world-scale weather system should continue independently of an individual player and affect routes, transit, audiovisual conditions, and planning.

### Rationale

The world should have its own heartbeat and require adaptation rather than waiting for the player.

### Consequences

- shared gameplay-relevant weather must be authoritative;
- forecasts matter;
- route closures/duration may change;
- client-local random weather is insufficient.

### Open detail

Variables, simulation, forecast uncertainty, and music mapping remain unresolved.

### Source

`CONTEXT_INDEX.md`, `GAME_SYSTEMS.md`

---

## D021 — Social design prioritizes joint solitude

**Status:** ACCEPTED  
**Scope:** Product/social

### Decision

PHASE should first connect players asynchronously through traces, records, forecasts, and provenance.

### Rationale

Connection should deepen the world without turning transit into a chat lobby.

### Consequences

- asynchronous systems precede chat/voice;
- synchronous features require evidence and moderation;
- users must be able to preserve solitude;
- social UI must not dominate the composition.

### Source

`PHASE_VISION.md`, `GAME_SYSTEMS.md`

---

## D022 — Artifacts use provenance, not loot logic

**Status:** ACCEPTED  
**Scope:** Game/lore/social

### Decision

Rare inherited MTC objects should derive meaning from custody and history, not random power or published rarity percentages.

### Rationale

Provenance embodies continuity and connection across time.

### Consequences

- transfer history is central;
- exact acquisition/reward/loss rules remain unresolved;
- artifacts must not become paid/random loot.

### Source

`CONTEXT_INDEX.md`, `GAME_SYSTEMS.md`, `WORLD_LORE.md`

---

## D023 — Mathematical form must be generative and truthful

**Status:** ACCEPTED  
**Scope:** Visual identity

### Decision

When PHASE uses harmonic mathematics visually, the mathematics should generate or materially determine the form.

### Rationale

Decorative formulas beside arbitrary shapes undermine the world’s claim that harmony is structural.

### Consequences

- Chladni, Lissajous, standing-wave, Fourier, and spherical-harmonic work must be constructed correctly or labeled as abstraction;
- mathematical motifs must remain restrained;
- visual motion follows authoritative rhythm.

### Source

`CONTEXT_INDEX.md`, `VISUAL_DIRECTION.md`

---

## D024 — MTC identity is institutional archaeology

**Status:** ACCEPTED  
**Scope:** Visual identity

### Decision

MTC’s identity is designed across markings, manuals, seals, uniforms, instruments, aircraft, tokens, and accumulated history—not as startup branding.

### Rationale

The institution has survived long enough for its visual system to become cultural infrastructure.

### Consequences

- core marks work in black/white and physical reproduction;
- nautical/airline/compass/globe clichés are rejected;
- wear and historical layering are meaningful;
- final logo remains unresolved pending missing images.

### Source

`CONTEXT_INDEX.md`, `VISUAL_DIRECTION.md`

---

## D025 — Progression deepens perception

**Status:** ACCEPTED  
**Scope:** Game design

### Decision

Progression should enrich perception, audiovisual vocabulary, access, and responsibility rather than primarily increasing numerical power.

### Rationale

Mastery in PHASE means seeing and holding more complexity.

### Consequences

- early PHASE must already be beautiful;
- levels/skill trees/currencies remain unresolved;
- power must not trivialize the world.

### Source

`PHASE_VISION.md`, `GAME_SYSTEMS.md`

---

## D026 — Long prerecorded route videos are not the target content model

**Status:** ACCEPTED  
**Scope:** Production/visual architecture

### Decision

The preferred long-term environment is procedural or hybrid and parameterized by route, world, weather, and time.

### Rationale

Fixed long videos create a content bottleneck and can contradict persistent conditions.

### Consequences

- prototype the runtime early;
- prerendered layers remain allowed;
- renderer/stack remains unresolved;
- weather UI and environment must agree.

### Source

`CONTEXT_INDEX.md`, `GAME_SYSTEMS.md`, `VISUAL_DIRECTION.md`

---

## D027 — Build one crossing before scaling

**Status:** ACCEPTED  
**Scope:** Product roadmap

### Decision

No broad world, social layer, or large progression system should precede proof that one crossing is compelling.

### Rationale

Every maximum-vision system depends on the quality of the crossing.

### Consequences

- prototype scope remains narrow;
- progression, accounts, multiplayer, global weather, and large content wait;
- decision gates use experiential evidence.

### Source

`GAME_SYSTEMS.md`, `PRODUCT_ROADMAP.md`

---

## D028 — Shared gameplay state must be authoritative

**Status:** ACCEPTED  
**Scope:** Backend/world architecture

### Decision

Weather, route status, artifact provenance, shared discoveries, and other gameplay-relevant shared facts must not be independently authored by each client.

### Rationale

A persistent world requires consistent facts and abuse-resistant history.

### Consequences

- server/world authority is required before these systems scale;
- clients may cache/project state but do not own it;
- random systems need authoritative/reproducible inputs.

### Source

`GAME_SYSTEMS.md`, `AUDIO_RHYTHM_ARCHITECTURE.md`

---

## D029 — Community theory does not automatically become canon

**Status:** ACCEPTED  
**Scope:** Lore/community/data

### Decision

Archives distinguish objective/institutional content, observation, interpretation, theory, and disputed claims.

### Rationale

PHASE needs player discovery without losing authorial truth and deliberate mystery.

### Consequences

- unrestricted wiki authority is inappropriate;
- promotion to canon requires an authorized process;
- UI/data models must show knowledge class.

### Source

`GAME_SYSTEMS.md`, `WORLD_LORE.md`

---

## D030 — References are translated into principles

**Status:** ACCEPTED  
**Scope:** Creative production

### Decision

External references guide principles and anti-references; they are not templates for assets, plots, terminology, costumes, creatures, or interfaces.

### Rationale

PHASE requires a coherent original identity and must avoid derivative copying.

### Consequences

- each reference use records what is taken and rejected;
- production assets require provenance;
- direct visual reconstruction is prohibited.

### Source

`PHASE_VISION.md`, `VISUAL_DIRECTION.md`

---

## D031 — The generative audiovisual instrument is the gateway

**Status:** ACCEPTED
**Scope:** Product/onboarding

### Decision

PHASE’s first and immediate value is a standalone generative audiovisual instrument suitable for listening, viewing, meditation, deep work, concentration, rest, and long-form observation.

World, transit, MTC, routes, lore, and progression are deeper layers that users may discover through and around that instrument. They are not prerequisites for the first meaningful experience.

### Rationale

The project began from the ambition to create a compelling polyrhythmic audiovisual generator. That experience must provide its own “wow” factor and earn curiosity before the larger world asks for attention.

### Consequences

- the default entry experience should reach a composition with minimal friction;
- account creation and lore exposition do not precede first value;
- the instrument remains first-class when world systems arrive;
- world evidence should invite curiosity before explanation;
- the first experience must support both attentive and peripheral use;
- Reset / PHASE 2.0 prioritizes a clean instrument surface and private authoring foundation.

### Prohibited regression

Do not reduce the instrument to a disposable demo, background widget, transit decoration, or feature that only becomes meaningful after progression.

### Source

Explicit project-owner clarification, 2026-08-02; `PHASE_VISION.md`; `TRIGGER_ENGINE_REFERENCE.md`

---

## D032 — Lucid Rhythms is the originating Trigger Engine reference

**Status:** ACCEPTED
**Scope:** Product provenance/creative technology

### Decision

Lucid Rhythms is the originating technical and experiential reference for PHASE’s Trigger Engine ambition.

The initial selected corpus is:

1. *Space Pendulum*;
2. *4 Hours Of Ambient Polyrhythms — Mandala*;
3. *Sine Rhythms Remake*;
4. *5 Hours Of Ambient Polyrhythms — Black Hole*;
5. *Fading Scapes*;
6. *Spinning Triangles — raw early experiment*.

The corpus guides capability study and evaluation. PHASE will independently implement its own architecture, compositions, sound, visuals, interaction, identity, and world integration.

### Rationale

The Project Bible preserved the resulting architectural ideas but omitted the reference that established the original ambition. Recording it prevents the project from optimizing toward a generic visualizer or losing the required level of long-form generative audiovisual quality.

### Consequences

- Trigger Engine work must read `TRIGGER_ENGINE_REFERENCE.md`;
- reference analysis separates confirmed observation from inference;
- the corpus informs multiple engine families, long-form evaluation, and My Studio requirements;
- D030’s translation and anti-copy rules remain fully applicable;
- PHASE does not claim access to Lucid Rhythms’ private software design.

### Prohibited regression

Do not copy or redistribute reference audio, video, assets, exact compositions, branding, or protected visual expression. Do not present inferred private implementation details as fact.

### Source

Explicit project-owner selection, 2026-08-02; `TRIGGER_ENGINE_REFERENCE.md`

---

## D033 — Musical authority uses exact rational macro position and integer event indices

**Status:** ACCEPTED
**Scope:** Rhythm architecture/data contract
**Date:** 2026-08-09

### Context

Reset R3 proved deterministic closure and event identity with integer microticks, but its fixed `1,000,000` ticks-per-second scale was explicitly prototype-only. Reconciliation Step 2 requires a production bridge from the existing time-based transport without silently promoting that proof scale, an arbitrary ticks-per-cycle multiplier, or floating-point rendering phase into musical authority.

### Decision

Canonical musical authority uses a hybrid exact-rational model:

- an immutable composition ID and version identify the musical definition;
- absolute macro-cycle position is represented as a non-negative exact rational number;
- the completed macro-cycle index is a `bigint`;
- every voice declares a positive integer event count per macro-cycle;
- voice event indices are integers, with absolute indices represented as `bigint`;
- an event's exact macro position is derived from `eventIndex / eventCount`;
- stable event identity derives from composition identity/version, voice identity, and exact integer event index;
- normalized phase values in `[0,1)` are derived projections for rendering and display only.

There is no canonical global musical ticks-per-second value, million-ticks-per-cycle grid, or arbitrary resolution multiplier.

The live transport may remain time-based. A supplied transport position and declared macro-cycle duration are converted into exact rational macro position. An integer physical-time unit may be used internally only when its rate and precision come from the underlying clock source. Physical transport units are not musical ticks and must not be exposed as a musical event grid.

Phase Zero is the exact state where the rational macro-cycle remainder is zero. Musical event boundaries and half-open interval comparisons use integer/rational arithmetic or cross-multiplication, never epsilon-based floating-point equality.

### Rationale

Musical events occur at exact rational relationships even when visuals require continuous interpolation. Keeping integer event identity and rational musical position authoritative preserves closure, deterministic reconstruction, cadence independence, and long-session stability without inventing false temporal precision.

### Consequences

- event enumeration is defined mathematically from integer indices and event counts;
- audio and visual consumers can share event identity while renderers use derived floating-point phase;
- geometry cannot create or modify authoritative events;
- pause, suspension, remount, and restoration preserve musical state by preserving the supplied transport position and composition version;
- transport clock precision must remain explicit at the adapter boundary;
- R3's fixed microtick conversion remains laboratory evidence only and is not a production default;
- future R4 geometry families must consume injected snapshots/events and must not retain private transports.

### Alternatives considered

- **Composition-declared arbitrary tick grids:** rejected because multiple resolutions encode the same musical relationships and invite false authority.
- **One global ticks-per-second value:** rejected because it conflates physical transport representation with musical structure.
- **Floating-point phase as event authority:** rejected because equality and accumulated error cannot guarantee exact boundaries.
- **Per-engine clocks or runtimes:** rejected by D003 and D007.

### Migration and verification

- replace the Step 1 proof's musical tick-grid contract with exact rational macro position;
- add a pure supplied-transport adapter with no clock, scheduler, audio, rendering, or geometry ownership;
- test exact Phase Zero, stable identity/order, deterministic reconstruction, pause/freeze behavior, half-open boundaries, cadence independence, and long-duration conversion;
- leave the current production `engineClock`, scheduler, routes, and Trigger Engines unchanged until a separately approved migration.

### Supersedes / superseded by

Resolves ARA-001. It constrains but does not fully resolve ARA-002, ARA-003, or ARA-004.

### Source

Explicit project-owner decision, 2026-08-09; Reconciliation Step 2.

---

## D034 — Production rhythm bridge uses immutable composition snapshots and Phase-Zero revisions

**Status:** ACCEPTED
**Scope:** Production composition, transport lifecycle, and structural transitions
**Date:** 2026-08-09

### Context

The exact-rational authority established by D033 needs production-owned structural inputs and a bridge to the existing live `engineClock`. Current scenes can draw base laps, macro duration, note count, and density from mutable UI/backdrop sources; stored scenes predate explicit numeric composition revisions; some visual engines also retain geometric contact behaviors that cannot become musical authority. Immediate mutation or resetting to Phase Zero on every structural edit risks discontinuities, duplicate events, and missed events.

### Decision

Production rhythm structure is captured in an immutable `CompositionSnapshot` containing:

- composition ID;
- explicit numeric revision;
- exact physical macro-cycle duration;
- positive integer base laps;
- the migrated engine's ordered voice definitions.

Backdrop and UI values may supply constructor inputs, but the resulting snapshot owns those values. `updated_at` is never authoritative composition versioning. A documented legacy revision may bridge stored scenes that do not yet have an explicit revision.

The initial bridge applies only to migrated Phase-Alignment engines. Each such engine exports the ordered voice indices that its runtime actually uses; the snapshot derives integer events-per-macro-cycle from base laps and those indices. Legacy Wheel, Pendulum, and Bars remain outside the bridge. Custom geometry-derived axis intersections also remain outside until they have an authoritative mathematical event model.

The existing `engineClock` remains the single live transport. It supplies physical transport position to the pure live-timeline adapter; the adapter does not read document visibility, own a timer, schedule audio, or advance time. Explicit pause and hidden/background suspension freeze `engineClock`; visibility resume continues from the preserved position and never catches up hidden time in a burst.

A structural change creates a higher numeric composition revision. It is queued while the active snapshot continues unchanged, then activates at the active composition's next exact Phase Zero. The new revision begins at Phase Zero at that same supplied transport position. Event windows remain half-open across the boundary. Non-structural presentation or timbre parameters that do not alter event topology may remain outside this transition policy.

String Network Nexus proximity/contact is visual-only in the authoritative migration contract. The concept is retained as visual behavior and may later return musically only as an explicit deterministic relationship/event derived by the rhythm authority.

### Rationale

An immutable snapshot makes structural ownership and reconstruction explicit. Quantized revision activation lets the current musical form close before a changed form begins, while exact boundary arithmetic prevents frame cadence from affecting the transition. Reusing `engineClock` avoids a competing live clock, and freezing that transport upstream gives audio and visual consumers the same preserved position after suspension.

### Consequences

- macro duration has one owner after snapshot construction;
- density or any setting that changes voice count/cadence requires a new revision;
- production Trigger Engines will receive the snapshot, exact supplied/local positions, authoritative snapshot, and authoritative events;
- a revision transition can be reconstructed from supplied transport position without a running transition clock;
- hidden time does not advance active transmissions or rhythm under the current First Crossing policy;
- already-scheduled audio cancellation/gating remains work for the scheduler/audio migration;
- Studio/database revision persistence remains deferred to R5 reconciliation;
- production audio scheduling remains on the legacy scheduler until separately migrated; the approved Nexus audio removal is the only scene-event behavior change in this step.

### Alternatives considered

- **Mutate the active composition immediately:** rejected because it can change event topology inside a cycle.
- **Reset immediately to Phase Zero:** rejected because it interrupts the current form and makes editing the transport authority.
- **Use `updated_at` as version:** rejected because timestamps do not express deliberate structural identity.
- **Let each engine resolve a duplicated UI voice count:** rejected because displayed counts can diverge from runtime voice structure.
- **Allow Nexus contact to emit authoritative notes:** rejected for this migration because geometry cannot own event existence or timing.
- **Create a new production runtime/clock:** rejected by D003, D007, and the reconciliation ownership target.

### Migration and verification

- introduce immutable snapshot construction and per-engine ordered voice exports;
- add a pure supplied-position revision state machine that activates at exact Phase Zero;
- connect read-only reconstruction to the existing `engineClock`;
- install visibility lifecycle handling upstream on that clock;
- test immutability, explicit versions, real voice topology, deterministic reconstruction, exact transitions, half-open event continuity, freeze/resume, and absence of a second live transport;
- migrate the production scheduler/audio consumer separately before removing legacy event paths.

### Supersedes / superseded by

Resolves ARA-002 and ARA-007 for the current production bridge. Resolves ARA-004 for migrated Phase-Alignment compositions by making macro duration explicit rather than inferred. Partially resolves ARA-003; richer voice, tuning, scale, seed, and sound-assignment data remains future work.

### Source

Explicit project-owner decision, 2026-08-09; Reconciliation Step 4.

---

## D035 — Migrated production audio schedules authoritative event envelopes

**Status:** ACCEPTED
**Scope:** Production scheduler, audio projection, and audiovisual event identity
**Date:** 2026-08-09

### Context

The immutable composition bridge in D034 can enumerate exact events, but the existing production scheduler still asks scene implementations to enumerate floating-point windows and previously batches notes at a lookahead horizon. Pause, background suspension, remount, and composition replacement also require explicit invalidation of already-looked-ahead Web Audio work. Migrated Trigger Engines must not regain event authority through their presentation geometry.

### Decision

The migrated Phase-Alignment path uses one production lookahead scheduler beneath `engineClock`. It enumerates half-open windows through the active `CompositionRevisionSession` and schedules canonical event envelopes containing stable event identity, composition ID and numeric revision, voice identity and integer indices, exact macro position, exact composition-local occurrence, and exact supplied-transport occurrence.

Each event's supplied transport occurrence is projected individually onto `AudioContext.currentTime` through the existing transport mapping. Audio clock time is a playback target only; it is not musical authority. One disposable generation gain gate sits between newly scheduled sources and the existing audio destination. Pause, hidden/background suspension, origin/rate invalidation, scheduler rebind, and runtime teardown silence and disconnect that generation so stale future sources—including sources completed after asynchronous sample loading—cannot play.

Stable authoritative event IDs prevent duplicate scheduling. Identities for invalidated future events are released so resume can reschedule them from the preserved transport position; identities whose occurrences have passed remain guarded. A missed scheduler interval resumes from current preserved transport position and does not emit a catch-up burst.

Migrated scene modules may project one supplied authoritative event into pitch, sound-slot, position, color, and energy metadata. They cannot enumerate, add, remove, or retime events. The scheduled audio event and scheduled visual presentation retain the same authoritative ID. Structural revisions remain queued and the scheduler splits its window at exact Phase Zero, finishing old-revision events before activating and projecting the new revision.

Legacy Wheel, Pendulum, and Bars remain on their prior player paths for comparison. Custom Scene geometry/contact behavior is visual-only during this migration and is not bound to the production audio scheduler.

### Rationale

Separating exact event existence from audio-time and visual presentation preserves deterministic closure while still using Web Audio lookahead. A generation gate is the smallest reliable invalidation boundary available for already-created and asynchronously-created sources. Keeping the old player paths isolated supports comparison without introducing a second authority for migrated engines.

### Consequences

- lookahead horizons no longer become note timestamps;
- frame cadence and geometry cannot alter migrated musical results;
- explicit pause and hidden suspension freeze position and silence stale future schedules;
- resume continues from preserved position without replaying elapsed hidden time;
- current tuning, scales, sound packs, and pitch projection remain behind existing scene/audio boundaries;
- late-event policy and scheduler telemetry remain unresolved follow-up work;
- legacy engine retirement requires separate migration and validation.

### Alternatives considered

- **Keep scene `eventsIn` as production authority:** rejected because duplicated floating-point enumeration can diverge from the accepted rational timeline.
- **Schedule every event at the lookahead horizon:** rejected because it destroys the event's actual occurrence time.
- **Let rendering or contact dispatch audio:** rejected by D003, D007, and D033.
- **Create a second transport or scheduler per engine:** rejected because it creates competing timing ownership.
- **Migrate legacy and Custom engines in the same change:** rejected to preserve validation surfaces and avoid silently assigning geometry musical authority.

### Migration and verification

- retain `engineClock` as the only live transport and one production scheduler singleton;
- pass authoritative envelopes through one injected audio sink and one visual sink;
- gate and invalidate future work on transport lifecycle changes and rebinds;
- test actual occurrence timestamps, half-open adjacency, identity deduplication, freeze/resume, hidden suspension, skipped-boundary revision activation, remount behavior, shared audiovisual identity, and one-event projection;
- keep legacy engine behavior unchanged until its separately approved migration.

### Supersedes / superseded by

Completes the scheduler/audio portion deferred by D034. It does not resolve tuning, late-event policy, final Trigger Engine geometry, or legacy engine retirement.

### Source

Explicit project-owner instruction, 2026-08-09; Reconciliation Step 5.

---

## D036 — Wheel, Pendulum, and Bars are quarantined legacy experiments

**Status:** ACCEPTED
**Scope:** Production scene access, legacy Trigger Engine preservation, and rhythm-authority isolation
**Date:** 2026-08-09

### Context

Wheel, Pendulum, and Bars predate the authoritative production rhythm architecture. They accumulate musical phase from animation-frame deltas and dispatch notes from rendered collision, sign-change, or floating-point wrap behavior. Their ratios, arbitrary geometry, random phase offsets, Brownian/random composer state, source identity, and 440-derived tuning cannot be moved into the exact production composition model without changing their musical behavior or promoting historical experiments into product contracts.

### Decision

Wheel, Pendulum, and Bars are legacy-only. Their behavior remains intact for historical, parity, and reference use on the development-only `/dev/legacy-rhythm` surface. They are removed from production scene selection, and every scene-entry mechanism—including restored session links and Studio audition handoffs—must pass through an explicit production-versus-legacy access boundary.

Legacy Wheel note/line collisions, Pendulum sign crossings, Bars phase wrapping, random/Brownian behavior, phase offsets, and existing tuning remain confined to legacy mode. They will not be rationalized, recreated as production composition semantics, or used as templates for new Trigger Engines. R4 Pendulum remains a separate future candidate rather than a parity migration. No production Bars offset model is selected.

The quarantine reuses the existing player implementation in an explicit access mode. It does not create another clock, scheduler, audio context owner, or copy of the legacy engines. The production path continues to bind only migrated Phase-Alignment compositions to the shared authoritative scheduler. Custom Scene remains visual-only under D035.

### Rationale

Quarantine preserves useful historical evidence without weakening the one-authority invariant or forcing false parity decisions. An explicit access guard is safer and smaller than extracting or duplicating the large historical player implementation. It also prevents legacy session data or Studio handoffs from accidentally reopening a competing note authority in production.

### Consequences

- the production player defaults to an authoritative migrated engine;
- `stringNet` is only the temporary safe production fallback after legacy quarantine; it is not the selected final PHASE Trigger Engine, production geometry, or public gateway direction;
- Wheel, Pendulum, and Bars remain behaviorally available only at `/dev/legacy-rhythm`;
- legacy session links opened on production fall back to the production default rather than activating legacy timing;
- production scene links opened in the legacy laboratory fall back to Wheel;
- legacy tuning and randomness are preserved only as historical behavior;
- any future production return of these ideas requires explicit exact event relationships and seeded/reconstructable randomness;
- final production geometry, production tuning, legacy retirement timing, and late-event policy remain unresolved.

### Alternatives considered

- **Migrate legacy musical behavior into the authoritative runtime:** rejected because doing so would require unresolved musical reinterpretation.
- **Replace legacy engines with R4 families now:** rejected because R4 is comparative laboratory evidence, not approved parity behavior or final production geometry.
- **Delete legacy implementation:** rejected until historical/parity review is complete.
- **Duplicate the player into a development route:** rejected because it would create broad maintenance duplication and divergence.

### Migration and verification

- centralize the allowed production and legacy scene sets;
- guard UI selection, session restoration, and Studio audition entry;
- expose the unchanged historical implementations through `/dev/legacy-rhythm` with persistent non-authoritative labelling;
- test that all three legacy identifiers are rejected in production and all migrated identifiers are rejected in legacy mode;
- verify that no new clock, scheduler, or audio owner is introduced and all existing development routes remain present.

### Supersedes / superseded by

Supersedes only D035's temporary placement of Wheel, Pendulum, and Bars on prior player paths. It does not change D035's production scheduler, Custom Scene treatment, or unresolved late-event policy.

### Source

Explicit project-owner instruction, 2026-08-09; Reconciliation Step 6 legacy quarantine decision.

---

## D037 — My Studio uses Supabase identity plus verified administrator authorization

**Status:** ACCEPTED
**Scope:** My Studio access, privileged server functions, service-role use, and request forgery protection
**Date:** 2026-08-09

### Context

My Studio and its service-role-backed server functions were protected by a six-digit passcode supplied by the browser. That passcode is not a sufficient identity or authorization boundary. The repository now also has Supabase account authentication, user-role records, and newer August 8 RLS/security policies that must remain authoritative.

### Decision

My Studio's intended security boundary is an authenticated Supabase account followed by a database-verified administrator role. Studio routes fail closed while session or role verification is loading or has failed. Every privileged Studio server function validates the request's Supabase bearer token and confirms the authenticated user's own administrator role before it may use the service-role client.

Server-function requests use the framework's origin-based CSRF middleware. The existing passcode implementation remains temporarily for compatibility and later R6 removal, but it is no longer the authority for My Studio or privileged service-role-backed Studio operations.

### Rationale

Account identity plus a database-owned role is auditable, revocable, and compatible with current RLS. Performing the same checks at the server-function boundary prevents a hidden route or modified browser client from bypassing authorization. Explicit CSRF middleware is required because PHASE supplies custom request middleware rather than relying on the framework's default middleware configuration.

### Consequences

- anonymous requests cannot invoke privileged Studio operations;
- authenticated non-administrators cannot invoke privileged Studio operations;
- administrator status is read from current database state and role lookup failures deny access;
- service-role credentials remain server-only and are reached only after identity and role checks;
- Studio clients no longer send a passcode as authorization for privileged operations;
- passcode files and compatibility routes remain present until the separately approved R6 removal;
- scene publication, archive behavior, asset-path policy, and broader Studio authoring/storage reconciliation remain deferred.

### Alternatives considered

- **Retain the six-digit passcode as the service-role boundary:** rejected because possession of a browser-supplied shared secret is not verified account authorization.
- **Rely only on hiding the Studio route:** rejected because client-side visibility is not a server authorization boundary.
- **Replace current migrations and generated types with the older R5 branch versions:** rejected because the newer August 8 RLS work is authoritative and complementary.

### Migration and verification

- retain the current Supabase auth middleware, migrations, generated types, and August 8 policies;
- add a Studio-specific administrator middleware above privileged server functions;
- make route loading and error states fail closed;
- apply origin-based CSRF checking to server-function requests;
- test anonymous, non-administrator, administrator, role-lookup failure, and CSRF-scope cases;
- verify all privileged Studio functions use the shared middleware and the production build passes.

### Supersedes / superseded by

Supersedes the passcode as the intended My Studio and service-role authorization boundary. It does not remove the compatibility implementation and does not resolve the deferred Studio publication, archive, validation, or storage architecture.

The temporary passcode-compatibility retention in this record is superseded by D039. The account-and-role authorization decision remains accepted.

### Source

Explicit project-owner instruction, 2026-08-09; Reconciliation Step 7A.

---

## D038 — Studio exports versioned inventories and enforces publication boundaries

**Status:** ACCEPTED
**Scope:** Private Studio authoring, backup/export, publication validation, preview isolation, and storage paths
**Date:** 2026-08-09

### Context

The older R5 work introduced useful integrity contracts, but its archive described obsolete per-family R3/R4 runtime fixtures and its Builder preview could persist local preview state into the application runtime. Current reconciliation instead has one exact shared R4 laboratory authority, quarantined legacy experiments, newer Supabase security/RLS, and the D037 account-plus-administrator boundary.

### Decision

My Studio exposes an export-only, explicitly versioned private archive contract. Version 1 inventories packs, scales, scenes, authenticated composer presets, local legacy Builder blueprints, and current R4 comparative-laboratory evidence. Archive collections are deterministically ordered, exact integer/rational laboratory values are serialized as decimal strings, and the R4 metadata is labelled development-only rather than production geometry, tuning, or gateway selection. Export does not import, publish, overwrite, migrate, or delete content.

Publishing a pack, scale, or scene requires a server-side integrity check against its complete stored definition plus the proposed publication change. Rules mirror established database, editor, and existing runtime bounds; they do not define new musical or product semantics.

The legacy Builder may save and export local blueprints and render a temporary preview. It cannot persist that preview into production runtime state or present itself as a production publication path. Scene styling preview remains a media, palette, and reactive-style check rather than a musical timing authority.

Service-role-backed upload and signing operations accept only safe relative paths and approved file extensions for their bucket category. Draft scene media is signed only through the administrator boundary. Public scene-media signing succeeds only for a path currently referenced by published scene content.

### Rationale

Versioned deterministic exports provide a recoverable authoring inventory without creating an unresolved import/migration policy. Validation prevents visibly incomplete drafts from crossing the publication boundary. Preview and storage isolation preserve the authoritative runtime and reduce the blast radius of service-role storage access.

### Consequences

- archive schema changes require a new numeric version rather than silent reinterpretation;
- current R4 laboratory evidence is archived without restoring obsolete clocks, runtimes, tuning fixtures, or route patches;
- invalid publication attempts return actionable field-level summaries;
- legacy local blueprints remain recoverable but cannot silently become production state;
- upload paths reject absolute paths, traversal, empty segments, backslashes, and unsupported media extensions;
- current Supabase migrations, generated types, RLS, D037 authorization, and the passcode compatibility files remain unchanged;
- archive import/restore, full media-content inspection, and later passcode removal remain separate work.

### Alternatives considered

- **Port the old R3 fixture archive verbatim:** rejected because those per-family runtime/tick/tuning fields are obsolete after reconciliation.
- **Let the Builder continue live-publishing preview state:** rejected because preview state is not an authoritative production contract.
- **Rely only on client-side validation:** rejected because privileged calls can be made without the supplied interface.
- **Replace current storage migrations or policies:** rejected because newer August 8 security work remains authoritative.

### Migration and verification

- adapt archive metadata to the shared R4 exact-rational laboratory and current geometry consumers;
- sort archive collections and test stable serialization with fixed export metadata;
- validate complete pack, scale, and scene definitions before setting them published;
- use temporary, non-persistent Builder preview overrides and restore prior state on unmount;
- validate upload/signing paths at server-function boundaries and separate draft-admin from published-public scene signing;
- test valid and invalid publication payloads, archive determinism/version rejection, preview persistence isolation, path/media rejection, D037 middleware coverage, unchanged migrations/types, and the production build.

### Supersedes / superseded by

Resolves the R5 archive, publication-validation, legacy-preview, and storage-boundary reconciliation scope deferred by D037. It does not select final Trigger Engine geometry or tuning, define archive import semantics, remove passcodes, or alter the production rhythm scheduler.

The temporary passcode-compatibility retention and later-removal deferral in this record are superseded by D039. Its authoring, publication, preview, and storage decisions remain accepted.

### Source

Explicit project-owner instruction, 2026-08-09; Reconciliation Step 7B.

---

## D039 — My Studio has one account-and-role authorization model

**Status:** ACCEPTED
**Scope:** Removal of the superseded shared passcode authorization path
**Date:** 2026-08-09

### Context

D037 replaced the browser-supplied six-digit passcode as My Studio's security boundary with authenticated Supabase identity and a database-verified administrator role. Step 7B confirmed that publication and storage operations also pass through the shared administrator middleware. The remaining keypad, provider, verification server function, constant-time matcher, environment-variable reads, and unlock redirect are orphaned compatibility code and protect no remaining privileged operation.

### Decision

Remove the six-digit passcode UI, browser state, verifier, server helper, `ADMIN_PASSCODE` reads, and `/admin/unlock` compatibility route. My Studio has one authorization path:

authenticated Supabase user → verified database administrator role → protected privileged operation.

The shared Studio administrator middleware, Supabase session verification, origin-based CSRF protection, RLS, publication validation, and storage boundaries remain unchanged. Existing `/admin/packs`, `/admin/scales`, and `/admin/scenes` redirects remain as non-authentication compatibility links into protected Studio routes. The subtle `AdminTrigger` remains a navigation affordance only and confers no access.

### Rationale

Keeping an unused shared-secret system creates misleading security expectations, unnecessary secret-management surface, and a possible future bypass pattern. Removing it makes the implemented authorization model match the accepted architecture and leaves route-level and operation-level enforcement explicit.

### Consequences

- the repository has no live shared-passcode authorization path;
- `ADMIN_PASSCODE` is no longer read by application code;
- `/admin/unlock` no longer exists;
- anonymous and non-administrator users continue to fail closed;
- authenticated administrators continue through the shared middleware;
- deployment environments may remove any externally configured obsolete `ADMIN_PASSCODE` secret independently;
- unrelated hexadecimal-color validation and gameplay progression terminology are unaffected.

### Alternatives considered

- **Keep the passcode as an emergency fallback:** rejected because this would recreate a second, weaker administrator authority.
- **Keep only the unlock redirect:** rejected because it preserves an obsolete authentication concept without compatibility value.
- **Replace the passcode with another shared secret:** rejected because Supabase identity plus verified role is the single accepted model.

### Migration and verification

- inventory every passcode component, hook, route, server function, environment read, type, test, client call, and document reference;
- remove only orphaned passcode-specific code;
- regenerate the route tree without `/admin/unlock`;
- prove no live passcode references or stale imports remain;
- rerun administrator authorization, CSRF, Studio build, and production-build checks;
- verify migrations, generated Supabase types, RLS, publication validation, storage validation, rhythm/runtime, and SYS routes remain unchanged.

### Supersedes / superseded by

Supersedes only the temporary passcode-compatibility retention and removal deferrals in D037 and D038. It does not change their accepted account authorization, authoring, publication, preview, or storage decisions.

### Source

Explicit project-owner instruction, 2026-08-09; Reconciliation Step 7C.

---

## 2. Rejected decision register

The following have been explicitly rejected or superseded:

| ID | Rejected direction | Current direction |
|---|---|---|
| R001 | MTC as corrupt Weyland-Yutani analogue | Necessary, broadly benevolent institution |
| R002 | Kashmer-Alterra as a replacement planet | Earth remains Earth |
| R003 | Pilot as preferred vocation term | Navigator |
| R004 | Attuned as selected profession | Navigator |
| R005 | Meridian as ordinary rank ladder | Rare/unresolved state or meaning |
| R006 | Navigator as generic magic user | Grounded perceptual/technical practice |
| R007 | Strong drug dependence as defining mechanism | Perception/calibration prioritized |
| R008 | Fighter-jet/spacecraft glider language | Efficient quiet working glider |
| R009 | Fantasy-priest attire | Rugged working mystic |
| R010 | Nautical/airline/compass identity | Institutional harmonic identity |
| R011 | Mathematics as decorative annotation | Mathematics generates form |
| R012 | Fixed long video per route as default | Procedural/hybrid environment |
| R013 | Client-randomized shared weather | Authoritative world state |
| R014 | Weather as cosmetic | Strategic audiovisual system |
| R015 | Artifact as random powerful loot | Provenance and stewardship |
| R016 | Darkness/gore/jump scares as primary horror | Beautiful daylight horror |
| R017 | Degradation/corruption as universal transformation | Convergence |
| R018 | Arbitrary global musical tick grid | Exact rational macro position plus integer event indices |

---

## 3. Unresolved matters are not decisions

The following must not be assigned an accepted decision number until selected:

- final title(s);
- catastrophe name;
- meaning of Meridian;
- geographic ontology/count;
- visitor motive;
- exact harmony physics;
- exact 432 Hz reference/temperament;
- transit failure/pause behavior;
- weather-to-composition model;
- progression ranks/trees/currencies;
- economy;
- monetization;
- final MTC logo;
- final glider;
- final uniforms;
- rendering stack;
- chat/voice;
- user-created Trigger Engines.

---

## 4. Decision template

Use:

```markdown
## DXXX — Short decision title

**Status:** PROPOSED | ACCEPTED | PROVISIONAL | SUPERSEDED | REJECTED
**Scope:** ...
**Date:** YYYY-MM-DD

### Context

What problem or choice requires a decision?

### Decision

What is selected?

### Rationale

Why?

### Consequences

- ...

### Alternatives considered

- ...

### Migration and verification

- ...

### Supersedes / superseded by

- ...
```

---

## 5. Run boundary

`PRODUCT_ROADMAP.md` and this file complete **Run 7 only**.

Run 8 still needs to create:

- `GLOSSARY.md`;
- root `AGENTS.md`;
- the full cross-document consistency audit and revisions.
