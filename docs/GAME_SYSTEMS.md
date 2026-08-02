# PHASE Game Systems

**Document role:** Game-systems bible  
**Run:** 4 of the PHASE Project Bible documentation plan  
**Authority:** Target mechanical intent, subordinate to locked canon in `CONTEXT_INDEX.md` and timing invariants in `AUDIO_RHYTHM_ARCHITECTURE.md`  
**Evidence boundary:** Describes intended behavior and maturity; it does not claim that systems are implemented  
**Last updated:** 2026-08-02

---

## 1. Purpose

This document translates PHASE’s creative vision into a coherent set of game systems without pretending that every brainstorm is a commitment.

The systems must serve one central experience:

> **The player plans and performs long audiovisual transits through a persistent, transformed world, gradually becoming more capable of perceiving, navigating, and carrying continuity across it.**

PHASE is both active and ambient. Its mechanics must therefore create meaningful decisions without requiring constant intervention. They should reward attention but remain coherent when attention moves elsewhere.

---

## 2. Maturity labels

Every major system uses one of these labels.

| Label | Meaning |
|---|---|
| **LOCKED — CORE** | Foundational to PHASE’s identity. Removing it would change what the project is. |
| **PLANNED — CORE** | Strongly intended and structurally important, but exact rules remain open. |
| **PLANNED — SUPPORTING** | Intended to enrich the core once foundations are proven. |
| **EXPLORATORY — LATER** | Promising future direction, not a present commitment. |
| **UNRESOLVED** | Required decision or contradiction remains open. |
| **REJECTED / SUPERSEDED** | Not the current direction. |

### Delivery horizons

Maturity and delivery are separate.

| Horizon | Meaning |
|---|---|
| **PROTOTYPE** | Needed to prove one crossing. |
| **VERTICAL SLICE** | Needed to demonstrate a coherent playable chapter. |
| **FOUNDATION** | Needed before substantial scaling. |
| **POST-SLICE** | Valuable after the crossing and product loop work. |
| **LONG-TERM** | Large-scope future system. |

---

## 3. System map

```text
Persistent World State
  weather · conditions · route status · time
                         │
                         ▼
                   Forecast System
                         │
                         ▼
Player / Navigator ── Route Planning ── Destination Network
        │                    │
        │                    ▼
        │              Transit Instance
        │        route · duration · environment
        │                    │
        ├──────────────┬─────┼──────────────┐
        ▼              ▼     ▼              ▼
   Glider State    Rhythm  Transmissions  Encounters
   equipment       Engine  and narrative  and anomalies
        │              │     │              │
        └──────────────┴─────┴──────────────┘
                         │
                         ▼
                       Arrival
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     Progression     World record    New choices
     and mastery     / archive       and routes
```

Social, artifact, persistence, and account systems connect across this loop but must not become prerequisites for proving the crossing itself.

---

## 4. Core gameplay loop

**Maturity:** **LOCKED — CORE**  
**Earliest horizon:** **PROTOTYPE**

### 4.1 Loop

1. **Observe**
   - Inspect current conditions, route availability, forecasts, and destination context.

2. **Choose**
   - Select a destination and route appropriate to the Navigator’s access, glider capability, available time, desired audiovisual experience, and current world state.

3. **Prepare**
   - Configure permitted glider, instrumentation, sound, or loadout choices.
   - Understand expected duration and risk.

4. **Depart**
   - Commit to a transit under a specific snapshot or schedule of world conditions.

5. **Cross**
   - Inhabit a long audiovisual composition.
   - Attend actively, use PHASE peripherally, or move between the two.
   - Read the environment, rhythm, route progress, transmissions, and significant changes.

6. **Arrive**
   - Reach the destination through a designed formal and emotional conclusion.

7. **Integrate**
   - Record the crossing.
   - Receive narrative, progression, access, knowledge, stewardship, or world consequences.

8. **Continue**
   - Decide whether to remain, prepare another route, wait for conditions, inspect the archive, or leave the world running in a lower-attention state.

### 4.2 What the loop is not

- a short mission repeated for currency;
- a timer that rewards the player for leaving it alone;
- a sequence of menus surrounding a passive video;
- a reflex challenge;
- a loot treadmill;
- an obligation to log in at fixed intervals;
- a conventional transport-management economy unless later deliberately chosen.

### 4.3 Success criterion

The core loop succeeds if completing one crossing makes the player want to undertake another because:

- the composition was worth inhabiting;
- the world changed meaningfully;
- the destination matters;
- another route feels distinct;
- the player learned something;
- the player cares about continuity.

---

## 5. Transit system

**Maturity:** **LOCKED — CORE**  
**Earliest horizon:** **PROTOTYPE**

### 5.1 Definition

A **transit** is one playable journey from an origin to a destination.

It is simultaneously:

- a route traversal;
- a long-form audiovisual composition;
- a period of world time;
- a container for transmissions and environmental change;
- an expression of current weather;
- an opportunity for discovery;
- a record in the Navigator’s history.

### 5.2 Required transit properties

Each transit must have:

- stable identity;
- origin;
- destination;
- route identity;
- expected duration;
- effective duration;
- start time;
- world/forecast context;
- glider state;
- composition definition/version;
- route progress;
- environmental state;
- arrival rule;
- persistence policy;
- outcome.

### 5.3 Transit state machine

Recommended semantic states:

```text
AVAILABLE
   ↓
PLANNED
   ↓
PREPARING
   ↓
DEPARTING
   ↓
IN_TRANSIT
   ├── INTERRUPTED?  [UNRESOLVED]
   ├── FAILED?       [UNRESOLVED]
   ↓
ARRIVING
   ↓
COMPLETE
```

