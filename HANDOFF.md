# Handoff — CtrlChef

Read this first, then check `AGENTS.md` and `plans/`.

## Current State

**Last updated:** 2026-07-27

CtrlChef is a Firebase restaurant app where dish availability follows live
ingredient stock. Orders, kitchen tickets, tables, queue, restocking,
forecasting, analytics, billing (with discounts and bill splitting), the full
manager dashboard (menu/inventory/tables/staff CRUD, dietary tags, site
branding), and the public menu are working locally.

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
4. Manually click through the new manager CRUD screens and billing/split-bill
   UI in a browser — both merged in without a manual pass.

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
- Current tests: 52 across rules, auth, orders, forecast, analytics,
  inventory, and menu CRUD, plus 7 billing cases and a 4-case split-math
  self-check.
- Existing staff demo accounts are created by `functions/seed.js`.
- Google sign-in does not grant a staff role on its own. A matching `staff`
  document is still required.

## Session Log

### 2026-07-27 — Merge billing and manager-CRUD branches

Merged the billing/split-bill and manager-CRUD worktree branches into
`frontend`. Fixed the Orders tab reading a live-recomputed bill instead of
the now-persisted `order.bill` — see `WORKLOG.md`.

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

### 2026-07-26 — Manager dashboard overhaul: full CRUD, tags, branding

Closed the CRUD gap from `plans/08-manager-crud.md`: added Orders (read-only
history), Tables, Menu, and Settings tabs, plus add/edit/delete on Inventory
and Staff. New backend: `upsertDish`, `upsertIngredient`, `deleteIngredient`,
`forceResetTable`, `createStaffMember`. Added dietary tags (manager-maintained
list on the restaurant doc, per-dish selection, guest badges + filter). Fixed
the staff Login page and ops sidebar to read the restaurant name instead of
hardcoding "CtrlChef", and kept the browser tab title in sync on both
surfaces. See `WORKLOG.md` for details.

### 2026-07-26 — Proper billing: persisted bills, discounts, bill splitting

`closeOrder` now persists the computed bill instead of recomputing it from
the restaurant's current tax/service-charge settings, added discounts (flat
or %) and a required payment method, and waiters can split a check evenly or
by item before closing. See `WORKLOG.md` for details.

### 2026-07-25 — Billing and clock-in

Added final bill details and self-service staff clock-in/out.

### 2026-07-25 — Restocking

Added manager-only restocking with availability updates.

### 2026-07-25 — Analytics and forecast

Added sales analytics, table turnover, and low-stock forecasting.

### 2026-07-25 — Core operations

Built secure ordering, kitchen tickets, tables, Firestore rules, and emulator
setup.
