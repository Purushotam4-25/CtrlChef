# ngs-h Worklog

Append-only log of work sessions. Newest entry at the top. Each entry: date,
what changed, open questions.

---

## 2026-07-25 — Low-stock forecast + manager analytics

Two more roadmap items done: `getStockForecast` (rolling average
consumption per ingredient from order history → predicted days-to-stockout,
an honest heuristic, not ML) and manager analytics (`getSalesAnalytics` —
by dish/hour/day-of-week/staff, top/bottom 5; `getTableTurnoverStats` — avg
time a table's occupied, grouped by capacity since real party size isn't
tracked). Ingredients now carry a synced `lowStock` flag, but the actual
alert UI is left for the frontend — the data's already there. `closeOrder`
now stamps `closedAt`, which turnover math needed and didn't have before.
33 test cases across 4 suites, all passing, plus a manual run against the
real seeded restaurant. Deliberately skipped the Gemini assistant — that
needs external API keys and a scope conversation first, not built yet.

---

## 2026-07-25 — Code review fixes

`/code-review` on the previous two entries' work turned up 3 real bugs
before push: `closeOrder` could close an order with unserved items still
on it (kitchen ticket vanishes from view, its stock never comes back);
`addOrderItem` recorded `createdBy` from a client-supplied field instead
of the verified auth uid (spoofable); `advanceOrderItemStatus`'s status
validation could be bypassed with `newStatus: "__proto__"`, crashing the
function instead of rejecting cleanly. All three fixed. Also: split
`functions/index.js` into `orders.js`/`tickets.js`/`tables.js` (it'd grown
to ~350 lines of 6 unrelated functions), deduped a repeated role-array
literal, added party-size validation to the public `queue` create rule,
factored a repeated rules pattern into one helper, and added
`functions/test-auth.js` so the Cloud Function auth guards have an
automated test the way the Firestore rules already did. Re-verified
everything against the emulators: 14/14 rules cases, 12/12 auth cases,
plus manual spot-checks on each bug fix.

---

## 2026-07-25 — Real security rules

Everything's been running wide open until now — fixed both layers.
`firestore.rules`: public menu, staff-only reads on orders/tables/
ingredients, manager-only edits, and `available`/`currentStock` can never
be hand-edited by anyone, manager included. The Cloud Functions had zero
auth checks before this — anyone could've called them with no login —
so each one now checks the caller's staff role first, matching the
spec's actual split (chef cooks it, waiter delivers it, not just "any
staff"). Tested both properly: a 13-case rules script using Firebase's
official rules-testing library, plus real waiter/chef/manager accounts
created in the Auth emulator to call the functions with actual ID tokens
and confirm no-auth/wrong-role calls get rejected and correct-role calls
go through.

---

## 2026-07-25 — Table state machine

Tables exist now: 8 seeded, mixed 2/4/6-tops. `seatTable`, `closeOrder`,
and `markTableClean` walk a table through empty → occupied →
needs_cleaning → empty, each guarded to only work from the right starting
state. Ran the full loop on the emulator plus the invalid moves (seating
an occupied table, closing an already-closed order, cleaning a table
that isn't dirty) — all rejected correctly.

---

## 2026-07-25 — Kitchen ticket state machine

Order items can now move through their lifecycle: `advanceOrderItemStatus`
steps one item from received → preparing → ready → served, one stage at a
time — no skipping ahead, no going back once the chef's started.
`cancelOrderItem` pulls a line but only while it's still `received`, and
gives back whatever stock was reserved for it. Gave each item a random
`itemId` so these can find one specific line inside an order's items
array. Ran through the whole thing on the emulator: normal order, a
blocked skip-ahead, a blocked cancel-after-preparing, and a real
cancel that put the stock back exactly where it started.

---

## 2026-07-25 — Seed script + order/stock logic

Backend spine's in. Seed script writes the demo menu + ingredients (paneer,
rice, and base gravy overlap across a bunch of dishes on purpose, so the
auto-availability thing is obvious once you start ordering). The order
function checks stock, decrements it, recomputes which dishes are still
available, and adds the line to the table's tab — all wrapped in one
transaction so two orders at the same time can't double-spend the same
ingredient. Tested it live against the emulator, not just eyeballed.
Small known issue: decimal stock math rounds weird sometimes and a dish can
flip unavailable a touch early — not dangerous, just something to tidy up
later. No auth or real security rules on this yet.

---

## 2026-07-25 — Firebase emulator setup

Got Firebase set up — Firestore, Functions, Hosting, and the emulator
suite. Just the default scaffold for now, nothing custom. Double-checked
what was staged before pushing (no node_modules, no secrets). Spec doc
stays local, not pushed. Default Firestore rules expire 2026-08-24 —
need real ones before then.

---

## 2026-07-25 — Project scaffolded

Set up the base structure — AGENTS.md, CLAUDE.md, GEMINI.md, HANDOFF.md,
WORKLOG.md, .gitignore, src/, plans/.

---