Additional states such as cancelled, diverted, suspended, or lost remain unresolved.

### 5.4 Transit duration

**Maturity:** **PLANNED — CORE**

Long duration is intentional. The exact range is not locked.

Conversation examples include:

- 10–20 minutes for a first proof;
- 45–90 minutes for long focus-oriented crossings.

These are design ranges, not final content rules.

Duration may depend on:

- route baseline;
- glider capability;
- world/weather conditions;
- later progression;
- route closures or detours;
- formal composition design.

The authoritative relationship between duration and musical time is defined as unresolved in `AUDIO_RHYTHM_ARCHITECTURE.md`.

### 5.5 Attention modes

**Maturity:** **LOCKED — CORE** as a product principle; exact rules **UNRESOLVED**

Transit must support:

- close observation;
- intermittent interaction;
- peripheral/background use.

The game may adjust presentation or optional interaction density, but must not create two unrelated worlds or musical systems.

### 5.6 Pause, resume, and absence

**Maturity:** **UNRESOLVED**

Open questions:

- Can the player pause a transit?
- Does musical time pause while world weather continues?
- Does the transit continue when the application is backgrounded?
- Can a suspended session be resumed hours later?
- Are some routes designated as safe for ambient use?
- What happens if a device sleeps?

Any answer must respect:

- the player’s invested time;
- persistent world state;
- deterministic musical reconstruction;
- low-dopamine/focus use.

### 5.7 Failure and death

**Maturity:** **UNRESOLVED**

Danger is part of the fiction. A punishing failure/death system is not yet canon.

Rejected as canon:

- a fixed 20% chance of death on every transit;
- arbitrary failure that invalidates a long focus session;
- high stakes used solely to justify a lucrative economy.

Possible later forms of consequence:

- route diversion;
- damage;
- lost opportunity;
- incomplete delivery;
- reduced information;
- altered arrival;
- recovery requirement;
- rare catastrophic loss.

No model is selected.

### 5.8 Transit output

On completion, the system may record:

- origin/destination;
- route;
- start/arrival time;
- expected/effective duration;
- conditions;
- composition/version;
- notable transmissions;
- encounters;
- glider state;
- progression effects;
- artifacts carried;
- public/private route report;
- deterministic seed where appropriate.

The exact data model belongs to implementation planning.

---

## 6. Routes

**Maturity:** **PLANNED — CORE**  
**Earliest horizon:** **VERTICAL SLICE**

### 6.1 Definition

A route is a persistent navigable relationship between two destinations.

A route is not only a line on a map. It defines a family of transit experiences.

### 6.2 Route properties

Conceptually:

```ts
type RouteDefinition = {
  id: string
  originId: string
  destinationId: string
  baselineDuration: number
  accessRequirements: AccessRule[]
  environmentProfileId: string
  compositionProfileId: string
  weatherSensitivity: WeatherSensitivity
  transmissionPools: string[]
  encounterProfileId?: string
  statusRules: RouteStatusRule[]
  version: number
}
```

This is illustrative, not a locked schema.

### 6.3 Route differentiation

Routes should differ through combinations of:

- duration;
- altitude;
- expected cloud/weather behavior;
- visible biome or geography;
- harmonic profile;
- Trigger Engine/compositional identity;
- destination narrative;
- transmissions;
- risk and closure sensitivity;
- glider requirements;
- anomaly potential;
- time-of-day experience.

### 6.4 Route availability

**Maturity:** **PLANNED — CORE**

Routes may be:

- open;
- restricted;
- forecast to close;
- closed;
- conditionally passable;
- newly revealed;
- unavailable to the current Navigator/glider.

The authoritative reason for status must be inspectable. The player should be able to distinguish:

- world conditions;
- access/progression restrictions;
- maintenance/institutional closure;
- narrative lock;
- temporary anomaly;
- technical unavailability.

### 6.5 Route discovery

**Maturity:** **PLANNED — SUPPORTING**

Routes may become available through:

- reaching destinations;
- increased Navigator capability;
- glider upgrades;
- institutional authorization;
- narrative progression;
- forecast conditions;
- discovery of hidden/temporary corridors.

Hidden corridors tied to special atmospheric phenomena remain **EXPLORATORY — LATER**.

### 6.6 Uncaptured route language

Earlier conversation used “uncaptured transit route.” That term is not normalized.

Possible meanings:

- not yet traversed;
- not yet mapped;
- not unlocked;
- not documented;
- not stabilized.

Use **untraversed**, **unknown**, **locked**, or **unavailable** until a specific mechanic is chosen.

---

## 7. Destinations, regions, Zones, and world graph

### 7.1 Destinations

**Maturity:** **PLANNED — CORE**  
**Earliest horizon:** **VERTICAL SLICE**

A destination is a place the player can depart from or arrive at.

It should provide enough identity to make travel meaningful:

- name and location;
- environmental character;
- route connections;
- MTC presence;
- people/transmissions;
- narrative context;
- local interface/menu atmosphere;
- relevant weather;
- future opportunities.

### 7.2 Regions

**Maturity:** **PLANNED — SUPPORTING**

Regions may group destinations and routes for:

- weather simulation;
- narrative chapters;
- environmental profiles;
- route planning;
- progression.

Their exact ontology is unresolved.

### 7.3 Zones

**Maturity:** **LOCKED — CORE** as lore; mechanical role **UNRESOLVED**

A Zone is an area altered by the extraterrestrial/post-arrival phenomenon.

It must not automatically be used as a synonym for:

