# PHASE Glossary

**Document role:** Canonical terminology and status guide  
**Run:** 8 of the PHASE Project Bible documentation plan  
**Authority:** Normalizes language; does not resolve entries marked unresolved  
**Last updated:** 2026-08-02

---

## 1. Usage rules

1. Use the **preferred term** in code, documentation, UI, and discussion unless a context explicitly requires a synonym.
2. Do not create new proper nouns for unresolved concepts merely to make implementation easier.
3. Preserve distinctions between musical time, route progress, world time, and render time.
4. Preserve distinctions between objective canon, institutional knowledge, belief, and community theory.
5. Capitalization is meaningful for named systems and institutions.
6. An entry marked **UNRESOLVED** is a warning, not an invitation to select an answer silently.

### Status

| Status | Meaning |
|---|---|
| **CANONICAL** | Preferred current term with established meaning. |
| **PROVISIONAL** | Safe working term; exact definition remains open. |
| **UNRESOLVED** | Multiple meanings or an undecided name. |
| **EXPLORATORY** | Brainstormed possibility, not current canon. |
| **DEPRECATED** | Do not use as the current preferred term. |

---

## 2. Product and documentation

### AGENTS.md

**Status:** CANONICAL

Root instruction file telling coding agents how to interpret and work with the Project Bible and repository.

### Canon

**Status:** CANONICAL

Creator-established fictional or product truth. Canon is distinct from an in-world belief, an implementation detail, or a brainstorm.

### Current implementation

**Status:** CANONICAL

What the repository actually does now, established through source inspection and tests. It does not automatically define intended behavior.

### Decision record

**Status:** CANONICAL

A numbered entry in `DECISIONS.md` recording a selected architectural or creative decision, rationale, and consequences.

### PHASE

**Status:** CANONICAL as current product/project identifier; final public/in-world meaning **UNRESOLVED**

Always uppercase. The audiovisual game/instrument/ambient-focus project being developed.

Do not use PHASE as the catastrophe, planet, or MTC without a later decision.

### Project Bible

**Status:** CANONICAL

The governing documentation package consisting of root `AGENTS.md` and the Markdown files under `/docs`.

### Target behavior

**Status:** CANONICAL

Documented intended behavior. It may differ from current implementation.

---

## 3. Status and truth terminology

### Locked / Canon

**Status:** CANONICAL

Explicitly selected or repeatedly affirmed material that must not be casually contradicted.

### Planned

**Status:** CANONICAL

Intended direction whose implementation, scope, or details remain open.

### Exploratory

**Status:** CANONICAL

Brainstormed possibility that has not been adopted.

### Unresolved

**Status:** CANONICAL

A decision the available evidence cannot safely settle.

### Superseded / Rejected

**Status:** CANONICAL

Material explicitly replaced or ruled out as the current direction.

### Objective canon

**Status:** CANONICAL

What is true in the fictional world according to the creator.

### In-world knowledge

**Status:** CANONICAL

What inhabitants reliably observe or institutions accept. It may still be an incomplete model.

### In-world belief / folklore

**Status:** CANONICAL

What people believe, theorize, ritualize, or repeat without objective confirmation.

### Creator-unresolved

**Status:** CANONICAL

An answer not yet selected outside the fiction. Characters may hold beliefs about it, but documentation must not promote one to truth.

---

## 4. World and history

### Earth

**Status:** CANONICAL

The planet on which PHASE is set, approximately 130 years after extraterrestrial arrival/contact.

### Kashmer-Alterra

**Status:** UNRESOLVED

Working label for the fictional setting/worldbuilding corpus. Not a canonical replacement name for Earth or a locked final title.

### Arrival / contact

**Status:** PROVISIONAL

The extraterrestrial event associated with the first Zones. “Arrival” and “contact” are deliberately neutral because landing, invasion, and communication are unresolved.

### The Convergence

**Status:** UNRESOLVED

Strong working name for the catastrophe/ongoing transformation. Not yet the locked official or colloquial name.

### Persistent Harmonic Convergence Event (PHCE)

**Status:** EXPLORATORY

Proposed scientific designation. Do not use as established canon.

### Zone

**Status:** CANONICAL at concept level

An area deeply affected by the post-arrival transformation.

Do not use automatically as a synonym for region, settlement, destination, or level.

### Region

**Status:** PROVISIONAL

A possible geographic/system grouping of destinations and routes. Exact ontology remains unresolved.

### Destination

**Status:** PROVISIONAL / PLANNED

A place from which a Navigator may depart or at which they may arrive.

### Settlement / hub / offshoot

**Status:** UNRESOLVED

Possible categories of human habitation. Their distinctions are not established.

