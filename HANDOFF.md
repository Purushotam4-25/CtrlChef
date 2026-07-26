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

**Last updated**: 2026-07-26

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

Tested a lot — 44 cases across 5 test suites (`test:rules`, `test:auth`,
`test:forecast`, `test:analytics`, `test:inventory`), plus manual checks
against real seeded data whenever something changed.

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

Run emulators with `firebase emulators:start` from the repo root, `npm
run seed` inside `functions/` to load demo data, `npm run dev` at the
root for the frontend (proxies to the hosting emulator for Firebase
config, so no env vars needed). Run `npm install` inside `functions/`
first, it's not committed — same for the root `node_modules`.

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