- safe region;
- city;
- destination;
- level;
- weather cell.

The world bible must settle the geographic vocabulary before production data is normalized.

### 7.4 World graph

**Maturity:** **PLANNED — CORE**

PHASE’s navigable world should be modeled as a graph:

- nodes: destinations;
- edges: routes;
- regional/world systems: weather, conditions, progression, narrative.

This supports:

- closures;
- detours;
- forecasts;
- route discovery;
- shared world state;
- content authoring.

### 7.5 Scale

**Maturity:** **EXPLORATORY — LATER**

Ideas such as approximately 40 regions/Zones, numerous temporary settlements, and 20–30 routes are not locked targets.

The product should scale from one exceptional crossing, not begin by committing to a world map too large to populate.

---

## 8. Navigator system

**Maturity:** **LOCKED — CORE** as player identity; progression details **UNRESOLVED**

### 8.1 Player role

The player is a **Navigator**, not merely a pilot.

Navigators:

- operate glider transits;
- read conditions ordinary people may not perceive;
- maintain coherence through harmonic corridors;
- follow trained calibration practices;
- carry civilizational responsibility;
- accumulate mastery and institutional trust.

### 8.2 Competency model

**Maturity:** **PLANNED — CORE**

Navigator growth should reflect:

- perception;
- route knowledge;
- forecast literacy;
- harmonic control;
- glider familiarity;
- compositional access;
- steadiness;
- institutional responsibility;
- anomaly recognition.

### 8.3 Navigator progression

**Maturity:** **PLANNED — CORE**

Progression should change what the player can perceive and experience, not only numerical output.

Potential progression axes:

- experience/history;
- route mastery;
- harmonic perception;
- equipment authorization;
- sound/voice access;
- visual instrumentation;
- destination access;
- MTC trust;
- anomaly knowledge;
- stewardship.

The exact number of axes and their UI are unresolved.

### 8.4 Ranks

**Maturity:** **UNRESOLVED**

Do not implement the exploratory ladder:

```text
Cadet → Apprentice Navigator → Navigator → Senior Navigator
→ First Navigator → Meridian
```

unless explicitly selected.

Ranks may exist independently of the meaning of **Meridian**.

### 8.5 Navigator selection and ability

**Maturity:** **UNRESOLVED**

Open:

- innate sensitivity;
- childhood testing;
- training accessibility;
- technology dependence;
- meditation/calibration;
- pharmacology;
- bodily transformation;
- distinction between ordinary Navigator and Meridian.

Generic magic-user mechanics are rejected.

---

## 9. Meridian progression/state

**Maturity:** **UNRESOLVED**

“Meridian” may describe:

- MTC shorthand;
- a corridor/reference phenomenon;
- a state an exceptional Navigator becomes;
- a title recognized rather than formally awarded;
- a transformed perceptual/physical condition.

### 9.1 Safe current rule

Do not treat Meridian as an ordinary level or job class.

### 9.2 If Meridian becomes a player endpoint

Any future design should emphasize:

- transformation rather than promotion;
- perception rather than raw power;
- responsibility rather than status loot;
- recognition rather than a progress-bar ding;
- subtle physical and behavioral consequences;
- ambiguity between technical mastery and altered humanity.

These are direction constraints, not confirmation that the player becomes Meridian.

---

## 10. Glider system

**Maturity:** **PLANNED — CORE**  
**Earliest horizon:** **PROTOTYPE**

### 10.1 Role

The glider is:

- the player’s working craft;
- the physical context for transit;
- an evolving audiovisual instrument platform;
- a carrier of institutional and personal history;
- a progression surface;
- a visual symbol of civilization’s dependence on efficient crossing.

### 10.2 Required first-proof behavior

One prototype glider must provide:

- cockpit/POV context;
- readable route state;
- space for Trigger Engine/harmonic instrumentation;
- environmental visibility;
- a coherent sound bed;
- enough identity to make departure and arrival tangible.

### 10.3 Glider properties

Potential categories:

- airframe;
- harmonic/navigation system;
- instrumentation;
- environmental shielding;
- structural condition;
- handling;
- cargo/data/passenger capacity;
- audiovisual modules;
- authorization class.

No final stat model is selected.

### 10.4 Equipment and upgrades

**Maturity:** **PLANNED — CORE**

Upgrades may affect:

- route access;
- condition tolerance;
- information quality;
- compositional complexity;
- sound layers;
- visual geometry;
- cockpit instrumentation;
- anomaly perception;
- reliability.

Equipment should not become a generic inventory of incremental percentage bonuses.

### 10.5 Audiovisual progression

**Maturity:** **PLANNED — CORE**

An experienced Navigator’s crossing should be richer than a beginner’s:

- more nuanced instrumentation;
- additional voices/layers;
- expanded sound palette;
- richer geometry;
- deeper environmental response;
- more legible advanced state.

Early PHASE must still be beautiful and musically complete. Progression deepens the work; it does not hold quality hostage.

### 10.6 Glider families

**Maturity:** **EXPLORATORY — LATER**

Courier, cargo, standard transit, high-altitude, and ancient airframe families are promising but not selected.

### 10.7 Damage and maintenance

**Maturity:** **UNRESOLVED**

The fiction strongly supports repair and maintenance, but no mechanical loop is established.

Avoid adding maintenance as repetitive resource drain unless it creates meaningful care, preparation, or history.

---

## 11. Trigger Engines as a game system

**Maturity:** **LOCKED — CORE**  
**Earliest horizon:** **PROTOTYPE**

The technical contract lives in `AUDIO_RHYTHM_ARCHITECTURE.md`.