### Transformation

**Status:** CANONICAL

Neutral term for post-arrival alteration of matter, biology, weather, and possibly space/time.

### Convergence

**Status:** CANONICAL as a creative concept, not necessarily a proper noun

The principle that altered things become new configurations rather than simply decaying.

### Corruption

**Status:** DEPRECATED as a universal description

May describe a character’s interpretation or specific failure, but must not define all transformation as moral decay.

---

## 5. Institution and vocation

### Meridian Transit Corporation

**Status:** CANONICAL

The necessary, broadly benevolent transit institution maintaining much of humanity’s long-distance continuity.

First mention should use the full name followed by `(MTC)`.

### MTC

**Status:** CANONICAL

Abbreviation for Meridian Transit Corporation.

### Meridian / Transit

**Status:** PROVISIONAL as colloquial institution names

Possible everyday short forms for MTC.

### Navigator

**Status:** CANONICAL

The in-world vocation for a person trained to perform glider transit through altered atmospheric/harmonic conditions.

Preferred over **pilot**.

### Pilot

**Status:** DEPRECATED as the preferred in-world term

Allowed as plain-language explanatory shorthand or when referring specifically to conventional aircraft operation.

### Attuned

**Status:** DEPRECATED / NOT SELECTED

Assistant-proposed vocation name. Do not use as the canonical profession.

### Meridian

**Status:** UNRESOLVED beyond MTC naming

May refer to:

- MTC colloquially;
- a harmonic alignment/corridor;
- a transformed or recognized state of exceptional Navigator mastery.

Do not implement as an ordinary rank.

### Master Meridian / High Meridian

**Status:** EXPLORATORY

Brainstormed titles, not canon.

### Calibration

**Status:** PROVISIONAL

Technical/perceptual preparation through which a Navigator aligns body, attention, instrumentation, and route conditions.

### Scientific spirituality

**Status:** CANONICAL creative principle

Awe, reverence, and ritual arising around real observation and consequential technical practice without requiring objective religious truth.

### Sacred utility

**Status:** CANONICAL creative principle

Objects and practices become sacred because civilization depends on their correct use, care, and continuity.

---

## 6. Transit and navigation

### Transit

**Status:** CANONICAL

The system term for a playable journey from origin to destination that is itself a long-form audiovisual composition.

### Crossing

**Status:** CANONICAL experiential synonym

Natural-language term emphasizing the journey’s duration, difficulty, and human meaning.

### Route

**Status:** CANONICAL / PLANNED

A persistent navigable relationship between two destinations, defining a family of transit experiences.

### Corridor

**Status:** PROVISIONAL

A safe, stable, or traversable atmospheric/harmonic path. Exact physical and geographic relationship to a route is unresolved.

### Harmonic corridor

**Status:** PROVISIONAL

Working term for a corridor shaped or made traversable by harmonic conditions.

### Route progress

**Status:** CANONICAL

Finite normalized progress through a transit, normally in `[0,1]`.

It is not wrapped rhythmic phase.

### Baseline duration

**Status:** PROVISIONAL

The route’s expected duration before current conditions and approved modifiers.

### Effective duration

**Status:** PROVISIONAL

The duration calculated for a particular transit after relevant authoritative conditions.

### Arrival

**Status:** CANONICAL

Completion of a transit at its destination through a designed state/formal transition.

Its exact relationship to Phase Zero is unresolved.

### Glider

**Status:** CANONICAL

The principal MTC transit craft family: quiet, efficient, working vehicles shaped by lift, endurance, currents/corridors, and institutional history.

### Airframe

**Status:** CANONICAL generic term

The physical structural craft, distinct from its instrumentation, harmonic systems, and configuration.

---

## 7. Weather and world state

### Weather

**Status:** CANONICAL / PLANNED

Persistent world-scale atmospheric conditions that affect routes, transit, audiovisual presentation, and planning.

### Forecast

**Status:** CANONICAL / PLANNED

An institutional prediction of future weather/route conditions with possible uncertainty.

### Harmonic Climate

**Status:** EXPLORATORY

Proposed umbrella term for weather plus altered harmonic conditions. Not the locked replacement for weather.

### Atmospheric Harmony

**Status:** EXPLORATORY

Alternative proposed umbrella term. Not canon.

### Harmonic stability

**Status:** PROVISIONAL

Possible forecast/world variable describing the reliability of harmonic transit conditions.

### Anomaly pressure

**Status:** EXPLORATORY

Candidate world-simulation variable. Do not present as established in-world science.

### Route closure

**Status:** CANONICAL / PLANNED

Temporary unavailability of a route due to weather, safety, maintenance, institution, or anomaly.

