<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
# PHASE Agent Instructions

These instructions govern AI coding agents working in the PHASE repository.

---

## 1. Read before changing code

For any nontrivial task, read:

1. `docs/DECISIONS.md`
2. the task-relevant governing document
3. `docs/CONTEXT_INDEX.md` when status or provenance is uncertain
4. `docs/GLOSSARY.md` for terminology

Task routing:

| Task | Required documents |
|---|---|
| Product behavior or new feature | `PHASE_VISION.md`, `GAME_SYSTEMS.md`, `DECISIONS.md` |
| Audio, rhythm, timing, Trigger Engines | `AUDIO_RHYTHM_ARCHITECTURE.md`, `DECISIONS.md` |
| Lore, naming, narrative | `WORLD_LORE.md`, `CONTEXT_INDEX.md`, `GLOSSARY.md`, `DECISIONS.md` |
| Visual/UI/environment work | `VISUAL_DIRECTION.md`, `PHASE_VISION.md`, relevant systems docs |
| Planning or sequencing | `PRODUCT_ROADMAP.md`, `GAME_SYSTEMS.md`, `DECISIONS.md` |
| Ambiguous or cross-system change | All documents above as relevant; do not guess |

---

## 2. Authority hierarchy

Use this hierarchy:

1. explicit current user instruction;
2. accepted entries in `docs/DECISIONS.md`;
3. locked/canonical classifications in `docs/CONTEXT_INDEX.md`;
4. governing target document for the system;
5. `docs/GLOSSARY.md`;
6. current implementation;
7. comments, old names, generated patterns, and assumptions inferred from code.

The repository describes what exists. The Project Bible describes what the product is intended to become. Neither should be misrepresented as the other.

If code and target behavior conflict:

- report the conflict;
- identify the relevant decision/document;
- do not silently redefine the documentation;
- do not assume the code is correct because it already exists;
- do not assume the documentation is implemented because it is authoritative intent.

---

## 3. Status discipline

Documentation uses:

- LOCKED / CANON;
- PLANNED;
- EXPLORATORY;
- UNRESOLVED;
- SUPERSEDED / REJECTED.

Never implement an **EXPLORATORY** idea as established product behavior without explicit authorization.

Never select an answer marked **UNRESOLVED** merely because an implementation requires a value. Use a temporary clearly named placeholder only when authorized and keep it out of canon.

Do not convert:

- assistant brainstorms;
- old code labels;
- image-set numbers;
- moodboard references;
- TODO comments;

into permanent decisions.

---

## 4. Architectural invariants

The following may not be casually changed:

1. There is one logical rhythm authority.
2. Repeating rhythmic phase is normalized in `[0,1)`.
3. Finite route progress is distinct from wrapped phase.
4. Macro-cycle closure is deterministic.
5. Phase Zero is an exact semantic boundary.
6. Trigger Engines consume timing; they do not own it.
7. Geometry expresses rhythm.
8. Collision/intersection/rendered contact never authoritatively causes a note.
9. Audio and visuals reference the same event identity.
10. Frame rate never changes musical results.
11. Consumers can reconstruct current state after remount/suspension.
12. Environmental systems enter through an explicit modulation contract.
13. Shared gameplay-relevant world state is authoritative.
14. The tuning reference is centralized.

Before touching these systems, read all of `docs/AUDIO_RHYTHM_ARCHITECTURE.md`.

Any proposed change to an invariant requires:

- an explicit decision record;
- creative and technical rationale;
- migration impact;
- test changes;
- approval before implementation.

---

## 5. Product invariants

Preserve:

- transit as the central long-form audiovisual experience;
- focused and peripheral/background use;
- low-dopamine interaction;
- progression through perception, expression, access, and responsibility;
- beautiful daylight-capable horror;
- minimal but persistent hope;
- joint solitude;
- the world’s independence from the player;
- MTC as necessary and broadly benevolent;
- Navigator as the preferred vocation term;
- gliders as efficient working craft rather than fighter power fantasy.

Do not add conventional game systems solely because the genre usually contains them.

---

## 6. Lore and naming rules

- The planet is Earth.
- PHASE is the current product/project identifier.
- Kashmer-Alterra is an unresolved working setting label.
- The catastrophe’s final name is unresolved.
- “The Convergence” is a working term, not locked naming.
- Navigator is canonical; pilot is explanatory shorthand.
- Meridian has unresolved multiple meanings and is not an ordinary rank.
- MTC means Meridian Transit Corporation.
- Zone is not automatically a settlement, region, destination, or level.
- Harmonic Climate and Atmospheric Harmony are exploratory terms.
- No specific anomalous organism is currently canon.
- Community theories do not automatically become canon.

In lore work, distinguish:

- objective canon;
- in-world knowledge;
- belief/folklore;
- creator-unresolved truth.

Do not resolve preserved mysteries while implementing unrelated content.

---

## 7. Visual rules

Read `docs/VISUAL_DIRECTION.md` before substantial visual work.

Preserve:

