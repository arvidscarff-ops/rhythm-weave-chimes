## How to access the admin CMS today

- URL: `/admin/unlock` → enter passcode → redirects to `/admin/packs`.
- The passcode is the value stored in the `ADMIN_PASSCODE` secret (Lovable Cloud → Secrets). It is not set yet — you'll be prompted to add it the first time you try to unlock. You choose the value; it lives server-side only and is checked with a timing-safe compare.
- No admin role is needed. Anyone who knows the passcode gets in for 7 days (encrypted session cookie).

## What I'll build

### 1. Glassmorphic passcode keypad (new component)
`src/components/admin/PasscodeKeypad.tsx`
- Frosted glass panel: `backdrop-blur-xl`, layered translucent surfaces, soft inner highlight, ambient outer glow that pulses slowly (breathing).
- 6 empty dots at top that fill in as digits are entered (spring-in animation, subtle glow on fill).
- 3×4 numeric grid (1–9, ⌫, 0, ↵). Buttons have:
  - Glass surface with specular top edge
  - Press: scale-down + brief inner light bloom (haptic feel)
  - Idle: very slow hue-drifting radial glow behind the panel
  - Hover: soft lift + brightening ring
- **Direct keyboard input works without focusing anything** — attaches a `window` keydown listener while mounted (0–9, Backspace, Enter, Escape).
- On 6 digits (or Enter) → auto-submits to `unlockAdmin`.
- Shake + red glow flash on wrong passcode, clears digits.
- Success: green glow sweep, then navigate.

### 2. Replace the current `/admin/unlock` page
`src/routes/admin.unlock.tsx` becomes a full-screen dark scene:
- Animated hazy gradient background (slow drifting blobs, low opacity).
- Centered `PasscodeKeypad`.
- Small caption: "Enter passcode to continue".
- Removes the current Input/Label/Button form.

### 3. Passcode required for every admin action (no persistent session)
Change the gate model from "unlock once for 7 days" to "prompt every time":
- Remove the 7-day session cookie usage. `isAdminUnlocked` / `lockAdmin` become unused.
- New server fn `verifyAdminPasscode({ passcode })` — timing-safe compare only, returns `{ ok }`. No session write.
- All admin server fns (`listAdminPacks`, `createAdminPack`, `updateAdminPack`, `deleteAdminPack`, `updateAdminSlot`, `registerAdminSample`, `signedCoverUrl`) get a new required `passcode` input and verify it inside the handler before doing work. Wrong/missing passcode → 401.
- New client helper `useAdminPasscode()` — opens the glass keypad as a modal, resolves with the entered passcode, caches it in memory only (React state, not localStorage) for the current tab session so you don't retype between clicks. Cleared on tab close or explicit "Lock" button.
- `/admin/packs` route: on mount, if no in-memory passcode, opens the keypad modal. Every mutation/query passes the cached passcode; if the server rejects it, cache is cleared and the modal reopens.
- "Admin roles" concept: not currently in the codebase — nothing to remove. Access is purely passcode-based, as you asked.

### 4. Keep it feeling "alive"
- Panel: continuous 8s ease-in-out glow breathing (opacity + blur radius oscillation on a pseudo-element).
- Background: two slow-moving radial gradients (30–45s loops) in indigo/violet/teal at low opacity.
- Digits dots: on fill, tiny particle-free bloom (box-shadow spring).
- Button press: uses a short GPU transform (100ms) — no layout thrash.
- All motion via CSS + a light `framer-motion` usage already available; no new deps.

## Technical notes (for the record)

- Keyboard listener uses `useEffect` with `window.addEventListener('keydown', …)`, ignores when `event.metaKey/ctrlKey` set; prevents default for digit/Backspace/Enter so it can't scroll or submit background forms.
- Passcode cached only in a React context provider mounted at `/admin` layout scope — never written to storage. Refresh = re-prompt (matches your "every time" requirement at the strongest interpretation; if you'd rather it persist for the tab lifetime only, that's already what the in-memory cache gives you between clicks).
- Server functions: `passcode` added to each `inputValidator`; verification is a shared helper `assertPasscode(pass)` living in `gate.server.ts` (server-only).
- Types file (`packs.functions.ts`) exported `AdminPack`/`AdminSlot` unchanged.

## Question before I build

**How strict should "required every time" be?**
- (A) Prompt once per tab (cached in memory until refresh/close). Feels alive but not annoying.
- (B) Prompt on every single admin action (every save, every upload). Maximum security, higher friction.

I'll default to (A) unless you say (B).
