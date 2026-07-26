# Handoff — Shared Working Context

> Read this before starting work — also check `AGENTS.md` for the full
> rules. Update "Current State" and add a Session Log entry when you're
> done for the day.

## Project One-Liner

CtrlChef — smart restaurant system where dish availability is derived
from live ingredient stock instead of being toggled by hand.

## Key Files

| File | Role |
|---|---|
| `AGENTS.md` | Full project rules, layout, commands |
| `WORKLOG.md` | Running changelog (newest first) |
| `plans/` | Shared plans — one file per plan |

## Current State

**Last updated**: 2026-07-26 (manager dashboard overhaul, see below and the
latest `WORKLOG.md` entry — this section still describes everything before
that change; read both together for now).

The manager dashboard is no longer read-mostly. It's 9 tabs, grouped
(Operations: Orders/Tables · Catalogue: Menu/Inventory · People: Staff ·
Insight: Analytics/Forecast/Assistant · Settings), and a manager can now
actually create/edit/delete a dish, ingredient, table, or staff member —
`firestore.rules` already allowed it, the UI just never existed
(`plans/08-manager-crud.md`). New callables: `upsertDish` (derives
`ingredientIds` server-side, computes `available` on create and edit —
this is the one a client write genuinely can't do, since `available` is
rule-blocked on update), `upsertIngredient`, `deleteIngredient` (flips
dependent dishes unavailable in the same transaction as the delete),
`forceResetTable`, `createStaffMember`. Role change and staff removal stayed
direct Firestore writes since the rules already allow them unconditionally —
the only new logic there is a self-lockout guard so a manager can't demote or
delete their own account.

Dietary tags are new: `restaurants/{id}.dishTags` (manager-maintained list,
add/remove from the Menu tab) and a `tags` array per dish. Guests see badges
on the menu and can filter by tag.

Site branding (name/address/hours/service charge %/GST%) is now editable from
a Settings tab — the `restaurants/{id}` doc already supported all of this,
nothing could edit it before. Also fixed: the staff Login page and ops
sidebar were still hardcoding "CtrlChef" instead of reading the doc like the
guest side already did, and the browser tab title now updates live on both
surfaces.

52 tests passing (was 47) — new `test:menu` suite covers the two riskiest
bits: `ingredientIds` derivation and `available` recompute on both dish
create and edit, and the ingredient-delete cascade. **Not yet clicked through
in an actual browser** — no browser automation tool was available this
session, so the new manager-side forms are verified by a clean build + code
review + the backend suite, not a manual UI pass. Do that before relying on
this for a demo.

Everything below this point describes state as of the previous session.

Firebase's set up (`ctrlchef-b8ba2`) — Firestore, Functions, Hosting,
emulators, all working. Spec doc stays local, not pushed.

Backend's in good shape: ordering, kitchen tickets, tables, real
security (rules + auth checks on every function), low-stock tracking +
forecasting, manager analytics (sales, turnover), and now restocking too
(managers can actually add stock back in, not just watch it go down).
Code's split by domain — `orders.js`, `tickets.js`, `tables.js`,
`forecast.js`, `analytics.js`, `inventory.js` — `index.js` just re-exports
everything.

Order items snapshot the dish's name, price, and recipe at the moment
they're ordered, so editing or deleting a menu item later doesn't mess up
old numbers.

`closeOrder` now returns the final bill breakdown too (subtotal, service
charge, GST, total), and staff can clock themselves in/out without a
manager doing it for them.

Tested a lot — 47 cases across 6 test suites (`test:rules`, `test:auth`,
`test:orders`, `test:forecast`, `test:analytics`, `test:inventory`), plus
manual checks against real seeded data whenever something changed.

Frontend's built now — Vite + React + Tailwind + React Router, wired
straight to the Cloud Functions and Firestore listeners above. Guest side
(`/`, `/menu`, `/queue`) is public, no login. Staff side (`/waiter`,
`/chef`, `/manager`) sits behind Firebase Auth, gated by role from each
user's `staff` doc — a waiter only sees the table map, a chef only sees
tickets, a manager sees everything (five tabs: analytics, inventory,
forecast, assistant, staff).

