# Maximize Game Juice — Living, Organic, Serene, Magical

The engine already triggers notes, paints bursts, lens flares, and a reactive shader. What's missing is the *connective tissue* — the micro-feedback that makes every touch feel alive. This plan layers in tactile, breathing, and reactive details across input, audio, and visuals without rebuilding anything.

## 1. Dock & UI — make controls feel physical

`src/components/dock/PhaseDock.tsx` + `src/components/ui/material-ui-dropdown-menu.tsx`
- **Breathing dock**: dock background subtly pulses with the global tempo (slow opacity/scale via BPM-driven CSS var). Idle = inhale/exhale every 6s; on play = locked to beat.
- **Magnetic hover**: buttons translate a few px toward the cursor on hover (pointer-tracked transform). Light spring easing, not bouncy.
- **Press physics**: every dock button gets a scale-down + a soft inner glow on press (`active:scale-[0.96]` + radial highlight). The existing ripple stays.
- **Slider feedback**: BPM/SPD/Glow/Flow sliders emit a tiny haptic-style "tick" (Web Audio click through master) at integer crossings, plus a faint glow trail behind the thumb that fades over ~400ms.
- **Play button is the hero**: when paused it slowly breathes; on press, a single large concentric ring expands from it across the whole viewport (CSS, 600ms), and the first note triggers feel synchronized.

## 2. Note triggers — multi-sensory layering

`src/routes/index.tsx` (trigger sites), `src/lib/visuals/burstField.ts`, `src/lib/visuals/lensFlare.ts`
- **Pre-trigger anticipation**: 80–120ms before a ring crosses a trigger line, the dot brightens and the line "inhales" toward it. Tiny but huge for perceived musicality. Computed from current angular velocity.
- **Trigger weight**: heavier notes (lower octave / longer release) get bigger burst radius + lower flare hue saturation; light notes get sharper, smaller sparks. Already half-there — formalize as one `noteEnergy` value passed through `flashBus`.
- **Echo ghosts**: each trigger leaves a faint, slow-shrinking ghost dot at the trigger point for ~1.2s — a visual decay matching the audio tail.
- **Chromatic chord glow**: when 2+ rings trigger within ~60ms, spawn one extra "harmony" flare at the centroid, colored by hue-mix. Rewards polyrhythmic alignment moments — the magical "they synced!" payoff.

## 3. The stage itself — alive between notes

`src/routes/index.tsx` render loop
- **Idle drift**: rings rotate by ±0.3° with a slow noise wobble even when paused; centers of the stage drift by a few px on a 20s sine. Stage never feels frozen.
- **Cursor gravity**: nearest ring's stroke brightens slightly as the cursor approaches; trigger lines lean ~1–2° toward the pointer. Pure feel, no functional change.
- **Parallax depth**: bursts behind rings, lens flare in front, neural shader far behind. Add a single shared `parallaxOffset` driven by pointer (already partial in shader; mirror in 2D layer with ~0.4x and ~0.8x factors).
- **Vignette breathing**: subtle radial vignette pulses with master amplitude (read tail RMS from limiter node). Louder passage → stage opens up; quiet → it tightens.

## 4. Audio juice — feel through ears

`src/lib/sound/packs.ts` voicing + master chain
- **Velocity humanization**: ±6% random gain + ±8ms timing jitter per voice. Removes machine-gun stiffness.
- **Stereo wander**: each voice picks a stereo position weighted by ring index, with slow LFO drift so the field never feels static.
- **Sympathetic resonance**: on every trigger, a very quiet, heavily filtered copy plays at a perfect 5th, 50ms later, panned opposite. Creates "the room is listening" effect.
- **Pre-roll texture**: when Play is pressed, a single soft swell (filtered noise, 800ms fade-in) under the first beat. Sets the mood.

## 5. Transitions — nothing pops, everything melts

Across `PhaseDock`, scene switcher, pack switcher
- **Scene crossfade**: switching Wheel → Pendulum → Bars fades the old scene out over 400ms while the new one fades/scales in. Currently a hard swap.
- **Pack morph**: when switching sound packs, the existing color hue glides over ~600ms to the new pack's palette anchor (via a `packHue` interpolator read by both burst + flare).
- **Menu open**: dock submenus already animate; add a brief 1-frame "blur in" (CSS `backdrop-filter` 8px→16px) so they feel like they materialize, not appear.

## 6. First-run / serene defaults

- On first paint (before any user input), spawn 2–3 ambient bursts at random positions over 4s. The app is already alive when you arrive — don't make the user "wake it up."
- Cursor leaves a faint, fast-fading trail (single canvas pass, additive, ~80ms life). One of the cheapest joy upgrades.

## Technical notes

- All new motion respects `prefers-reduced-motion`: replaced with static equivalents, never disabled hard cuts.
- Frame budget: every effect above is 2D-canvas or CSS transform — no new shader passes. Existing RAF loop absorbs them.
- New shared utility: `src/lib/visuals/juice.ts` for `noteEnergy`, hue-mix, and the chord-coincidence detector — keeps trigger sites readable.
- No new dependencies. No backend changes. No dock layout changes.

## Out of scope

- No new visual presets, scenes, or sound packs.
- No keyboard/MIDI input (tracked separately).
- No persistence of juice settings — single global "feel," not a config surface.

## Suggested build order (each shippable on its own)

1. Section 2 (triggers) + 3 (stage life) — biggest perceived gain
2. Section 1 (dock physicality)
3. Section 4 (audio humanization)
4. Section 5 (transitions) + 6 (first-run)