### Thermal Lift / Tail Resonance / Head Resonance / Silent Air / Dead Air / Harmonic Bloom / Standing Wave

**Status:** EXPLORATORY

Proposed named condition types. None is canon.

### Atmospheric memory

**Status:** EXPLORATORY in-world belief

The idea that exact recurring weather patterns are the atmosphere “remembering.” Neither the phenomenon nor explanation is locked.

---

## 8. Harmony, rhythm, and audio

### Rhythm authority

**Status:** CANONICAL

The single logical owner of authoritative musical position.

### Transport

**Status:** CANONICAL technical term

The musical control/state layer for start, pause, resume, stop, seek/reconstruction, and authoritative position.

Do not confuse with MTC transit.

### Musical position

**Status:** CANONICAL

Canonical position on the musical timeline.

### Phase

**Status:** CANONICAL

Normalized position within a repeating cycle.

### Wrapped phase

**Status:** CANONICAL

Repeating phase in `[0,1)`.

### Normalized progress

**Status:** CANONICAL

Unitless representation of position in a known interval. Use a semantic qualifier: voice phase, macro phase, or route progress.

### Voice

**Status:** CANONICAL

One repeating rhythmic/musical stream within a composition or Trigger Engine.

### Cycle

**Status:** CANONICAL

One complete traversal of a repeating rhythmic unit.

### Macro-cycle

**Status:** CANONICAL

The complete shared period after which all participating voices return to their defined starting relationship.

### Phase Zero

**Status:** CANONICAL

The exact semantic origin/closure boundary of a cycle; for the macro-cycle, the shared deterministic realignment point.

Capitalize both words.

### Note event

**Status:** CANONICAL

A deterministic musical event derived from rhythmic state and voice rules.

### Polyrhythm

**Status:** CANONICAL

Multiple repeating rhythmic relationships derived from one authoritative musical timeline.

### Composition definition

**Status:** CANONICAL technical concept

Versioned parameters sufficient to reproduce a composition’s musical structure.

### Audio scheduler

**Status:** CANONICAL technical concept

Subsystem scheduling authoritative future note events against the playback clock. It is not a second rhythm authority.

### Lookahead

**Status:** CANONICAL technical term

Scheduling events slightly before playback to tolerate runtime jitter.

### Determinism

**Status:** CANONICAL

Identical versioned inputs yield identical gameplay-relevant rhythmic/event outcomes.

### 432 Hz tuning reference

**Status:** CANONICAL intent; exact reference pitch **UNRESOLVED**

The centralized tuning rule. Safest engineering interpretation: A4 = 432 Hz pending confirmation.

Do not say “every note is 432 Hz.”

### Scale

**Status:** CANONICAL generic term

An ordered pitch collection defined independently from the tuning reference.

### Temperament

**Status:** UNRESOLVED

The pitch-interval system. Twelve-tone equal temperament is illustrative, not locked.

---

## 9. Trigger Engines and visuals

### Trigger Engine

**Status:** CANONICAL

A parameterized audiovisual component that expresses authoritative rhythmic state through sound and geometry.

Capitalize both words.

It does not own timing.

### Geometry

**Status:** CANONICAL

The spatial/visual representation of rhythmic relationships.

### Collision-derived triggering

**Status:** PROHIBITED

Using physics, rendered overlap, or geometric contact as the authoritative cause of a note.

### Event identity

**Status:** CANONICAL

Stable identity shared by audio and visual representations of the same musical event.

### Visual snapshot

**Status:** CANONICAL technical concept

Current renderable state derived from authoritative musical position and composition parameters.

### Chladni pattern/mode

**Status:** STRONG VISUAL DIRECTION

Nodal pattern produced by vibration modes; candidate for institutional/harmonic geometry.

### Lissajous curve

**Status:** STRONG VISUAL DIRECTION

Parametric curve expressing frequency/phase relationships; candidate for navigation and harmonic visuals.

### Standing-wave interference

**Status:** STRONG VISUAL DIRECTION

Visual/mathematical family for alignment, transit, and nodal fields.

### Fourier harmonic

**Status:** STRONG VISUAL DIRECTION

Frequency-component construction used as a truthful source of visual/audio form.

### Spherical harmonic

**Status:** STRONG VISUAL DIRECTION

Three-dimensional harmonic function suitable for field, cosmology, or anomaly language.

### Resonance Orbit / Node Alignment

**Status:** UNRESOLVED image-dependent labels

Names used during logo exploration. The missing images prevent canonical geometric definition.

---

## 10. Lore, anomalies, and knowledge

### Anomaly

**Status:** CANONICAL category