Added one small function, `estimateQueueWait` — guests need a wait
estimate for the queue page but `tables` is staff-only in the rules, so
this computes it server-side instead of exposing raw table data.

Gemini assistant still isn't built server-side, so the manager's
"Assistant" tab answers its 3 fixed questions with plain templates over
real `getStockForecast`/`getSalesAnalytics` data — matches the spec's own
tier-3 fallback plan. Swap in a real Cloud Function once Gemini/Groq
keys exist.

Seed script (`functions/seed.js`) now also creates 3 demo staff logins
(Firebase Auth + matching `staff` docs) so the ops app has something to
sign in with out of the box — see the script for the password.

Real name is CtrlChef, not the mockup's placeholder "Tandoor & Tales" —
fixed everywhere, and restaurant name/address/hours now come from the
`restaurants/{id}` doc instead of being hardcoded in JSX (address/hours
are blank until someone fills in the real ones). Both surfaces have a
dark/light toggle now, guest included. Waiter screen has a live queue
panel next to the table grid — seats a party straight from the queue,
picking any empty table that fits. Data fetching is centralized now too
— one Firestore listener per collection per surface (`GuestDataContext`,
`OpsDataContext`) instead of every page opening its own, plus a
persistent Firestore cache so repeat visits don't refetch from scratch.

Run emulators with `firebase emulators:start` from the repo root, `npm
run seed` inside `functions/` to load demo data, `npm run dev` at the
root for the frontend (proxies to the hosting emulator for Firebase
config, so no env vars needed). Run `npm install` inside `functions/`
first, it's not committed — same for the root `node_modules`.

The seed script now also writes about 7 days of backdated orders, so
Analytics, Forecast, turnover and Revenue Tonight all have real numbers
instead of empty charts. Stock is tuned against that history so Forecast
shows three ingredients trending toward stockout. It seeds a couple of
waiting guests and one occupied table too, so no screen starts blank.
Re-running `npm run seed` clears the old orders first, so it's safe to run
repeatedly. The seed builds its timestamps in UTC on purpose — the
functions runtime reads them back that way, and using local time silently
shifts the hourly chart.

There's a full audit of the repo against the PS and the spec in
`plans/00-audit-findings.md`, with 11 numbered plans behind it. Worth
reading before picking up anything new.

**What's actually blocking the submission**, in order:

1. **Not deployed.** `ctrlchef-b8ba2.web.app` still 404s. Needs Blaze
   billing on first, and `functions/package.json` says node 24 — check
   Firebase accepts that for deploy before relying on it. Plan `01`.
2. **No Google OAuth, no OTP/email verification.** US2 wants both. Silver
   is stories 1-3 and Gold/Platinum are supersets of it, so this one gap
   caps the whole ranking. Plan `02`.
3. **README has two TODO placeholders** — team name and the hosted link.
4. **Assistant makes no LLM call.** Still templates over real data, which
   is the spec's own last-resort tier and honestly labelled, but Platinum
   wants real AI assistance. Plan `07`.

Smaller things still open: seating from the queue does `seatTable` and the
queue `updateDoc` as two separate calls, so if the second fails the table
is occupied but the party stays waiting forever (plan `05` has the
transactional fix); the guest home page still shows a hardcoded "~8 min"
average wait; and the public `queue` create rule doesn't cap the name field
or restrict which keys can be written.

## Active Decisions

_(none yet)_

## Session Log

> Add a new entry at the bottom each session, in order — don't reorder or
> move it to the top. (Opposite of WORKLOG.md, which is newest-first.)
> Format: `### YYYY-MM-DD — [summary]`

### 2026-07-25 — Scaffolding
Set up the base project structure.

### 2026-07-25 — Firebase + emulators
Firebase project wired up, emulator suite working.

### 2026-07-25 — Seed script + ordering
Seed script plus the core order function — checks stock, decrements it,
updates availability, all in one transaction so nothing double-spends.