- cold, living green/blue/white atmosphere;
- ancient future;
- sacred utility;
- industrial mysticism;
- rugged humanity;
- institutional archaeology;
- mathematically truthful harmonic form;
- daylight horror;
- long-session comfort.

Avoid:

- generic cyan holograms;
- evil-corporation black/red shorthand;
- fighter-jet gliders;
- fantasy-priest Navigators;
- decorative fake mathematics;
- unreadable sci-fi UI;
- direct copying of references.

The final MTC logo, selected “#3” image, garments, and glider silhouettes are unresolved because source images are missing. Do not reconstruct them from textual labels alone.

---

## 8. How to approach repository changes

### Diagnose before changing

For architecture or refactor work:

1. inspect the current implementation;
2. trace data flow;
3. identify tests and callers;
4. compare confirmed behavior with target behavior;
5. preserve parts already well designed;
6. propose a scoped change;
7. implement only the approved scope.

### Prefer small coherent changes

- avoid broad rewrites;
- do not replace unusual architecture until its product reason is understood;
- separate mechanical refactoring from behavior change;
- keep data migrations explicit;
- preserve backwards compatibility where required;
- avoid duplicating Lovable-generated components to ship variants quickly.

### Data-driven scaling

Routes, destinations, transmissions, weather profiles, compositions, and progression content should become data-driven before large content scale.

Do not hardcode a separate component or logic branch for every route.

---

## 9. Lovable and Git workflow

GitHub is the code/history source of truth. Lovable and Codex operate on the same repository through Git.

For significant work:

- use a dedicated branch/worktree;
- inspect existing uncommitted changes and preserve user work;
- make focused commits;
- show the diff;
- run relevant tests/builds;
- merge only after review;
- verify the Lovable preview after integration;
- remember that publishing the live application is a separate action.

Do not ask Lovable to reinterpret large Codex implementations through a prose prompt when direct repository integration is available.

Use Lovable for rapid interface iteration and Codex for precise engineering, while keeping responsibilities explicit.

---

## 10. Testing expectations

Testing effort should match risk.

### Timing/audio changes

Require:

- unit tests;
- macro-cycle/Phase Zero regression tests;
- frame-rate independence;
- pause/resume/remount tests;
- long-duration simulation;
- duplicate/missed event checks;
- audiovisual alignment diagnostics where possible.

### Persistence/shared-world changes

Require:

- authorization/security checks;
- idempotency;
- migration tests;
- shared-state consistency;
- conflict/retry behavior;
- time-zone/world-clock handling.

### UI/visual changes

Require:

- responsive behavior;
- accessibility;
- reduced motion;
- keyboard/input behavior;
- long-session performance where relevant;
- screenshots or visual review;
- verification that visuals do not alter musical timing.

### Narrative/content changes

Require:

- status/canon review;
- prerequisite/order validation;
- repeated-content behavior;
- subtitle/localization readiness;
- objective knowledge versus theory classification.

---

## 11. Performance expectations

- Audio timing has priority over decorative visual fidelity.
- Reduce particles, trails, postprocessing, and detail before compromising scheduling.
- Avoid one timer, animation loop, event queue, or audio context per Trigger Engine.
- Test the duration PHASE actually intends to support.
- Treat background throttling and device suspension as normal conditions.
- Instrument audio lateness, render cost, event generation, and clock drift separately.

---

## 12. When to ask

Ask rather than invent when a task requires selecting:

- final title or proper noun;
- meaning of Meridian;
- catastrophe name;
- harmony physics;
- geographic ontology;
- 432 Hz reference/temperament;
- failure/death/pause policy;
- weather-to-music model;
- progression ranks/trees/currencies;
- economy or monetization;
- final logo, uniform, glider, or missing image-dependent design;
- social/chat/voice boundary;
- a change to an accepted decision.

Do not block on minor reversible implementation detail when it does not change product meaning. Document reasonable engineering assumptions.

---

## 13. Decision records

When a new architectural or philosophical decision is approved:

1. add the next numbered record to `docs/DECISIONS.md`;
2. include context, decision, rationale, consequences, alternatives, migration, and verification;
3. mark any previous record superseded;
4. update affected docs and glossary;
5. add or update tests.

Never rewrite an accepted decision silently.

---

## 14. Definition of done

A task is not complete until:

- requested behavior is implemented;
- scope matches authorization;
- relevant Project Bible rules are satisfied;
- tests/builds pass or failures are clearly reported;
- accessibility/performance are checked in proportion to risk;
- no exploratory idea was silently promoted;
- no user changes were overwritten;
- the diff is reviewed;
- documentation/decision records are updated when behavior or architecture changed.

---

## 15. Breaking philosophical changes

The following require explicit product-owner approval:

- making transit secondary or skippable by default;
- abandoning ambient/focus use;
- introducing coercive high-dopamine retention;
- redefining MTC as corrupt/evil;
- redefining Navigator/Meridian without decision;
- replacing beautiful daylight horror with conventional horror;
- making community synchronous-first;
- converting artifacts into random loot;
- making progression primarily numerical power;
- introducing competing musical clocks;
- allowing geometry to determine note timing;
- abandoning deterministic closure;
- copying a reference’s surface language directly.

