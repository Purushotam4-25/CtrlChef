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
`firebase.json`. Default scaffold only — stock `functions/index.js` and
`public/index.html`, default 30-day-open Firestore rules (expires
2026-08-24, replace before then). Spec/roadmap is local-only at
`VibeAthon_SmartRestaurant_Spec_Roadmap.md` — gitignored, do not commit.
No app code written yet.

Run emulators: `firebase emulators:start` (from repo root).

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
