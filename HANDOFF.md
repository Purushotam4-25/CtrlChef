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
Hosting, the full emulator suite, all in `firebase.json`. Firestore rules
are still the default wide-open ones (expire 2026-08-24, need real rules
before then — planned for Day 3). Spec/roadmap doc stays local only, at
`VibeAthon_SmartRestaurant_Spec_Roadmap.md`, gitignored.

Backend's got its spine now, on the `backend` branch: a seed script for
demo ingredients/menu (`functions/seed.js`), the order function
(`functions/index.js`, `addOrderItem`) that checks stock, decrements it,
and recomputes what's available — all in one transaction so it can't
oversell — and now the kitchen ticket side too: `advanceOrderItemStatus`
moves an item through received → preparing → ready → served one step at
a time, and `cancelOrderItem` lets a line be pulled (only while still
`received`) and gives the stock back. Shared logic for "is this dish
available" lives in `functions/lib/availability.js`.

Frontend side is still just the default scaffold — no app code, no auth
yet.

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
