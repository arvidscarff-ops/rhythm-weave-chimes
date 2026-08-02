# Reset R1 preservation manifest

**Task:** R1.1 pre-Reset preservation package  
**Status:** IN REVIEW  
**Class:** Documentation and generated reference evidence  
**Product-canon effect:** None  
**Source repository revision:** `7a8fcfc0282f8afa9b0a5adee6279494df349455`  
**Published source inspected:** `https://rhythm-weave-chimes.lovable.app`

---

## 1. Task envelope

- **Cost class:** MEDIUM
- **Team:** One primary agent; no specialists or subagents
- **Repository writes:** New files under `docs/reset` only
- **Generated-media writes:** Outside Git only
- **Application/source/configuration writes:** Prohibited
- **Live database/storage writes:** Prohibited
- **Credentials:** Not used
- **Stage/commit/push/deploy:** Not authorized
- **External publication:** Not authorized
- **Stop conditions:** Unresolved architectural choice, destructive action,
  private-data access, credential requirement, or unrelated repository change

---

## 2. Purpose

This package preserves enough evidence to compare Reset replacements with the
current prototype without treating current behavior as the target
architecture.

It supports the R1 and R6 requirements in `PRODUCT_ROADMAP.md`:

- protect valuable prototype work;
- inventory behavior and data before replacement;
- verify replacement behavior before deletion;
- prepare a reviewed removal manifest later.

No application code, configuration, dependency, migration, Project Bible
document, live database row, or storage object was changed while creating this
package.

---

## 3. Source identity

The source files below were hashed before Reset implementation:

| File | SHA-256 |
|---|---|
| `src/lib/engine/phaseAlign.ts` | `fad561ec80cb695376f061eba7118b8447d44916db8eabb22dd10252663141d3` |
| `src/lib/engine/clock.ts` | `ddf5db7f4f296eea4a02fd01af779621ccefdb4e98515ce595364972ea841892` |
| `src/lib/engine/scheduler.ts` | `15ec228fb5a156fc3150c363b47da65d6749fdf9a165197e2cca0fafc494bbf3` |
| `src/lib/engine/sceneTypes.ts` | `78b125ae4963779ad14f4c61f6e9d26f698d1d99c1c6f502d4b897794bdb1365` |
| `src/routes/index.tsx` | `58559de030b0abda27fe3b07618ae61fb427b8c9dbfd2315b58adb878fd30cdf` |
| `src/components/dock/PhaseDock.tsx` | `ca470f94a4d170ba07a9adbb8aee88fbec4fc65e7d457049767d5de8435e57ab` |
| `src/routes/studio.packs.tsx` | `ab9ff13b206b0ffb3cc766d740bde9e87edb38addce4b333f1a9913f3ac87515` |
| `src/routes/studio.scales.tsx` | `3723f84ee8c28854a26505d9e9eb2eee0f2952567d25a817d4138779a3faa912` |
| `src/routes/studio.scenes.tsx` | `867a038554faa9eca8f82ad947d828d15af175a4b7728e8aff4f87efdce1797d` |
| `src/routes/studio.builder.tsx` | `97d4bde168e3546bdbb23ce3eb53eff0f3c524264824c3532078c3b6f9328731` |
| `src/lib/engine/pathTransformer.ts` | `2a3c734b4e96c4f4303cce66476c4901677d53e3c8f8234c8abfd1312942d135` |
| `src/lib/sound/packs.ts` | `4a6d95f2325ae515afc93f3302a264db9e6d6b336cfd8adc381c5135c3e26f18` |
| `src/lib/sound/runtimePacks.ts` | `21d3418d6b05a3c354e40dc0da7414a781190515544ee0006389e4ecd4e86bc3` |
| `src/integrations/supabase/types.ts` | `b06366c2199c94797aec74ef228f4900198ad262955bdf6fa8b180870275a61c` |

Every source scene module also has an individual hash recorded through Git at
the source revision. The revision is the durable source-level snapshot; the
table highlights the files most likely to be refactored or replaced.

