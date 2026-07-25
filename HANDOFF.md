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

Tested a lot — 41 cases across 5 test suites (`test:rules`, `test:auth`,
`test:forecast`, `test:analytics`, `test:inventory`), plus manual checks
against real seeded data whenever something changed.

Frontend hasn't started — still the default scaffold. Gemini assistant's
on hold — need to sort out API keys and scope first.

Run emulators with `firebase emulators:start` from the repo root. Run
`npm install` inside `functions/` first, it's not committed.

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
