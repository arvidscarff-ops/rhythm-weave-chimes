# Plan: "My Studio" — the unified dev console

Replace the current authenticated `/studio` route and the separate `/admin/packs` + `/admin/scales` pages with one passcode-gated hub at **`/studio`**. One passcode prompt on entry unlocks every tool for the session.

## What the user sees

- Visit `/studio` → passcode keypad. Enter correct code → land in My Studio.
- My Studio is a tabbed workspace:
  - **Packs** — the existing Sound Packs CMS (moved from `/admin/packs`).
  - **Scales** — the Scale & Progression composer (moved from `/admin/scales`).
  - Room to add more dev tools later (presets, scenes, diagnostics).
- Sidebar/top-nav lets the user switch tabs without re-entering the passcode.
- A small "Lock" button clears the session and returns to the keypad.
- The bottom-right admin dot and `⌘/Ctrl + .` shortcut now open `/studio` (keypad if locked, hub if unlocked).

## Routing changes

```text
src/routes/
  studio.tsx              → passcode gate + shell with <Outlet />
  studio.index.tsx        → default landing (overview / tool picker)
  studio.packs.tsx        → moved from admin.packs.tsx
  studio.scales.tsx       → moved from admin.scales.tsx
```

Old routes stay as thin redirects for one release:
- `/admin/packs` → `/studio/packs`
- `/admin/scales` → `/studio/scales`
- `/admin/unlock` → `/studio`
- Authenticated `_authenticated/studio` → removed (its preset UI, if still used, folds into a future Studio tab; not in scope this pass).

## Passcode gate

- Reuse existing `verifyAdminPasscode` server fn and `PasscodeProvider`/`usePasscode` context — no new backend surface.
- `studio.tsx` mounts `PasscodeProvider` and, on mount, calls `ensure()`. Until the passcode is verified, the route renders the full-screen keypad (same visual as `/admin/unlock` today) instead of `<Outlet />`.
- Once unlocked, the passcode lives in the in-memory context for the tab session. Server functions that need it (pack/scale writes) read it from the context, unchanged.
- "Lock" button calls `passcode.clear()` and rerenders the gate.

## Component moves (no logic changes)

- `admin.packs.tsx` body → `studio.packs.tsx` component, wrapped in the Studio shell instead of its own page chrome.
- `admin.scales.tsx` body → `studio.scales.tsx` same treatment.
- Existing "back to app" buttons inside those pages become the Studio nav.

## Entry points

- `AdminTrigger` (corner dot + shortcut) navigates to `/studio` instead of `/admin/packs`.
- Any in-app links pointing to `/admin/*` are updated to `/studio/*`.

## Out of scope

- No DB schema changes.
- No changes to pack/scale editor internals — only their location and page chrome.
- Merging the authenticated presets studio into My Studio is a follow-up.

## Open question

The current authenticated `/studio` (login-gated user presets) will be removed by this refactor. Confirm that's fine — presets today are per-user (Supabase auth), and folding them under a shared passcode means every studio visitor sees the same preset list. If presets should stay per-user, we'd instead keep `_authenticated/studio` and only move admin tools into My Studio.
