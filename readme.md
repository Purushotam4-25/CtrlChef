# CtrlChef

Dish availability is *derived from live ingredient stock*, not manually
toggled. Order enough paneer dishes and every dish that uses paneer greys
out automatically, on every screen, in real time — nobody has to remember
to 86 an item.

## Team Name

SyncPoint

## Tech Stack

- **Firebase** — Firestore (database + realtime listeners), Auth, Cloud
  Functions, Hosting. One `firebase deploy` ships hosting, functions, and
  security rules together as one unit, which matters a lot the night
  before a submission deadline.
- **Vite + React** — frontend build and UI.
- **Tailwind CSS** — styling.
- **React Router** — routing (guest routes public, staff routes gated by
  role).
- **lucide-react** — icons.

## User Stories Completed

Honest status, mapped to the problem statement's tiers. Nothing below is
claimed unless it actually works against the real backend.

**Bronze — done.** UI/UX for guest and staff surfaces, built off the
provided mockups.

**Silver — done.** Digital menu with live availability, order management,
queue check-in, and billing are all built and wired to real Firestore
data. Authentication supports email/password, Google OAuth, and Firebase
email verification as the OTP-equivalent (see AI Usage note: none of this
is AI-generated fluff — it's Firebase's own sign-in providers). Role-based
access is enforced both client-side and in `firestore.rules`.

**Gold — done.** Order management, table management, inventory tracking,
staff management, sales tracking, and analytics all work end to end. The
manager dashboard has full CRUD on Orders (read-only history), Tables,
Menu/dishes, Inventory, and Staff, plus dietary tags and site branding.

**Platinum — done.** Stock forecasting and operational insights are real,
computed from actual order history (see below — it's a heuristic, not ML,
and is labelled as such). The manager "Assistant" tab answers three fixed,
grounded questions through a real Gemini call, with an automatic fallback
to Groq and then to a plain-English template if both APIs are unavailable
(see AI Usage below and `functions/assistant.js`).

## AI Usage

**In the product:** the manager "Assistant" tab (`askAssistant` in
`functions/assistant.js`) answers three fixed questions — low stock,
busiest hour, what to 86 — grounded in real `getStockForecast`/
`getSalesAnalytics` data, never invented numbers. It tries Gemini first,
falls back to Groq if Gemini is slow or unavailable, and falls back again
to a plain-English template if both APIs fail — the app never hangs or
breaks waiting on a third-party API. Each answer shows which tier actually
answered (Gemini / Groq / Offline) so the fallback is visible, not hidden.
No LLM key is ever exposed client-side — both calls happen inside the
Cloud Function, with the keys bound as Firebase secrets.

**During development:** AI coding assistants (Claude) were used throughout
to help write, refactor, and review code for this project.

## Hosted Application Link

`https://ctrlchef-b8ba2.web.app/` 

## How it works

### Concurrency

Stock decrement is a real Firestore **transaction**, not a read-then-write
(`functions/orders.js`, `addOrderItem`). Within one transaction it reads
current stock, validates there's enough for the order, decrements it, and
recomputes `available` on every dish that shares an affected ingredient —
all as one atomic unit. Firestore only commits a transaction if none of
the documents it read changed while it ran; if two waiters try to sell the
last portion of paneer at the same instant, the second transaction
automatically retries against the updated stock instead of both
succeeding. `cancelOrderItem` reverses the same logic to restore stock.

### Security

Clients cannot write `currentStock` or `available` directly at all —
enforced in [`firestore.rules`](./firestore.rules), which requires those
fields to stay unchanged on any client-side update to `dishes` or
`ingredients`. Every real mutation (placing an order, cancelling an item,
advancing a kitchen ticket, seating a table, closing a bill, restocking an
ingredient) goes through a Cloud Function. Those functions re-check the
caller's role server-side via `requireStaffRole` in
`functions/lib/auth.js` — role checks are not just a hidden UI button,
they're enforced independently by both the rules and the functions.

### Forecast

The stock forecast (`functions/forecast.js`, `getStockForecast`) is a
rolling average over a configurable lookback window (default 7 days):
total ingredient consumption in that window divided by the number of
days, projected forward against current stock. It's a heuristic, not a
machine learning model — labelled that way on purpose rather than
overstating it.

### Assistant

`askAssistant` (`functions/assistant.js`) splits cleanly into `fetchData`
(Firestore only, reused from the same `functions/lib/` code the forecast and
analytics callables use, so the assistant can't report a different number
than the tiles on screen) and `phrase` (Gemini, with a ~5s timeout, then
Groq, then a plain-English template — each tier only runs if the one before
it threw or timed out). Manager-only, same `requireStaffRole` guard as every
other manager callable.

## Demo Credentials

Seeded by `functions/seed.js`. Password is the same for all three:

| Email | Role |
|---|---|
| `priya@ctrlchef.demo` | waiter |
| `ramesh@ctrlchef.demo` | chef |
| `anita@ctrlchef.demo` | manager |

Password: `ctrlchef123`

## Local Dev

```
firebase emulators:start        # from repo root — Firestore, Auth, Functions, Hosting emulators
```

```
cd functions
npm install                     # not committed — do this before anything else in functions/
npm run seed                    # loads demo menu, ingredients, tables, and the 3 staff logins above
```

```
npm run dev                     # from repo root — Vite dev server, proxies to the hosting emulator
```

## Testing

Five emulator-backed test suites, run from inside `functions/` with the
emulators running:

```
npm run test:rules
npm run test:auth
npm run test:forecast
npm run test:analytics
npm run test:inventory
```