### 11.1 Player-facing function

Trigger Engines should make harmonic/rhythmic state:

- visible;
- audible;
- learnable;
- expressive;
- situated within transit.

### 11.2 Interaction

**Maturity:** **UNRESOLVED**

Possible interaction families:

- selecting a composition profile;
- choosing voices/sounds;
- setting bounded parameters;
- responding to route state;
- reading rather than directly manipulating;
- unlocking advanced geometry;
- authoring engines in a distant future.

PHASE is not committed to freeform sequencing.

### 11.3 Progression

**Maturity:** **PLANNED — CORE**

Progression may unlock:

- sound packs;
- voices;
- bass or lower-register layers;
- visual sophistication;
- environmental mappings;
- new Trigger Engine forms.

Exploratory three-color skill-tree concepts remain non-canon.

### 11.4 User-created Trigger Engines

**Maturity:** **EXPLORATORY — LATER**

Any authoring system must enforce:

- central timing authority;
- normalized phase;
- deterministic closure;
- collision prohibition;
- performance limits;
- moderation/IP boundaries if shared.

---

## 12. Weather and forecast system

**Maturity:** **PLANNED — CORE**  
**Earliest meaningful horizon:** simple preset in **PROTOTYPE**, authoritative simulation in **FOUNDATION/POST-SLICE**

### 12.1 Core premise

One persistent world-scale weather system affects regions and routes whether or not a given player is online.

Weather is not cosmetic. It may influence:

- route availability;
- expected/effective transit duration;
- danger;
- visibility;
- clouds and lighting;
- audio atmosphere;
- harmonic density;
- Trigger Engine/compositional behavior;
- anomalies;
- planning.

### 12.2 Authoritative world state

**Maturity:** **PLANNED — CORE**

Shared gameplay-relevant conditions should come from one authoritative simulation, not independent browser randomness.

The first credible model should remain deliberately simple:

- region graph;
- weather fronts/states;
- scheduled transitions;
- bounded variables;
- forecast uncertainty;
- historical snapshots.

Full fluid meteorology is not required.

### 12.3 Forecasts

**Maturity:** **PLANNED — CORE**

The forecast interface should let a player plan around future conditions.

Possible fields:

- wind direction/strength;
- precipitation;
- visibility;
- route stability;
- expected duration modifier;
- closure probability;
- anomaly/condition advisory.

The final terminology must distinguish ordinary meteorology from unresolved harmonic phenomena.

### 12.4 Forecast uncertainty

**Maturity:** **PLANNED — SUPPORTING**

Forecasts may be imperfect without being arbitrary.

Potential variables:

- lead time;
- regional instrumentation;
- Navigator expertise;
- anomaly interference;
- institutional confidence.

Uncertainty should create planning, not conceal random punishment.

### 12.5 Route closures

**Maturity:** **PLANNED — CORE**

Closures must:

- arise from world or institutional state;
- be forecast where plausible;
- explain their category;
- update consistently for all players;
- support alternatives where the world graph permits;
- avoid manipulative FOMO.

### 12.6 Weather-to-composition mapping

**Maturity:** **UNRESOLVED**

Weather must not directly own tempo.

Candidate effects include:

- duration/form mapping;
- quantized tempo states;
- orchestration;
- density;
- effects;
- geometry;
- anomaly probability.

The final contract must be chosen in `AUDIO_RHYTHM_ARCHITECTURE.md` and recorded in `DECISIONS.md`.

### 12.7 Named harmonic weather

**Maturity:** **EXPLORATORY — LATER**

Not yet canon:

- Thermal Lift;
- Tail Resonance;
- Head Resonance;
- Silent Air;
- Dead Air;
- Harmonic Bloom;
- Standing Wave;
- atmospheric memory/repeated weather.

These may later become authored condition types after the base weather loop works.

---

## 13. Environmental transit system

**Maturity:** **PLANNED — CORE**  
**Earliest horizon:** **PROTOTYPE**

### 13.1 Purpose

The transit backdrop should be a living environment, not a static wallpaper.

Inputs may include:

- route;
- altitude;
- direction;
- time of day;
- region/biome below;
- cloud type and density;
- precipitation;
- visibility;
- wind/turbulence;
- harmonic/anomaly state;
- transit progress.

### 13.2 Content model

Preferred long-term direction:

- one reusable procedural or hybrid sky/environment system;
- parameterized route identities;
- world simulation drives visible conditions;
- rare authored sequences layered into the system.

Rejected as the default:

- one fixed 45–90 minute video for every route;
- weather UI that contradicts prerecorded scenery.

### 13.3 Repetition

Exact non-repetition is not required.

The goal is that repeated transits feel meaningfully conditioned by:

- time;
- weather;
- route;
- progression;
- transmissions;
- rare events.

### 13.4 Technical status

Renderer choice, performance budget, and browser/native strategy remain **UNRESOLVED**.

---

## 14. Narrative transmission system

**Maturity:** **PLANNED — CORE**  
**Earliest horizon:** **PROTOTYPE**

### 14.1 Purpose

Transmissions carry human context through the crossing.

They should make the world feel:

- operational;
- inhabited;
- connected;
- partially knowable;
- emotionally specific.

### 14.2 Content classes

Planned classes:

- routine operational communication;
- destination/local messages;
- maintenance and traffic;
- recurring characters;
- institutional announcements;
- personal/human moments;
- weather reports;
- anomaly reports;
- narrative fragments;
- rare revelations;
- extremely rare secrets.

### 14.3 Routine density

Most transmissions should be ordinary and professional.

This is a design requirement, not filler. Routine establishes:

