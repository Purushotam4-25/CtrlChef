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

Backend's got its spine now, on the `backend` branch, split by domain:
`functions/orders.js` (`addOrderItem`, `cancelOrderItem` — stock
check/decrement + availability recompute, one transaction so it can't
oversell), `functions/tickets.js` (`advanceOrderItemStatus` — the kitchen
state machine), `functions/tables.js` (`seatTable`, `closeOrder`,
`markTableClean` — the table lifecycle; `closeOrder` now refuses to close
while any item isn't `served` yet, so a kitchen ticket can't get silently
orphaned). `functions/index.js` just initializes the app and re-exports
from those three. `functions/seed.js` writes demo ingredients/menu/tables.
Shared logic: `functions/lib/availability.js` (is this dish available) and
`functions/lib/auth.js` (`requireStaffRole`, `WAITER_OR_MANAGER`).

Real security is in on both layers: `firestore.rules` locks down direct
client access per role (public menu reads, staff-only order/table/
ingredient reads, manager-only menu/inventory edits, `available` and
`currentStock` never hand-editable, queue check-ins need a sane party
size), and every Cloud Function checks the caller's staff role before
doing anything — `addOrderItem` also now records `createdBy` from the
verified `request.auth.uid`, not a client-supplied field. Tested with
`npm run test:rules` and `npm run test:auth` (both need the emulators
running — see each file's header comment for which ones).

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

### 2026-07-25 — Code review fixes
Ran `/code-review` on the table-state-machine + security-rules work above
before pushing; it found 3 real bugs and a few smaller things, fixed here.
`closeOrder` now refuses to close while any item isn't `served` yet
(previously it didn't check at all — a kitchen ticket still `preparing`
would silently vanish from view and its reserved stock would never come
back). `addOrderItem` now records `createdBy` from the verified
`request.auth.uid` instead of a client-supplied field that anyone could've
spoofed. `advanceOrderItemStatus`'s status validation used a plain object
lookup (`ADVANCE_ROLES[newStatus]`) that a crafted `newStatus: "__proto__"`
could sail through, crashing the function — switched to
`Object.hasOwn()`. Also deduped the repeated waiter/manager role array
into `functions/lib/auth.js`, split `functions/index.js` (~350 lines, 6
unrelated functions) into `orders.js`/`tickets.js`/`tables.js` with
`index.js` just re-exporting, added minimal field validation to the
`queue` create rule (sane party size, can't check in as already-seated),
factored the repeated "field can't change" rules pattern into one
`unchanged()` helper, and added `functions/test-auth.js` — an automated
version of the manual curl+Auth-emulator testing from earlier, so the
Cloud Function auth guards have a repeatable check the way the rules
already did. All of it verified against the emulators again afterward:
`test:rules` (14 cases), `test:auth` (12 cases), plus manual spot-checks
on each of the 3 bug fixes specifically.
