## Sound Packs Panel

Add a folded "Packs" window that expands upward from the bottom ArtDock (mirroring the FX drawer pattern). User clicks a pack → every note's voice is reassigned by ring index (ring 0 → voice 0, ring 1 → voice 1, … wrapping at 6).

### The 3 packs (6 voices each, all pure Web Audio)

**MOSS** — organic, ethereal, wet
1. Glass Bell — detuned sine triad, long bell envelope
2. Moss Pluck — triangle + lowpass with fast pluck env, soft body
3. Droplet — pitched sine blip with rapid downward pitch sweep + tiny noise tick
4. Reed Pad — stacked sawtooth through narrow bandpass, slow attack
5. Air Chime — high sine + filtered noise puff
6. Sub Hum — sine sub with very slow LFO on amp

**PRISM** — bright, crystalline, sharp
1. Crystal — FM (sine carrier, sine modulator @ 3:1), short bell tail
2. Spark Pluck — square through resonant lowpass, ultra-fast decay
3. Glass Ping — two high sines a fifth apart, very short
4. Shimmer — sine + octave-up sine, slow tremolo
5. Coin — bandpass-filtered noise burst pitched up
6. Ribbon Bass — triangle bass with light saturation curve

**OBSIDIAN** — dark, metallic, deep
1. Mallet — FM with inharmonic ratio (1:1.41) for metallic clang
2. Dub Pluck — sine + sub-sine, lowpass sweep down
3. Stone — short filtered-noise hit + pitched thump
4. Drone Pad — detuned sawtooth pair, very slow attack/release
5. Iron Bell — three inharmonic sine partials, medium decay
6. Cavern Sub — sine sub with pitch dip on attack

### Implementation

**`src/lib/sound/packs.ts`** (new)
- Export `VoiceId` type, `PackId = 'moss' | 'prism' | 'obsidian'`.
- Export `PACKS: Record<PackId, { name, blurb, voices: VoiceSpec[] }>`.
- `VoiceSpec` = pure data: `{ id, name, kind: 'chime'|'pluck'|'bell'|'pad'|'bass'|'fm'|'droplet'|'noise', params: {...} }`.
- Export `playPackVoice(ctx, dest, spec, freq, when, velocity)` — single dispatcher that builds the right oscillator/filter/envelope graph per `kind`. Uses the same gain-staging discipline as current `playVoice` (low peaks, refractory respected by caller, cleanup on stop).

**`src/routes/index.tsx`**
- Extend `WheelState.rings[i]` with `voiceIndex: number` (0–5), default = ring creation order mod 6. Notes already inherit voice from ring, so no per-note change needed.
- Add `selectedPack: PackId` to engine state, default `'moss'`.
- In the wheel trigger path, replace the current `playVoice` call with `playPackVoice(ctx, fxIn, PACKS[selectedPack].voices[ring.voiceIndex], freq, when, vel)`.
- Add `PacksDrawer` component (sibling of `FxDrawer`): glass panel, `rounded-2xl`, `backdrop-blur-md`, border `white/10`, expands upward from the dock with a scale+fade transition (~220ms, ease-out). Width ~520px, height auto, never taller than ~38vh.
- Layout inside drawer: three pack cards in a row. Each card shows pack name in Inter 14px tracking-wide, a one-line blurb at 60% opacity, and a 2×3 grid of voice chips (name only). Selected pack has a hairline ring + faint inner glow. Hovering a voice chip auditions that voice once at A4.
- Add a "Packs" toggle button to `ArtDock` next to the existing FX toggle, same hairline styling.
- Selecting a pack: set `selectedPack`, no other state change. All future triggers use the new pack; ring→voice mapping is preserved.

**Animation**
- Use existing keyframes: drawer panel uses `animate-scale-in` on open, fades out on close via local state + `transition-opacity duration-200`.
- Origin set to `bottom center` so it physically grows from the dock.

### Out of scope
- No per-note voice override UI (mapping stays ring-based as chosen).
- No saving/loading packs to storage.
- No changes to FX drawer, BPM, or trigger math.
- No new dependencies.