A manifestation of transformed reality that can be observed and may be partially classified without full explanation.

### Organism

**Status:** CANONICAL generic category

A life form altered by or arising under transformed conditions. No specific anomalous species is canon.

### Harmonic field / resonance field

**Status:** PROVISIONAL terminology family

Working descriptions for altered physical conditions related to harmony. Do not assume separate canonical phenomena.

### Artifact

**Status:** CANONICAL / PLANNED system term

A rare old MTC object whose meaning comes from provenance and custody rather than loot power.

### Provenance

**Status:** CANONICAL

The traceable history of an artifact, including holders, routes, events, and accumulated use.

### Archive

**Status:** PROVISIONAL / PLANNED

Institutional/community knowledge system containing records, observations, and theories.

### Observation

**Status:** CANONICAL knowledge class

A report of what was experienced or measured without asserting ultimate explanation.

### Interpretation

**Status:** CANONICAL knowledge class

A conclusion drawn from observations.

### Theory

**Status:** CANONICAL knowledge class

A speculative explanatory model not established as objective canon.

### Shared discovery

**Status:** EXPLORATORY

A community-wide finding confirmed by authoritative world/content rules.

---

## 11. Experience and social design

### Low-dopamine

**Status:** CANONICAL product principle

Progression and return motivation without constant reward bursts, coercive urgency, streaks, or manipulative FOMO.

### Foreground attention

**Status:** CANONICAL

Active engagement with route planning, rhythmic state, transmissions, conditions, and decisions.

### Peripheral attention

**Status:** CANONICAL

Intended background/focus use in which PHASE remains coherent while the player works, studies, rests, or listens.

### Re-entry

**Status:** CANONICAL design concept

The player’s return from peripheral to focused attention with enough persistent context to understand what changed.

### Joint solitude

**Status:** CANONICAL social-emotional principle

Feeling connected to others through traces, shared conditions, records, and stewardship while preserving individual solitude.

### Presence

**Status:** EXPLORATORY

Subtle indication of other players at destinations or on routes.

### World event

**Status:** EXPLORATORY / LONG-TERM

Authoritative temporary condition or occurrence affecting multiple players.

### Living world

**Status:** CANONICAL product principle

A world whose conditions continue independently of an individual player.

---

## 12. Visual-direction terminology

### Ancient future

**Status:** CANONICAL creative principle

Advanced technology that has existed long enough to accumulate history, tradition, repair, and ritual.

### Industrial mysticism

**Status:** CANONICAL creative principle

Engineering and institutional practice acquiring mystical weight while remaining tied to real function.

### Institutional archaeology

**Status:** CANONICAL creative principle

Identity expressed through accumulated markings, manuals, seals, equipment, repairs, and historical layers rather than contemporary branding alone.

### Beautiful horror

**Status:** CANONICAL creative principle

Horror in which beauty is part of the attraction and danger.

### Daylight horror

**Status:** CANONICAL creative principle

Fear created by clearly visible phenomena, not dependence on concealment or darkness.

### Rugged humanity

**Status:** CANONICAL creative principle

Visible evidence of work, fatigue, repair, fit, customization, and care within advanced systems.

### Working mystic

**Status:** CANONICAL visual-direction shorthand

A Navigator whose apparent ritual and sacred presence emerge from real mastery and working practice, not fantasy-priest costume.

### Monumental restraint

**Status:** CANONICAL visual principle

Scale expressed through negative space, horizon, patience, and controlled detail.

### Frutiger Aero influence

**Status:** SELECTIVE REFERENCE

Green-blue-white environmental optimism, air/water/curvature, transformed through age and catastrophe. Not a nostalgic UI style mandate.

---

## 13. Deprecated and prohibited term summary

| Avoid | Use instead / note |
|---|---|
| pilot as default vocation | Navigator |
| Attuned as profession | Navigator |
| Meridian as ordinary rank | unresolved rare state/meaning |
| Kashmer-Alterra as planet | Earth; Kashmer-Alterra is working setting label |
| corruption as universal world process | transformation/convergence |
| every note is 432 Hz | centralized 432 Hz tuning reference |
| Trigger Engine clock | central rhythm authority |
| collision triggers note | rhythm event drives audio and visual |
| weather owns tempo | approved composition modulation |
| random artifact loot | artifact provenance/stewardship |
| player wiki is canon | observation/theory with authority class |
| harmonic climate as established term | weather; label remains exploratory |
| uncaptured route | untraversed, unknown, locked, or unavailable as appropriate |

---

## 14. Run boundary

This glossary normalizes terminology for the current Project Bible. It does not resolve open naming, lore, tuning, progression, or visual decisions.

