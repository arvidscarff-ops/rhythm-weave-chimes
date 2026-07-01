## Problem

The dock's overflow menu still shows two separate entries:

- **"Developer console"** → links to `/dev` (the legacy email/password-gated `dev.tsx` page). This is what shows up in the Lovable in-app preview because the account there isn't signed in — so the dock never renders the second, auth-only "My Studio" item.
- **"My Studio"** → links to `/studio`, but the item is wrapped in an `authed` check and only appears when a Supabase user is signed in. In a fresh preview window you happen to be signed in, so it shows there — hence the split behaviour you're seeing.

The old `/dev` route also exists as a full page and is linked from `src/routes/index.tsx` (a "pr-rail-link" pointing at `/dev`).

## Fix — retire the old Developer Console entirely

Everything the old `/dev` page did (pack CRUD, sample upload, slot editor) already lives inside `/studio/packs` behind the passcode. Remove the legacy surface so the passcode-gated My Studio is the only creator hub, visible to everyone (signed in or not).

### Changes

1. **`src/components/dock/PhaseDock.tsx`**
   - Delete the "Developer console" menu item (the `<Link to="/dev">` block).
   - Unwrap "My Studio" from the `authed` conditional so it shows for every user. Keep it above the Sign-in/Sign-out separator (dev tool, not account action).
   - The "Admin" item (`phase:admin-open` event) stays — it already routes to `/studio` via `AdminTrigger`.

2. **`src/routes/index.tsx`**
   - Remove the `<Link to="/dev">` rail link (single occurrence around line 3068).

3. **`src/routes/dev.tsx`** — delete the file. `auditionSample` stays in `src/lib/dev/samplePlayer.ts` because `studio.packs.tsx` and `runtimePacks.ts` still import it.

4. **Route tree regen** — run the same `regen.mjs` used previously so `routeTree.gen.ts` no longer references `/dev`.

### Result

- In-app preview and standalone window both show the same overflow menu with a single "My Studio" entry.
- Clicking it navigates to `/studio`, which prompts the passcode keypad regardless of Supabase auth state.
- The "Developer console" label and the email/password gated page are gone.

### Out of scope

- No changes to the passcode flow itself, no DB changes, no changes to `/studio/packs` internals.
- The authenticated `/auth` page and Sign-in/Sign-out remain (used for per-user presets in the future).
