## Adaptive Handpan sizing + reworked chord / accent glow

### 1. Adaptive layout (crowding fix)

Drive everything from `n = pitches.length` in `HandpanField`.

- **Field size** grows with count so it always fits its own container:
  - `size = clamp(460, 460 + max(0, n - 9) * 22, 620)` (max 620px so it never eats the sidebar).
  - `ringRadius = size / 2 - maxRingSlotSize / 2 - 14` — derived, so ring slots always sit inside the disc with a hair of padding.
- **Slot sizing** gets a global `scale` multiplier on top of the register-based sizes (bass 104 / mid 88 / high 72; ding 124 / 108 / 92):
  - `n ≤ 9`  → scale 1.00
  - `n = 10–12` → scale 0.90
  - `n = 13–16` → scale 0.78
  - `n ≥ 17` → scale 0.68
- **Angular spacing** already spreads evenly via `((i-1)/ringSlots) * 2π`. The combination of larger radius + smaller slots restores the visible gap between neighbors at 14+ notes. No overlap even at n=24.
- **Label + chip scaling** — when `scale < 0.85` the disc label drops one step (`text-lg → text-base → text-sm`) and the color chip + Select shrink to `h-5` so nothing spills off the disc.
- **Ding placement** — stays centered; its radius doesn't need to change with n, only with register + scale.

### 2. Chord = wispy white bloom

Replace the teal fill with a soft, additive white bloom that reads as "lit from within".

- Border: `1px solid rgba(255,255,255,0.85)` (was teal).
- Background: `radial-gradient(circle at 50% 45%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.22) 35%, rgba(255,255,255,0.06) 65%, rgba(0,0,0,0.35) 100%)` — bright center, feathery falloff.
- Outer glow shadow: `0 0 24px rgba(255,255,255,0.55), 0 0 48px rgba(255,255,255,0.25), inset 0 1px 0 rgba(255,255,255,0.35)`.
- An extra absolutely-positioned `-inset-2` element with `filter: blur(10px)` and a translucent white radial gradient adds the "wispy" haze around the disc. Opacity animates gently (2.4s ease-in-out) via a keyframe `chord-breathe` (opacity 0.55 ↔ 0.85) so chord notes softly pulse.
- Label stays white (unchanged).

### 3. Accent = halo from behind

Accent discs stay dark in the center; the light source sits *behind* the sphere.

- Front sphere: dark radial fill `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.05), rgba(0,0,0,0.75) 70%)` with a 1px `rgba(255,255,255,0.15)` border. No inner glow.
- Behind halo: an absolutely-positioned sibling rendered *before* the button, `-inset-4`, `rounded-full`, `filter: blur(18px)`, `background: radial-gradient(circle, oklch(0.72 0.22 310 / 0.85) 0%, oklch(0.72 0.22 310 / 0.4) 45%, transparent 75%)`. This creates a violet corona that spills past the sphere edge.
- Second halo layer with `-inset-1`, `rounded-full`, `boxShadow: 0 0 0 1px oklch(0.72 0.22 310 / 0.55)` — a hairline aura hugging the sphere so the eye still reads the disc boundary.
- Halo opacity animates via `accent-pulse` keyframe (0.7 ↔ 1.0 over 1.8s) so the light "throbs" from behind. Removes the current `animate-pulse` inline ring.
- Existing color chip below the Select stays untouched so admins still see the pitch-class color.

### 4. Small housekeeping

- Update the "Tap to cycle" caption: **"Off → Chord (white) → Accent (violet halo) → Off"**.
- Two new keyframes in `src/styles.css`: `chord-breathe` and `accent-pulse` (both `@keyframes` in the existing global block, matching the file's convention).
- No changes to data, cycle logic, strum bar, or filmstrip.

### Files touched

- `src/routes/studio.scales.tsx` — `HandpanField` sizing math + chord/accent style branches; caption text.
- `src/styles.css` — two keyframes appended near the other `@keyframes` blocks.

### Out of scope

- Ring is still a single circle. Multi-ring layouts (inner + outer rings) for >18 notes would be a bigger UX change and can be a follow-up.
- No changes to strum bar or filmstrip visuals.