---

## 4. Visual capture set

Fifteen JPEG captures were created from the published application:

- one playing capture for each of the fourteen `SceneKind` values;
- one paused Wheel capture;
- consistent `1280 × 720` CSS viewport at device pixel ratio `2`;
- the same version-1 session payload for every playing capture, changing only
  the scene ID;
- approximately one second of running time before each playing capture.

The generated media is intentionally outside Git. `capture-index.json` records:

- published deployment URL;
- repository revision;
- viewport;
- filename;
- byte size;
- SHA-256 hash;
- capture limitations.

### Confirmed published behavior preserved

| Scene | Published result |
|---|---|
| `wheel` | Visible and selectable |
| `pendulum` | Visible and selectable |
| `bars` | Visible and selectable |
| `stringNet` | Visible and selectable |
| `pendulumFan` | Visible and selectable |
| `spiralArp` | Visible and selectable |
| `radialSweep` | Visible and selectable |
| `mandalaMatrix` | Visible and selectable |
| `metatronLattice` | Visible and selectable |
| `fractalNebula` | Visible and selectable |
| `radialResonator` | Visible and selectable |
| `phaseAlignRings` | Code-reachable through session state; not present in the Scene menu; published capture is visually blank apart from the shared shell |
| `voidSheets` | Code-reachable through session state; not present in the Scene menu; published capture is visually blank apart from the shared shell |
| `custom` | Code-reachable through session state; not present in the Scene menu; published capture is visually blank apart from the shared shell |

The blank captures are preserved as current behavior. They are not interpreted
as a target or silently corrected in R1.

---

## 5. Deterministic fixture

`fixtures/phase-align-reference.v1.json` was produced by importing the current
`phaseAlign.ts` implementation directly and evaluating:

- `B = 10`;
- `D = 30` seconds;
- `N = 8`;
- Phase Zero;
- mid-cycle progress;
- exact macro-cycle closure;
- a 24-hour closure checkpoint;
- initial and closure crossing windows;
- one complete macro-cycle event count per voice.

The fixture intentionally preserves current floating-point output, including
`30.000000000000004` for one calculated closure crossing. It is reference
evidence, not a tolerance policy or a final time-representation decision.

---

## 6. Data preservation boundary

`fixtures/data-preservation-inventory.v1.json` identifies:

- Supabase tables represented by generated repository types;
- storage buckets referenced by migrations or runtime code;
- LocalStorage and SessionStorage keys;
- version-1 URL session state;
- destructive migration history that raises the backup requirement.

No live database or storage export was performed. Service-role credentials were
not used. A live export requires a separate exact authorization, secure
destination, and recovery/verification plan.

---

## 7. Known limitations and pending captures

- Audio was started to place scenes in their running state, but the JPEG format
  does not preserve sound.
- No long-form recording was generated in this pass.
- The browser-control surface used a fixed desktop viewport; responsive mobile
  captures remain pending.
- The published UI did not expose a deployment commit identifier. The
  repository revision identifies the audited source snapshot, but exact
  deployment-to-commit identity was not independently verified.
- My Studio content is protected by its passcode gate. No credential was used,
  so authenticated Studio data and screens remain represented by source,
  schema, and the data-preservation inventory rather than private screenshots.
- The current canvas recorder captures only the primary canvas and no audio; it
  was not treated as a complete preservation method.
- Runtime performance, hidden-tab, suspension, and long-session baselines
  remain pending controlled diagnostics.
- Reference-audio recordings, sample hashes, root-pitch metadata, licensing,
  and provenance require an authorized export of the current content store.

---

## 8. Removal gate

This package does not authorize removal.

Before any R6 deletion:

1. protect the live data listed in the inventory;
2. approve the replacement behavior;
3. compare replacement captures and deterministic fixtures;
4. verify supported routes and compatibility requirements;
5. prepare a complete file/code/schema/asset removal manifest;
6. review the complete diff;
7. obtain explicit project-owner approval.
