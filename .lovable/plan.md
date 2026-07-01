## Problem

Right now `/admin/packs` only exists as a URL you have to type manually. There is no button, link, or menu anywhere in the app that leads to it. That's why it feels invisible.

## Plan: Add a discoverable (but subtle) admin entry point

### 1. Subtle admin trigger on the main page
Add a small, low-key affordance in a corner of the main app (e.g. bottom-right of `src/routes/index.tsx`) — a tiny glyph button (⌘ / a small dot / a gear) with very low opacity that brightens on hover. Non-admins won't notice it; you'll know where it is.

Clicking it opens the **glassmorphic passcode keypad** directly as a modal overlay (reusing `PasscodeKeypad`). On correct passcode → navigate to `/admin/packs`. On wrong → shake + clear.

### 2. Keyboard shortcut (power-user path)
Global listener: pressing `⌘ + .` (Mac) / `Ctrl + .` (Win) anywhere in the app opens the same passcode modal. Nothing visible, nothing for regular users to discover.

### 3. Retire `/admin/unlock` as a landing page
Since the keypad is now summoned in-place, `/admin/unlock` becomes redundant. Two options:
- **(A)** Delete the route entirely — keypad is only accessible via the corner glyph or shortcut.
- **(B)** Keep `/admin/unlock` as a bookmarkable fallback that just renders the same keypad full-screen.

Default: **(B)** — costs nothing, gives you a URL to bookmark.

### 4. Inside `/admin/packs`
Add a small "Lock" button in the header that clears the in-memory passcode and navigates back to `/`.

### Files touched
- `src/routes/index.tsx` — add corner trigger + global shortcut listener
- new `src/components/admin/AdminTrigger.tsx` — the glyph + modal orchestration
- `src/routes/admin.packs.tsx` — add Lock button
- `src/routes/admin.unlock.tsx` — simplified to just host the keypad (or deleted if you pick A)

### Question for you
Where should the corner trigger live visually?
- **Bottom-right** floating dot (most discoverable to you, still subtle)
- **Bottom-left**, tucked near footer
- **No visible trigger at all** — only `⌘ + .` shortcut + typing `/admin/unlock`

Reply with a preference (or "bottom-right + shortcut" is my default) and I'll build it.