### 2026-07-25 — Kitchen tickets
Orders move received → preparing → ready → served, one step at a time.
Can cancel a line while it's still received.

### 2026-07-25 — Tables
Tables go empty → occupied → needs_cleaning → empty, each move guarded.

### 2026-07-25 — Real security
Locked everything down — Firestore rules plus auth checks on every
function. Was wide open before this.

### 2026-07-25 — Code review fixes (round 1)
Found and fixed 3 real bugs: closing an order could skip unserved items,
`createdBy` was spoofable, a crafted status value could crash a function.
Also cleaned up the file structure and added an automated auth test.

### 2026-07-25 — Analytics + forecasting
Added stock forecasting and manager analytics (sales, table turnover).

### 2026-07-25 — Code review fixes (round 2)
Found and fixed a bug where deleting a menu item quietly broke historical
sales/forecast numbers. Tightened up input validation too.

### 2026-07-25 — Restocking
Added `restockIngredient` — before this, stock only ever went down (or
came back via a cancelled order), there was no way to record a real
delivery. Manager-only, updates stock/lowStock/availability together like
everything else does. Verified against real seeded data too.

### 2026-07-25 — Billing breakdown + staff clock-in
`closeOrder` now returns the actual final bill (subtotal + service charge
+ GST), not just the raw total — no new function needed, the numbers were
already there. Also let staff clock themselves in/out — a rules tweak, a
waiter couldn't even touch their own staff doc before this. 44 test cases
passing now.

### 2026-07-26 — Frontend build
Built the whole frontend off the design mockups — guest menu/queue,
waiter table map, chef tickets, manager dashboard, all wired to the real
backend (no more mock data). Added `estimateQueueWait` and seeded demo
staff logins to make that possible. Found and fixed a real race
condition in the auth flow (staff role wasn't loaded yet when the
post-login redirect ran, so it bounced back to the login screen).
Checked every screen against the emulators end to end.

### 2026-07-26 — Frontend overhaul
Rebranded to CtrlChef (was still the mockup's placeholder name/address),
added dark mode to the guest side, gave the waiter a live queue they can
actually act on, and cut the duplicate Firestore listeners that were
making pages feel slow on first visit. Also added hover states across
the board (there were none, anywhere) and stopped every action button
from being double-clickable mid-request. Wrote it up as 5 plans in
`plans/` first, then implemented all of them and re-verified end to end.

### 2026-07-26 — Audit, bug fixes, demo data
Audited the whole repo against the PS and the spec, wrote it up as 11
plans in `plans/`. Fixed two real bugs: `cancelOrderItem` restored stock
from the live dish instead of the item's `ingredientsUsed` snapshot (and
crashed outright if the dish had been deleted), and the chef's Cancel
button always got permission-denied because only waiter/manager were
allowed. Seeded a week of backdated orders so the analytics and forecast
screens finally have something to show. Wrote the README from scratch,
filled in AGENTS.md, deleted `test.txt`. 47 tests passing. Deploy and
Google OAuth are the two things still standing between this and Platinum.

### 2026-07-26 — Manager dashboard overhaul: full CRUD, tags, branding
Closed the CRUD gap from `plans/08-manager-crud.md`: added Orders (read-only
history), Tables, Menu, and Settings tabs, plus add/edit/delete on Inventory
and Staff. New backend: `upsertDish`, `upsertIngredient`, `deleteIngredient`,
`forceResetTable`, `createStaffMember`. Added dietary tags (manager-maintained
list on the restaurant doc, per-dish selection, guest badges + filter). Fixed
the staff Login page and ops sidebar to read the restaurant name instead of
hardcoding "CtrlChef", and kept the browser tab title in sync on both
surfaces. New `test:menu` suite (4 cases) covers `ingredientIds`
derivation, `available` recompute on create/edit, and the ingredient-delete
cascade — 52 tests passing overall. Did not manually click through the new UI
in a browser this session (no browser tool available) — verified via a clean
build, code review, and the backend suite instead. Worth a manual pass before
a demo.
