# Where we are vs. the master plan

Done so far:
- ✅ **Step 1** — Engine skeleton (`sceneTypes`, `triggerBus`)
- ✅ **Step 2** — Visual primitive (`inkBleed`); grain + backdrop already existed
- ✅ **Step 3** — Scene A: String Network
- ✅ **Step 4** — Scene B: Pendulum Fan
- ✅ **Step 5** — Scene C: Spiral Arpeggiator
- ✅ **Step 6** — Scene D: Radial Sweep & Nebula

Remaining:
- ⏳ **Step 7** — Dock + global controls + visual polish
- ⏳ **Step 8** — Share-URL extension for engine scenes
- ⏳ **Step 9** — Cleanup pass (retire legacy `wheel`/`pendulum`/`bars`)

# Next slice — Step 7: Dock & globals (recommended now)

This is where the four new scenes go from "hidden in a menu" to feeling like the actual product. Three concrete changes:

### 7a. SceneSwitcher chips
Replace the dropdown-menu radio list with 4 inline chips in the dock pill — one per engine scene (String Net / Pendulum Fan / Spiral / Radial). Monospace labels at `text-xs tracking-widest opacity-60`, active chip gets a 1px gradient border + slight bloom. Legacy scenes move to a "Classic" submenu so they're still accessible but out of the way.

### 7b. Per-scene Density knob
The dock already has a `multiply` knob. Wire it to each scene's variable element count:
- String Net → number of anchors (3–6)
- Pendulum Fan → number of strands (5–14)
- Spiral → number of turns (3–10)
- Radial Sweep → number of targets (6–16)

`scene.update` already receives `globals.density`; scenes need a small hot-reseed when density changes.

### 7c. Visual polish per spec
- Pull `bg-neutral-950/40 backdrop-blur-xl` and a 1px masked-gradient border into a shared `dockSurface` class so the dock matches the spec exactly.
- Add a `text-xs tracking-widest` metadata strip above the dock showing the active scene's live stats (BPM, speed, density, current pulse count) at 8–10% opacity, illuminating to ~40% on hover.

# Step 8 — Share-URL (small)

`sessionUrl.ts` currently encodes `wheel/pendulum/bars` state. Add a thin per-scene `serialize/hydrate` on each Scene module (the interface already declares it conceptually) and store under `state.engine = { stringNet?, pendulumFan?, spiralArp?, radialSweep? }`. Old hashes keep working — missing engine block just means "use fresh init".

# Step 9 — Cleanup

Decide the fate of the three legacy scenes:
- **Option A — Keep them under "Classic"** (no code removed). Lowest risk, dock stays cluttered.
- **Option B — Migrate Wheel's interactive ring/note editing onto Radial Sweep** (which is its spiritual successor) and delete the legacy wheel/pendulum/bars code + overlays. This drops `index.tsx` from ~3.4k → ~1.2k lines and finally pays off the refactor.

I recommend **B** but it's the biggest single edit in this whole arc.

# Credit estimate for the remaining slice

| Step | Est. credits |
|------|-------------:|
| 7a Scene chips | 2–3 |
| 7b Density wiring (4 scenes) | 2–3 |
| 7c Dock polish + metadata strip | 2 |
| 8  Share-URL engine block | 1–2 |
| 9A Keep-classic cleanup | 1 |
| 9B Full cleanup (delete legacy) | 4–6 |
| **Total (with 9A)** | **8–11** |
| **Total (with 9B)** | **11–16** |

# Recommended order

Approve **Step 7** as the next single slice (~6–8 credits). That's the highest-impact visible change and validates the architecture is paying for itself. Steps 8 and 9 can follow once you've lived with the new scenes for a bit.