- credibility;
- rhythm;
- normalcy;
- contrast;
- emotional attachment.

### 14.4 Fragment delivery

**Maturity:** **PLANNED — CORE**

Players may receive fragments in partly varied orders while retaining the same broad narrative truth.

Requirements:

- avoid contradictions;
- track heard/unheard state;
- respect prerequisites;
- distinguish repeatable ambience from unique narrative;
- support interruption/recovery;
- make rare material genuinely rare;
- preserve objective canon independently of delivery order.

### 14.5 Chapter structure

**Maturity:** **PLANNED — SUPPORTING**

Groups of destinations/routes may belong to narrative chapters.

Exact chapter count, sequencing, and endgame are unresolved.

### 14.6 Transmission interaction

**Maturity:** **UNRESOLVED**

Open:

- passive listening only;
- replay/log;
- response choices;
- branching;
- missed calls;
- language/subtitle system;
- voice versus text;
- background-use handling.

### 14.7 Narrative discipline

Player/community theory must not automatically become objective lore.

The system must eventually distinguish:

- what happened;
- what institutions believe;
- what characters believe;
- what players infer;
- what remains deliberately unknown.

---

## 15. Anomaly and encounter system

### 15.1 Anomalies

**Maturity:** **PLANNED — SUPPORTING**

Anomalies are rare or unusual manifestations of the transformed world.

They may affect:

- environment;
- sound;
- geometry;
- route state;
- transmissions;
- knowledge;
- future access;
- danger.

### 15.2 Encounter philosophy

An encounter should:

- emerge from world/route conditions;
- remain legible enough to learn from;
- avoid constant escalation;
- preserve beautiful horror;
- not become a generic combat encounter;
- produce observation, consequence, or story.

### 15.3 Anomaly probability

**Maturity:** **UNRESOLVED**

If probability is used, it should be:

- seeded/authoritative where gameplay-relevant;
- conditioned by world state;
- bounded;
- inspectable through logs;
- safe from reroll exploits where that matters.

### 15.4 Organisms

**Maturity:** **EXPLORATORY — LATER**

The proposed corridor-instability predator is not locked.

The broader existence of anomalous organisms is compatible with canon, but no bestiary or combat system is established.

### 15.5 Combat

**Maturity:** **UNRESOLVED / NOT PLANNED**

No conversation evidence establishes combat as a core mechanic.

Do not introduce weapons, health bars, or enemy waves by genre reflex.

---

## 16. Progression system

**Maturity:** **PLANNED — CORE**  
**Earliest horizon:** basic version in **VERTICAL SLICE**

### 16.1 Progression goals

Progression should:

- deepen perception;
- enrich the audiovisual experience;
- expand meaningful choice;
- unlock routes and responsibilities;
- express growing competency;
- preserve calm pacing;
- create personal history.

### 16.2 Progression domains

Potential domains:

1. **Navigator capability**
   - interpretation, route knowledge, forecast literacy.

2. **Glider capability**
   - instrumentation, access, reliability, environmental tolerance.

3. **Audiovisual vocabulary**
   - sounds, voices, geometry, layers, mappings.

4. **Institutional trust**
   - authorization, assignments, stewardship.

5. **World knowledge**
   - archive entries, anomaly understanding, narrative context.

6. **Destination relationships**
   - local familiarity, contacts, route access.

The final model may combine or reject domains.

### 16.3 Progression inputs

Potential sources:

- completed transits;
- first traversal of a route;
- safe operation in difficult conditions;
- narrative milestones;
- observation/discovery;
- stewardship;
- glider care;
- destination relationships.

Avoid progression based mainly on passive elapsed time.

### 16.4 Progression outputs

Potential outputs:

- access;
- information;
- new sound packs;
- additional voices;
- visual richness;
- improved forecasts;
- configuration options;
- glider modules;
- rare routes;
- deeper anomaly perception.

### 16.5 Levels

**Maturity:** **UNRESOLVED**

“Level 1 versus level 50” was illustrative. A conventional numeric level is not selected.

### 16.6 Skill trees/classes

**Maturity:** **EXPLORATORY — LATER**

Colored red/white/green trees and related audiovisual identities are not canon.

If paths are later adopted, each must represent:

- a coherent philosophy;
- an audiovisual language;
- meaningful tradeoffs;
- world logic;

not only palette swaps.

### 16.7 Pacing

Progression should be slow enough to support attachment, but never designed to make the initial experience intentionally weak.

---

## 17. Rewards and economy

### 17.1 Reward philosophy

**Maturity:** **LOCKED — CORE** as a principle

Rewards should emphasize:

- access;
- expression;
- knowledge;
- history;
- responsibility;
- beauty;
- connection.

### 17.2 Currencies

**Maturity:** **UNRESOLVED**

No currency model is established.

Do not add multiple currencies, rarity tiers, crafting materials, or daily tokens without a clear product reason.

### 17.3 Money and contracts

**Maturity:** **EXPLORATORY**

The earlier high-pay/high-death courier economy is not canon.

The world does require necessary transit work. Compensation, assignment, duty, public service, and personal motivation remain open.

### 17.4 Loot

**Maturity:** **NOT PLANNED**

Randomized loot is not a core direction.

Artifacts with provenance are explicitly different from loot drops.

---

## 18. Artifact inheritance system

**Maturity:** **PLANNED — SUPPORTING**  
**Earliest horizon:** **POST-SLICE**

### 18.1 Purpose

Artifacts create connection through custody across time.

They embody:

- continuity;
- institutional history;
- player provenance;
- joint solitude;
- responsibility;
- community memory.

