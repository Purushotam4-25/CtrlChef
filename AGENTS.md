# ngs-h

Web app.

## What this is

<!-- Fill in: the actual purpose, the core mechanism/approach, and what
"done" or "correct" looks like for this project. This is the part a fresh
session can't infer from the code alone. -->

## Rules for every session

- **Read `HANDOFF.md` first** — current state, open threads, session log.
- **Check `plans/`** before starting non-trivial work; create a plan if
  you're about to do something multi-step (see `plans/README.md`).
- **Update `WORKLOG.md`** (newest entry on top) for any meaningful change.
- **Update `HANDOFF.md`** — "Current State" and the Session Log — before
  ending a session.
- **Secrets never land in the repo.** Env vars only; keep `.env.example`
  in sync with every new variable the app reads.

## Layout

| Path | Role |
|---|---|
| `src/` | application source |
| `HANDOFF.md` | cross-session/cross-agent state, read first |
| `WORKLOG.md` | running changelog, newest first |
| `plans/` | one file per plan, shared across AI assistants |

<!-- Extend as real directories appear. Keep it to paths whose purpose isn't
obvious from the name. -->

## Dev environment / commands

<!-- Fill in exact commands with flags, e.g.
| Task | Command |
|---|---|
| install | |
| dev server | |
| test | |
| typecheck / lint | |
| build (as CI/host runs it) | |
-->

## Deployment

<!-- Host + how a deploy is triggered; required env var names (never values)
and where they're set; anything stateful (database, migrations, storage). -->

## Working agreement

<!-- Leave blank until a real convention emerges. -->

## Known issues / open decisions

_(none yet)_
