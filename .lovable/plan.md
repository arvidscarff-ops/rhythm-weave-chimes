## Problem

Visiting `/admin/packs` mounts `AdminBootstrap`, which immediately opens the passcode keypad. If the user cancels the keypad (clicks the backdrop, presses Escape, or closes it), the promise rejects, `ready` stays `false`, and the component returns `null` — the page becomes a blank screen with no navigation controls. The header (with the Home link) only renders inside `AdminUI` after unlock, so the user has no in-app way out and appears "stuck at the passcode screen."

Also: the top-right `X` in the keypad and the backdrop click both call `onCancel`, but `PasscodeProvider`'s `onCancel` only closes the modal — it doesn't navigate anywhere, so the blank page remains.

## Fix (scope: admin gate UX only)

1. `src/routes/admin.packs.tsx` — `AdminBootstrap`:
   - Track three states: `pending`, `ready`, `cancelled`.
   - When `ensure()` rejects (user cancelled), render a small fallback screen with:
     - "Passcode required to access admin" message
     - "Enter passcode" button → calls `ensure()` again
     - "Back to home" `<Link to="/">` button
   - No more silent `null` render.

2. `src/lib/admin/passcode-context.tsx` — no behavior change needed, but confirm `onCancel` still rejects the pending promise (it does) so the fallback triggers reliably.

3. Optional polish: in `PasscodeKeypad`, when the user hits `Escape` on the `/admin/packs` route, the same cancel path runs — the new fallback covers it.

No changes to `/admin/unlock`, no changes to the auth or Sound Pack CMS logic, no schema or server-function changes.

## Why this fixes "can't access other places of the app"

The preview iframe is currently rendering `null` on `/admin/packs` after cancel. The user has no visible link to leave. Adding a fallback with a Home link restores navigation. The rest of the app (`/`, `/studio`, `/dev`, `/auth`) is not gated by the passcode — only the admin CMS is — so once they can click Home they're free.