### 18.2 Artifact record

Potential record:

```ts
type Artifact = {
  id: string
  typeId: string
  createdAtWorldDate?: string
  currentHolderId: string
  provenance: TransferRecord[]
  transitHistory: TransitReference[]
  aggregateDistance?: number
  visitedDestinationIds?: string[]
  notableEventIds?: string[]
  physicalStateVersion?: number
}
```

Illustrative only.

### 18.3 Stewardship loop

1. A player receives custody through an unknown or authored rule.
2. The artifact accompanies one or more meaningful milestones.
3. Its history accumulates.
4. The holder eventually chooses or authorizes a successor.
5. Custody transfers permanently or semi-permanently.

### 18.4 Unresolved rules

- selection;
- rarity;
- transfer eligibility;
- timing;
- reward;
- loss;
- inactive holder recovery;
- abuse prevention;
- privacy;
- naming/messages;
- whether recipients can decline;
- whether provenance can be hidden;
- whether an artifact physically changes.

### 18.5 Rejected form

Do not implement “3 in 100 new players get a random powerful item” as the default design.

Mystery, provenance, and stewardship are more important than published rarity odds or power.

---

## 19. Archive, knowledge, and community lore

**Maturity:** **PLANNED — SUPPORTING**  
**Earliest horizon:** **POST-SLICE**

### 19.1 Archive purpose

The archive may contain:

- anomaly observations;
- route history;
- weather records;
- destination knowledge;
- artifact provenance;
- transmissions;
- theories;
- institutional records;
- player reports.

### 19.2 Knowledge classes

The data model must distinguish:

- **canonical record** — authored objective or institutional content;
- **observation** — a player reports what they experienced;
- **interpretation** — a conclusion drawn from evidence;
- **theory** — speculation;
- **disputed** — conflicting accounts;
- **unknown** — insufficient evidence.

### 19.3 Empty native wiki

**Maturity:** **EXPLORATORY — LATER**

A player-filled archive is promising, but a literally empty wiki creates:

- moderation;
- quality;
- discoverability;
- griefing;
- misinformation;
- canon-authority problems.

A structured observation system may be safer than unrestricted pages.

### 19.4 Shared discovery

**Maturity:** **EXPLORATORY — LATER**

Community-wide discoveries should require:

- authoritative triggers;
- contribution rules;
- anti-spoiler design;
- attribution;
- protection against data mining;
- a lasting record.

---

## 20. Social systems

### 20.1 Social north star

**Maturity:** **LOCKED — CORE** as a principle

Social design should create **joint solitude**.

### 20.2 Asynchronous social layer

**Maturity:** **PLANNED — SUPPORTING**

Strong candidates:

- route reports;
- artifact provenance;
- profiles;
- activity/history;
- archive contributions;
- forecasts;
- theories;
- asynchronous messages or traces.

### 20.3 Presence

**Maturity:** **EXPLORATORY — LATER**

Possible:

- number of Navigators at a destination;
- subtle indication that others are on a route;
- recent arrivals/departures.

Presence should remain slow-changing and nonintrusive.

### 20.4 Text chat

**Maturity:** **EXPLORATORY — LATER**

Potential contexts:

- destination;
- route;
- community forecasting.

Risks:

- moderation;
- harassment;
- noise;
- breaking solitude;
- FOMO;
- interface dominance.

### 20.5 Voice/radio

**Maturity:** **EXPLORATORY — LATER / LAST**

Open voice is not launch-critical.

If pursued, constrained voice notes or push-to-talk may fit better than always-on voice.

Required considerations:

- consent;
- moderation;
- recording;
- privacy;
- browser/mobile permission;
- audio ducking/mixing;
- interruption rules;
- accessibility.

### 20.6 Guilds/factions

**Maturity:** **NOT PLANNED**

No evidence makes guilds or player factions part of the core.

---

## 21. World events

**Maturity:** **EXPLORATORY — LATER**

Potential world events:

- rare weather fronts;
- route openings/closures;
- anomalous conditions;
- collective observation opportunities;
- temporary corridors;
- institutional operations;
- evolving narrative chapters.

### Requirements if implemented

- authoritative schedule/state;
- forecast or foreshadowing where appropriate;
- meaningful world consequence;
- no manipulative participation pressure;
- durable record after the event;
- graceful experience for absent players;
- no dependence on everyone being online simultaneously.

The world can move without punishing players for having lives.

---

## 22. Persistence

**Maturity:** **PLANNED — CORE**  
**Earliest horizon:** simple save in **VERTICAL SLICE**, full model in **FOUNDATION**

### 22.1 Persistent player data

Potentially:

- identity/profile;
- progression;
- destination/route access;
- completed transit history;
- glider state;
- configuration;
- narrative heard state;
- archive contributions;
- artifacts;
- settings;
- accessibility preferences.

### 22.2 Persistent world data

Potentially:

- world time;
- weather;
- route status;
- forecasts;
- world events;
- shared discoveries;
- artifact provenance;
- authoritative content versions.

### 22.3 Local versus server state

Shared or economically meaningful data must not rely only on client storage.

Purely personal presentation preferences may remain local.

### 22.4 Save compatibility

Version:

- content;
- routes;
- compositions;
- gliders;
- progression rules;
- world simulation;
- artifact records.

The system needs migration policies before long-term live operation.

### 22.5 Offline behavior

**Maturity:** **UNRESOLVED**

Open:

- can PHASE run offline;
- can an in-progress transit persist locally;
- which world data is cached;
- how conflicts resolve;
- whether background/focus functionality works without network.

---

