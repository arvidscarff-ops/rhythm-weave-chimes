## What I found

I tested the running preview at `http://localhost:8080/` end-to-end with a headless browser. It renders correctly — colored stage, dark theme, dock visible, no JS errors, all CSS applied. Both `bun run build` and `bun run build:dev` succeed with no errors.

A fully unstyled "1990s" page with non‑functional UI is the classic symptom of **the stylesheet bundle not being served** (or being served from a different origin than the HTML). That isn't happening in this codebase — `src/routes/__root.tsx` correctly registers `appCss` as a stylesheet link, and the build emits the CSS chunk normally.

The "new tab" URL you're opening (`https://id-preview--…lovable.app/?__lovable_sha=2fc37a73…`) points at a **published static preview** pinned to a specific build SHA. The hydration trace also references that pinned SHA. That deployment is independent from the live in-IDE preview — if it was published before the Phase‑Zero refactor (or against a build that failed to upload its CSS asset), it will keep serving the broken HTML even though the live preview is fine.

## Plan

1. **Confirm the source.**
   - Have you republished after the Phase‑Zero refactor? If not, the `id-preview--…lovable.app` tab is serving a stale build.
   - Does opening the in‑IDE preview (not the published URL) in a new tab also look broken? If only the published tab is broken, this is a republish issue, not a code issue.

2. **If only the published URL is broken → republish.**
   The current `dist/` builds cleanly. Republishing regenerates the static preview at a new SHA, which fixes a stale CSS bundle reference.

   ```text
   <presentation-actions>
     <presentation-open-publish>Publish your app</presentation-open-publish>
   </presentation-actions>
   ```

3. **If the in‑IDE preview is also broken in a new tab → I need a screenshot.**
   That would mean something I can't see from headless Chromium on localhost is biting you (browser extension, Safari‑specific behavior, a particular `#s=…` share hash). I'll ask for a screenshot + the exact URL bar contents and dig in from there.

## Technical notes

- The hydration warning in your console (`data-new-gr-c-s-check-loaded`, `data-gr-ext-installed`, `leather-provider` script) is from Grammarly + the Leather wallet extension injecting into `<body>`. React always logs this as a mismatch, but it's purely cosmetic and unrelated to "white page / 90s UI."
- Localhost smoke check: page rendered teal stage background, dock with semantic styles, no `pageerror`, no failed asset requests.
- Both `build` and `build:dev` complete and emit the worker bundle + client CSS chunk.
