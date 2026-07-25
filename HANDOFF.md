# Handoff — Shared Working Context

> Read this before starting work — also check `AGENTS.md` for the full
> rules. Update "Current State" and add a Session Log entry when you're
> done for the day.

## Project One-Liner

ngs-h — web app.

## Key Files

| File | Role |
|---|---|
| `AGENTS.md` | Full project rules, layout, commands |
| `WORKLOG.md` | Running changelog (newest first) |
| `plans/` | Shared plans — one file per plan |

## Current State

**Last updated**: 2026-07-25

Firebase project (`ctrlchef-b8ba2`) is set up — Firestore, Functions,
Hosting, the full emulator suite, all in `firebase.json`. Spec/roadmap doc
stays local only, at `VibeAthon_SmartRestaurant_Spec_Roadmap.md`, gitignored.

Backend's got its spine now, on the `backend` branch: a seed script for
demo ingredients/menu/tables (`functions/seed.js`), the order function
(`functions/index.js`, `addOrderItem`) that checks stock, decrements it,
and recomputes what's available — all in one transaction so it can't
oversell — the kitchen ticket side (`advanceOrderItemStatus`,
`cancelOrderItem`), and the table lifecycle (`seatTable`, `closeOrder`,
`markTableClean`). Shared logic for "is this dish available" lives in
`functions/lib/availability.js`.

Real security is in now too, on both layers: `firestore.rules` locks down
direct client access per role (public menu reads, staff-only order/table/
ingredient reads, manager-only menu/inventory edits, `available` and
`currentStock` never hand-editable), and every Cloud Function checks the
caller's staff role via `functions/lib/auth.js` before doing anything —
previously any of them could be called with no login at all. Tested with
`npm run test:rules` (needs the Firestore emulator running) and by hand
against the Auth emulator for the functions.

Frontend side is still just the default scaffold — no app code, no auth
wired up in a client yet.

Run emulators with `firebase emulators:start` from the repo root. Run
`npm install` inside `functions/` first, it's not committed.

## Active Decisions

_(none yet)_

## Session Log

> Add a new entry at the bottom each session, in order — don't reorder or
> move it to the top. (Opposite of WORKLOG.md, which is newest-first.)
> Format: `### YYYY-MM-DD — [summary]`

### 2026-07-25 — Scaffolding
Set up the base structure: AGENTS.md, CLAUDE.md, GEMINI.md, HANDOFF.md,
WORKLOG.md, .gitignore, src/, plans/.

### 2026-07-25 — Firebase + emulators
Got the Firebase project (`ctrlchef-b8ba2`) wired up — Firestore,
Functions, Hosting, emulator suite. Checked what was staged before
pushing (no node_modules, no secrets). Spec doc stays local, not pushed.
Default Firestore rules expire 2026-08-24, need real ones before then.

### 2026-07-25 — Seed script + order/stock logic
Backend spine's in: seed script for the demo menu/ingredients, and the
order function that checks stock, decrements it, recomputes availability,
and adds the line to the table's tab — all as one transaction so two
orders can't double-spend the same stock. Tested against the emulator
directly. One rough edge: decimal stock math can flip a dish unavailable
a touch early from rounding, not a big deal for now. Next up: tables,
kitchen tickets, real security rules.

### 2026-07-25 — Kitchen ticket state machine
Added `advanceOrderItemStatus` (moves an item received → preparing →
ready → served, one step at a time, no skipping or going backwards) and
`cancelOrderItem` (only while still `received`, restocks the ingredients
it used). Items now get a random `itemId` when created so these can
target one specific line inside the order's items array. Ran the whole
flow against the emulator: ordered, tried to skip a stage (blocked),
advanced properly, tried to cancel a "preparing" item (blocked), then
ordered + cancelled a fresh item and confirmed stock went right back to
where it started. Next up: tables, real security rules.

### 2026-07-25 — Table state machine
Seeded 8 tables (2/4/6-tops) and added `seatTable`, `closeOrder`, and
`markTableClean` — empty → occupied → needs_cleaning → empty, each one
guarded so it only fires from the right starting state. Ran the full
cycle on the emulator: seated a table, tried seating it again (blocked),
put an order on it, closed the order (table flips to needs_cleaning,
order to closed), tried closing it twice (blocked), then cleaned it and
confirmed it's back to empty with `seatedAt` cleared. Next up: real
security rules — everything so far has been running wide open.

### 2026-07-25 — Real security rules, both layers
Two things were both wide open before this: `firestore.rules` (default
30-day rule) and the Cloud Functions themselves (no auth check at all —
anyone could've called `addOrderItem` with no login). Fixed both.
`firestore.rules` now does public menu reads, staff-only reads on orders/
tables/ingredients, manager-only menu/inventory edits, and blocks
`available`/`currentStock` from ever being hand-edited, even by a
manager. Every Cloud Function now calls `requireStaffRole()`
(`functions/lib/auth.js`) first, matching the spec's actual role split —
notably chef handles received→preparing→ready, waiter handles
ready→served, not just "any staff." Tested for real: added
`@firebase/rules-unit-testing` and a 13-case script (`npm run test:rules`)
covering guest/staff/manager reads and writes across every collection —
all pass. Also spun up the Auth emulator, created real waiter/chef/manager
test accounts, and called the functions with real ID tokens: confirmed
no-auth calls get rejected, wrong-role calls get rejected, and the
chef/waiter split on kitchen tickets works exactly as the spec describes.
Next up: manager analytics, low-stock forecasting, Gemini assistant —
Day 3 territory.