## 23. Accounts and onboarding

### 23.1 Accounts

**Maturity:** **PLANNED — SUPPORTING**

Accounts will likely be required for:

- cross-device saves;
- provenance;
- profiles;
- community;
- authoritative progression;
- persistent world participation.

They are not required to prove one crossing.

### 23.2 Onboarding

**Maturity:** **PLANNED — CORE**

The ideal first experience should reach a crossing quickly.

Possible pattern:

1. enter without mandatory account;
2. experience first transit;
3. arrive;
4. explain persistence and invite account creation.

This is a strong roadmap suggestion, not a locked flow.

### 23.3 Account pressure

Avoid blocking the emotional proof behind registration unless persistence or safety makes it unavoidable.

### 23.4 Identity

**Maturity:** **UNRESOLVED**

Open:

- real name versus Navigator callsign;
- public/private profile fields;
- avatar;
- glider identity;
- display of history;
- privacy controls.

---

## 24. Authoring and administration

**Maturity:** **PLANNED — SUPPORTING**  
**Earliest horizon:** **FOUNDATION**

PHASE will require data-driven tools to scale.

Potential authoring domains:

- destinations;
- routes;
- route profiles;
- weather states;
- transmissions;
- narrative prerequisites;
- sound packs;
- Trigger Engine configurations;
- encounter tables;
- anomalies;
- glider modules;
- progression;
- world events.

### 24.1 My Studio/admin

The repository audit confirms an existing `/studio` area with pack, scale, scene, and Trigger Engine builder surfaces. It includes a mixture of Supabase-backed data, server functions, browser-local configuration, preview/audition behavior, and publishing controls.

Its production reliability, authorization model, content-version contract, preview/runtime equivalence, and architectural compliance are not yet established.

During Reset / PHASE 2.0, My Studio is a private owner/developer tool. It should provide:

- sound-pack and sample authoring;
- scale, tuning, and progression authoring;
- composition and voice relationships;
- permitted Trigger Engine configuration;
- scene and visual parameters;
- live preview through the authoritative runtime;
- validation;
- draft, version, duplicate, and publish behavior;
- backup or export;
- safe authentication and storage.

Whether My Studio or any Trigger Engine authoring becomes player-facing remains **UNRESOLVED / EXPLORATORY — LATER**.

### 24.2 Authoring principle

Adding a route should not require duplicating application components or hardcoding logic throughout the frontend.

---

## 25. Telemetry and evaluation

**Maturity:** **PLANNED — SUPPORTING**

Telemetry should answer product questions, not merely maximize engagement.

### 25.1 Useful signals

- first-transit completion;
- account creation after first arrival;
- second-transit start;
- return after several days;
- active versus background use;
- chosen transit durations;
- route selection under forecasts;
- interruption/failure points;
- audio/visual performance;
- transmission replay;
- spontaneous discussion or archive use.

### 25.2 Avoid

- optimizing notification pressure;
- maximizing daily opens as the sole goal;
- treating hours left running as proof of meaningful engagement;
- collecting unnecessary personal data;
- A/B tests that violate the artistic identity.

### 25.3 Qualitative evaluation

Ask:

- Did one crossing remain beautiful for its duration?
- Did the player understand progress?
- Could they safely look away?
- Did arrival feel earned?
- Did weather feel systemic?
- Did the world feel inhabited?
- Did they want another crossing?

---

## 26. Monetization boundaries

**Maturity:** **UNRESOLVED**

No monetization model is established.

### 26.1 Vision-derived constraints

Any later model should avoid:

- pay-to-win route safety;
- selling power over other players;
- coercive energy systems;
- loot boxes;
- paid random artifacts;
- monetized FOMO weather windows;
- subscription pressure disguised as world fiction;
- degrading the free/early audiovisual experience to sell quality back.

### 26.2 Potentially compatible directions

Not commitments:

- paid product;
- expansion content;
- substantial authored sound/world packs;
- cosmetic expression with strong integrity;
- supporter edition;
- subscription only if it funds genuine continuing world/content service without coercion.

Monetization requires a separate decision record.

---

## 27. Launch-critical versus future

### 27.1 Prototype: prove one crossing

**Required:**

- one glider/cockpit context;
- one route;
- one origin/destination relationship;
- one Trigger Engine/composition;
- one coherent sound world;
- route progress;
- one environmental/weather preset;
- enough sky/environment evolution;
- a small set of routine and unusual transmissions;
- departure and arrival;
- basic diagnostics and performance validation.

**Not required:**

- accounts;
- global simulation;
- multiplayer;
- full progression;
- multiple gliders;
- wiki;
- voice;
- economy;
- complete lore;
- forty regions.

### 27.2 Vertical slice: prove the loop

**Likely required:**

- map/route selection;
- several routes;
- several destinations;
- multiple Trigger Engines or composition profiles;
- several weather states;
- basic forecast;
- basic progression;
- save state;
- onboarding;
- a coherent narrative chapter;
- content data model;
- account decision tested at the correct point.

### 27.3 Foundation: make it scalable

**Likely required:**

- authoritative timing hardened;
- data-driven route/content architecture;
- persistent profiles;
- server-authoritative world state;
- weather simulation;
- authoring/admin tools;
- versioning/migrations;
- telemetry;
- testing;
- performance budgets;
- security/privacy.

### 27.4 Post-slice

- deeper glider/equipment system;
- artifact inheritance;
- archive;
- richer progression;
- anomaly system;
- destination relationships;
- presence.

### 27.5 Long-term

