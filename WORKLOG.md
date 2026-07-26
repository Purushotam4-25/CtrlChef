# CtrlChef Worklog

Newest entry first. Keep entries short and factual.

---

## 2026-07-27 — LLM setup ready

Confirmed Blaze and saved the Gemini and Groq keys as Firebase secrets. The
assistant code still needs to be built and deployed.

---

## 2026-07-26 — Proper billing: persisted bills, discounts, split checks

`closeOrder` used to compute a bill and hand it back once, never saving it —
so anywhere that showed a closed order's bill later had to recompute it from
the restaurant's *current* service-charge/GST %. Change either later and
every past bill silently changes with it. Fixed by persisting the actual
bill (`order.bill`) at close time, computed by a new shared
`functions/lib/billing.js`.

Same change adds what `closeOrder` was missing to be a real billing step:
discounts (flat or %, applied before tax), and a required payment method
(cash/card/upi) logged for reporting — no real payment gateway, the spec
keeps that explicitly out of scope, this is just a manually-picked tag.
`getSalesAnalytics` now breaks sales down by payment method too.

Bill splitting is new: a waiter can split a check evenly across N names, or
by assigning specific items (down to the unit, for shared multi-qty lines)
to named people, before closing. It's a calculator, not a settlement system
— nothing about the split is sent to the backend or persisted, the order
still closes atomically in one `closeOrder` call once everyone's amount is
shown. The one real algorithm here is `largestRemainderSplit` in the new
`src/lib/splitBill.js` — makes sure split shares always sum exactly to the
real total (no fractional-rupee drift), which matters because these are
numbers people actually hand over in cash.

Seed data now writes a `bill` + weighted `paymentMethod` per backdated order
too, reusing the real `computeBill` instead of a fourth copy of the tax
formula. New `test:billing` suite (7 cases) — including the one that
actually proves the fix: close an order, change `gstPct`, confirm the
already-closed order's bill didn't move. 61 backend assertions passing now
across 7 suites, plus a small framework-free self-check for the split math
(`src/lib/test-splitBill.js`, `npm run test:splitBill`).

Branched fresh off `frontend`, not off the (separate, also uncommitted)
menu/tags/branding work from earlier today — the two are independent and
merged separately. The manager Orders tab reads `order.bill` directly
instead of recomputing it, now that it's persisted.

---

## 2026-07-26 — Delivery roadmap

Added `plans/13-priority-roadmap.md` to rank deployment, auth, manager CRUD,
the LLM assistant, and later work.

---

## 2026-07-26 — Audit and demo data

Fixed two order bugs, seeded a week of demo history, wrote the README, and
added tests. The suite has 47 passing cases.

---

## 2026-07-26 — Frontend polish

Renamed the app to CtrlChef, added guest dark mode and a live queue, and
reduced duplicate Firestore listeners.

---

## 2026-07-26 — Frontend build

Built the guest and staff app, connected it to Firebase, and added demo staff
accounts plus a server-side queue wait estimate.

---

## 2026-07-25 — Billing and clock-in

Added final bill details and staff clock-in/out.

---

## 2026-07-25 — Restocking

Added manager-only restocking with live availability updates.

---

## 2026-07-25 — Analytics and forecast

Added sales analytics, table turnover, and stock forecasting.

---

## 2026-07-25 — Core operations

Built secure ordering, kitchen tickets, tables, Firestore rules, and emulator
support.
