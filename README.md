# Remix of Rhythmic Echoes

**Objective:** Create a generative ambient music app based on mathematical polyrhythms. The app must sync browser-generated audio with a clean, minimalist 2D visual layout.

**Core Requirements:**

1. **Audio Engine:** Use the native browser Web Audio API. Do NOT use external audio files. Create a custom synthesizer node using pure code oscillators (sine waves with a soft low-pass filter, plus a deep delay/reverb effect) to create lush, organic ambient "pluck" or "chime" sounds.

2. **Visual Layout:** Use an HTML5 Canvas or SVG container. Render 3 independent horizontal timeline lanes stacked vertically. Each lane has a visual playhead indicator that moves smoothly from left to right.

3. **The Trigger System:** When a lane's playhead hits the far right edge, it wraps back to the start, flashes visually, and triggers a specific synth chime tone.

4. **Initial Values / Speeds:**

   - Lane 1: Loop length = 4 seconds (Triggers Node A)

   - Lane 2: Loop length = 5 seconds (Triggers Node B)

   - Lane 3: Loop length = 6 seconds (Triggers Node C)

   *Note:* Because of these mathematical offsets, the rhythms will phase out of sync and periodically re-align perfectly.

**UI Strategy:**

- Build a dark-mode, performance-driven design. 

- Avoid standard spreadsheet corporate vibes; make it feel like a tactile, sleek hardware synthesizer dashboard.

- Place a play/pause button prominently at the top.

- Underneath the visual lanes, provide three speed sliders (one for each lane) to let the user manually adjust the loop durations in seconds.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://rhythm-weave-chimes.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cf9e5e52-f5c1-4b89-97fa-290f88785258).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