- major world events;
- sophisticated shared forecasting;
- text/voice social systems;
- community-wide discoveries;
- user-created Trigger Engines/sound packs;
- many regions;
- advanced destination hubs;
- native clients;
- multiple world/setting packs.

---

## 28. Dependency rules

1. **One crossing before a world.**
2. **Rhythm authority before weather-driven tempo.**
3. **Route data model before dozens of routes.**
4. **Meaningful destinations before a large map.**
5. **World-state authority before shared weather.**
6. **Content prerequisites before randomized narrative delivery.**
7. **Persistence before artifact provenance.**
8. **Identity/privacy before public profiles.**
9. **Moderation before chat or voice.**
10. **Archive authority classes before player-authored lore.**
11. **Progression philosophy before currencies and skill trees.**
12. **Glider identity before a fleet of variants.**
13. **Performance proof before 45–90 minute production commitments.**
14. **Failure philosophy before irreversible loss.**
15. **Core beauty before monetized expression.**

---

## 29. Cross-system contracts

### 29.1 World → forecast

Forecasts derive from authoritative world state plus uncertainty rules.

### 29.2 Forecast → route planning

The player receives actionable information, not exact hidden outcomes.

### 29.3 Route → transit

The selected route supplies baseline duration, environment, composition, transmissions, and condition sensitivity.

### 29.4 Weather → transit

Weather supplies authoritative condition inputs and route modifiers.

### 29.5 Transit → rhythm

Transit supplies an approved duration/form/modulation plan. It does not create a competing musical clock.

### 29.6 Rhythm → Trigger Engines/audio

The centralized rhythm system supplies authoritative event and phase state.

### 29.7 Progression → presentation

Progression unlocks versioned, bounded capabilities. It must not mutate timing invariants.

### 29.8 Transit → narrative

The narrative scheduler selects eligible content using route, chapter, heard state, conditions, and authoritative randomness.

### 29.9 Completion → persistence

Arrival commits outcomes idempotently. Reconnect/retry must not duplicate rewards or provenance.

### 29.10 Community → canon

Player contributions remain observations/theories until explicitly promoted by an authorized content process.

---

## 30. System-specific anti-patterns

| System | Anti-pattern |
|---|---|
| Transit | Long passive timer with cosmetic animation |
| Routes | Hardcoded component per route |
| Weather | Randomized independently in each client |
| Forecast | False precision hiding random outcomes |
| Progression | Generic XP treadmill |
| Glider | Inventory of tiny percentage bonuses |
| Trigger Engine | Collision determines notes |
| Narrative | Lore dump without routine human context |
| Anomalies | Constant random spectacle |
| Artifacts | Powerful random loot with published odds |
| Archive | Unmoderated wiki treated as canon |
| Social | Always-on chat over the composition |
| World events | FOMO windows that punish absence |
| Persistence | Client-only authority for shared state |
| Accounts | Registration wall before proving value |
| Monetization | Selling safety, timing advantage, or rarity |

---

## 31. Open decision register

| ID | Decision | Status |
|---|---|---|
| GS-001 | Exact transit interaction model | **UNRESOLVED** |
| GS-002 | Pause/background/resume behavior | **UNRESOLVED** |
| GS-003 | Failure, death, and long-session consequence | **UNRESOLVED** |
| GS-004 | Route arrival/formal closure relationship | **UNRESOLVED** |
| GS-005 | Geographic ontology: Zone/region/destination/corridor | **UNRESOLVED** |
| GS-006 | Navigator ranks and progression axes | **UNRESOLVED** |
| GS-007 | Meaning of Meridian and player relationship to it | **UNRESOLVED** |
| GS-008 | Glider stats, equipment, maintenance | **UNRESOLVED** |
| GS-009 | Trigger Engine interaction depth | **UNRESOLVED** |
| GS-010 | Weather-to-music mapping | **UNRESOLVED** |
| GS-011 | Forecast variables and uncertainty | **PLANNED — CORE / unresolved details** |
| GS-012 | Cargo/data/passenger/economic premise | **UNRESOLVED** |
| GS-013 | Narrative chapter/endgame structure | **UNRESOLVED** |
| GS-014 | Anomaly encounter and consequence rules | **UNRESOLVED** |
| GS-015 | Level, skill-tree, and currency model | **UNRESOLVED** |
| GS-016 | Artifact assignment/transfer/loss | **UNRESOLVED** |
| GS-017 | Archive contribution and authority model | **UNRESOLVED** |
| GS-018 | Social presence/chat/voice boundaries | **UNRESOLVED** |
| GS-019 | Offline behavior | **UNRESOLVED** |
| GS-020 | Account timing and identity | **UNRESOLVED** |
| GS-021 | Monetization | **UNRESOLVED** |
| GS-022 | Procedural/hybrid environment technology | **UNRESOLVED** |

---

## 32. Minimum viable game-system contract

The smallest version that can truthfully demonstrate PHASE must provide:

1. a Navigator context;
2. a meaningful origin and destination;
3. a glider/cockpit;
4. a route with legible progress and duration;
5. a long-form deterministic audiovisual composition;
6. Trigger Engine geometry driven by shared rhythm;
7. a changing sky/environment;
8. at least one condition/weather influence;
9. routine human transmissions;
10. a designed arrival;
11. support for focused and peripheral attention;
12. a reason to consider another crossing.

Everything else must justify itself by strengthening this contract.

---

## 33. Run boundary

This document completes **Run 4 only: game systems bible**.

It does not finalize:

- world lore;
- visual direction;
- production roadmap;
- architectural decision records;
- glossary;
- agent instructions;
- repository implementation;
- codebase audit.

Unresolved systems remain unresolved by design.
