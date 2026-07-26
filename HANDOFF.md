# Handoff — CtrlChef

Read this first, then check `AGENTS.md` and `plans/`.

## Current State

**Last updated:** 2026-07-27

CtrlChef is a Firebase restaurant app where dish availability follows live
ingredient stock. Orders, kitchen tickets, tables, queue, restocking,
forecasting, analytics, and the public menu are working locally.

The frontend is Vite + React. The backend is Firebase Functions and Firestore.
Guest routes are public; staff routes are role-gated. All state-changing
actions go through Cloud Functions.

Firebase project: `ctrlchef-b8ba2`. Blaze is enabled. `GEMINI_API_KEY` and
`GROQ_API_KEY` are saved as Firebase secrets, but the LLM function is not built
yet. The app is not deployed yet.

## What Still Needs Doing

1. Change Functions from Node 24 to Node 22, then deploy and verify the live
   app.
2. Add Google sign-in, email verification, signup, and password reset.
3. Build the manager-only LLM assistant with Gemini → Groq → template fallback.
4. Add manager operations screens: Orders, Tables, Menu, and Inventory CRUD.

Start with `plans/13-priority-roadmap.md`. Detailed plans live in `plans/`.

## Local Commands

- `npm install` — frontend dependencies
- `npm --prefix functions install` — Functions dependencies
- `firebase emulators:start` — local Firebase suite
- `npm --prefix functions run seed` — demo data for emulators only
- `npm run dev` — frontend dev server
- `npm run build` — production frontend build

## Important Notes

- The seed script is deliberately emulator-first. Do not point it at
  production without an explicit production-seeding plan.
- Current tests: 47 across rules, auth, orders, forecast, analytics, and
  inventory.
- Existing staff demo accounts are created by `functions/seed.js`.
- Google sign-in does not grant a staff role on its own. A matching `staff`
  document is still required.

## Session Log

### 2026-07-27 — LLM credentials ready

Blaze was confirmed and Gemini/Groq keys were saved as Firebase secrets. No
application code has been changed or deployed yet.

### 2026-07-26 — Roadmap

Added one roadmap that ranks deployment and auth first, followed by manager
CRUD, the LLM assistant, guest tracking, COGS, and customer CRM.

### 2026-07-26 — Audit and demo data

Fixed order-cancellation stock restore and chef cancellation permissions.
Added a week of demo orders and wrote the README and project notes.

### 2026-07-26 — Frontend polish

Renamed the app to CtrlChef, added guest dark mode, a live waiter queue, and
shared Firestore listeners.

### 2026-07-26 — Frontend build

Built the guest and staff interfaces and connected them to Firebase. Added a
server-side queue wait estimate and demo staff accounts.

### 2026-07-25 — Billing and clock-in

Added final bill details and self-service staff clock-in/out.

### 2026-07-25 — Restocking

Added manager-only restocking with availability updates.

### 2026-07-25 — Analytics and forecast

Added sales analytics, table turnover, and low-stock forecasting.

### 2026-07-25 — Core operations

Built secure ordering, kitchen tickets, tables, Firestore rules, and emulator
setup.
