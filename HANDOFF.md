# AI Handoff — Shared Working Context

> **For any AI assistant working on this project.**
> Read this file at the start of your session — also read `AGENTS.md` for
> the full project rules. Update "Current State" and append a "Session Log"
> entry before you finish.

## Project One-Liner

ngs-h — web app.

## Key Files

| File | Role |
|---|---|
| `AGENTS.md` | Full project rules, layout, commands |
| `WORKLOG.md` | Running changelog (newest first) |
| `plans/` | Shared plans — one file per plan |

## Current State

**Last updated**: 2026-07-25 by claude

Firebase project wired up (`ctrlchef-b8ba2`): Firestore, Functions, Hosting,
emulator suite (auth/functions/firestore/hosting/UI) all configured in
`firebase.json`. Default 30-day-open Firestore rules (expires 2026-08-24,
replace before then — dedicated Day 3 task per the spec). Spec/roadmap is
local-only at `VibeAthon_SmartRestaurant_Spec_Roadmap.md` — gitignored, do
not commit.

Backend spine now exists (`branch: backend`):
- `functions/seed.js` (`npm run seed` inside `functions/`) — writes demo
  ingredients + dishes to the emulator, deliberate ingredient overlap.
- `functions/index.js` — `addOrderItem` callable Cloud Function: one
  Firestore transaction does stock check, decrement, dish-availability
  recompute, and appends the line to the table's open order (creates one if
  none exists). This is the mechanic that prevents overselling when two
  waiters order concurrently.
- `functions/lib/availability.js` — shared `computeAvailable()`, used by
  both the seed script and the function so "is this dish available" is
  computed one way everywhere.

Still stock/untouched: `public/index.html`, no frontend app code, no auth,
no security rules beyond the default.

Run emulators: `firebase emulators:start` (from repo root). Functions
depend on `firebase-admin`/`firebase-functions` — run `npm install` inside
`functions/` first (not committed, per `.gitignore`).

## Active Decisions

_(none yet)_

## Session Log

> Append a new entry at the BOTTOM each session, in the order sessions
> happen — do NOT reorder or move it to the top. (This is the opposite of
> WORKLOG.md, which is newest-on-top. HANDOFF's log reads top-to-bottom as
> "how we got here"; WORKLOG reads newest-first as "what do I need to know
> right now.")
> Format: `### YYYY-MM-DD — [AI name] — [summary]`

### 2026-07-25 — project-init — Scaffolding
Created initial structure: AGENTS.md, CLAUDE.md, GEMINI.md, HANDOFF.md,
WORKLOG.md, .gitignore, src/, plans/.

### 2026-07-25 — claude — Firebase emulator setup
Ran `firebase init` (Firestore, Functions, Hosting) for project
`ctrlchef-b8ba2`; configured emulator suite in `firebase.json`. Reviewed
git staging before push — everything was already staged correctly
(no node_modules, no secrets). Spec doc is kept local-only (gitignored,
not pushed). Next: replace default Firestore rules and stock
functions/hosting scaffold with real app code.

### 2026-07-25 — claude — Seed script + addOrderItem transaction
Built the Day 1 backend spine: `functions/seed.js` (demo ingredients +
menu, deliberate overlap) and `functions/index.js` `addOrderItem` — a
callable Cloud Function doing stock-check/decrement/availability-recompute/
order-append as one Firestore transaction. Extracted `computeAvailable()`
into `functions/lib/availability.js` so seed and function agree. Verified
both against the emulator directly (REST API checks + live calls), not
just read-through. Known rough edge: decimal kg stock math can flip a dish
unavailable slightly early due to float rounding — safe direction (blocks
rather than oversells) but worth a cleaner fix later (e.g. store stock in
integer grams). Next: table/staff seed data, kitchen ticket state machine,
security rules (still on the default open rule).
