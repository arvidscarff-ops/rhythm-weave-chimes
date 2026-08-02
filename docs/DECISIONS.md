# PHASE Decisions

**Document role:** Permanent architectural and creative decision memory  
**Run:** 7 of the PHASE Project Bible documentation plan  
**Authority:** Accepted decisions outrank general target descriptions where they directly conflict; unresolved items are not decisions  
**Last updated:** 2026-08-02

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
