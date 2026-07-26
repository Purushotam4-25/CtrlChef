# CtrlChef

Web app.

## What this is

CtrlChef is a smart restaurant management system (VibeAthon 6.0 hackathon
submission). Core idea: dish availability is derived from live ingredient
stock, not manually toggled — ordering a dish decrements the ingredients
it uses inside a Firestore transaction, and every dish sharing an affected
ingredient gets its `available` flag recomputed in that same transaction.
Guests get a public menu/queue with no login; staff (waiter, chef,
manager) sign in and see role-gated tools for orders, kitchen tickets,
tables, inventory, and analytics. "Correct" here means stock and
availability never drift out of sync, even under concurrent orders — see
`functions/orders.js`.

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
| `src/` | frontend application source (Vite + React) |
| `functions/` | Cloud Functions backend — orders, tickets, tables, inventory, forecast, analytics, auth |
| `firestore.rules` | Firestore security rules |
| `HANDOFF.md` | cross-session/cross-agent state, read first |
| `WORKLOG.md` | running changelog, newest first |
| `plans/` | one file per plan, shared across AI assistants |

## Dev environment / commands

| Task | Command |
|---|---|
| install (frontend) | `npm install` (repo root) |
| install (functions) | `npm install` inside `functions/` — separate install, easy to miss |
| emulators | `firebase emulators:start` (repo root) |
| seed demo data | `npm run seed` inside `functions/`, with emulators running |
| dev server | `npm run dev` (repo root) |
| build | `npm run build` (repo root) |
| tests | `npm run test:rules` / `test:auth` / `test:forecast` / `test:analytics` / `test:inventory`, inside `functions/`, with emulators running |

## Deployment

`firebase deploy` from the repo root ships hosting (`dist/`, built by
`npm run build`), Cloud Functions, and Firestore rules/indexes together.
Firebase project: `ctrlchef-b8ba2`. Requires the Blaze billing plan —
Cloud Functions need it even within the free tier. No env vars to set:
the frontend fetches Firebase config from `/__/firebase/init.json` at
runtime.

## Working agreement

- Backend lives in `functions/`, split by domain (`orders.js`,
  `tickets.js`, `tables.js`, `forecast.js`, `analytics.js`,
  `inventory.js`); `index.js` just re-exports.
- Every state-changing client action goes through a Cloud Function, never
  a direct Firestore write — enforced in `firestore.rules` and re-checked
  server-side in `functions/lib/auth.js`.
- Run the relevant `functions/` test suite after touching backend logic.

## Known issues / open decisions

_(none yet)_
