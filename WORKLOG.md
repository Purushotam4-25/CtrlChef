# CtrlChef Worklog

Append-only log of work sessions. Newest entry at the top. Each entry: date,
what changed, open questions.

---

## 2026-07-26 — Manager dashboard overhaul: full CRUD, dietary tags, branding

The manager dashboard went from read-mostly to actually managing the
restaurant, closing the exact gap `plans/08-manager-crud.md` flagged: nothing
could create, edit, or delete a dish, ingredient, table, or staff member even
though `firestore.rules` already allowed all of it for a manager. Nine tabs
now, grouped (Operations / Catalogue / People / Insight / Settings) instead of
one flat row.

New: an Orders tab (read-only order history — the only place a closed order is
visible anywhere in the UI), a Tables tab (add/edit/delete, plus a manager-only
`forceResetTable` for a table stuck mid-lifecycle), a Menu tab (dish
add/edit/delete via a new `upsertDish` callable), and a Settings tab (site
name, address, hours, service charge %, GST % — all fields the `restaurants/{id}`
doc already had but nothing could edit). Inventory got add/edit/delete
(`upsertIngredient`, `deleteIngredient`); Staff got add (`createStaffMember`,
needs the Admin SDK to pair an Auth user with a staff doc), role change, and
remove — with a self-lockout guard so a manager can't demote or delete
themselves.

Dietary tags are new too: `restaurants/{id}.dishTags` is a manager-maintained
list (seeded with 8 defaults), `dishes.tags` picks from it per dish. Guests see
tag badges on the menu and can filter by them, same pattern as the existing
category/veg filters.

The one real correctness risk here — `upsertDish` deriving `ingredientIds`
server-side instead of trusting a client copy, since that flat array powers
the `array-contains-any` availability queries in `orders.js`/`inventory.js` —
got its own test suite (`test:menu`, 4 cases) rather than just manual checking.
Same suite also proves `deleteIngredient` flips dependent dishes to
unavailable in the same transaction as the delete, instead of leaving them
silently `available: true` until an unrelated order happened to touch one of
their ingredients.

Branding was partially wired already (guest side read `restaurant.name` with
a fallback) but the staff Login page and ops sidebar still hardcoded
"CtrlChef", and nothing updated the browser tab title. Both now read the same
doc, with `document.title` kept in sync on both surfaces.

52 test cases now (was 47), all 6 suites passing. `npm run build` clean, no
new chunk-size issues. Couldn't click through the new UI in an actual browser
in this session — no browser automation tool available — so the manager-side
forms are verified by code review + a clean build + the backend test suite,
not a manual click-through. Worth doing that pass before this ships for real.

---

## 2026-07-26 — Audit, two real bugs, demo data, README

Read the PS and our own spec back-to-back against the whole codebase and
wrote the gaps up as 11 plans in `plans/`. Short version: the backend's in
better shape than the submission is. Three things were quietly capping us
at Bronze — the app isn't deployed anywhere (the hosting URL still 404s),
`readme.md` was completely empty, and User Story 2 wants Google OAuth +
OTP, which we just don't have. Silver is stories 1-3 and every tier above
it is a superset, so that last one drags everything down with it no matter
how good the forecasting is.

Two genuine bugs fell out of the read. `cancelOrderItem` was re-reading the
dish live instead of using the `ingredientsUsed` snapshot the order item
already carries — so cancelling an item whose dish had since been deleted
threw a TypeError and 500'd, and cancelling after a recipe edit put back
the wrong quantities. Same bug we already fixed once in forecast/analytics,
this path just got missed. The other one: the chef's Cancel button could
never have worked at all, since `cancelOrderItem` only allowed
waiter/manager and a chef always got permission-denied. Chefs can cancel a
received item now, which is what a real kitchen does anyway.

Seeded about 7 days of backdated orders, which is the thing that changes
the demo most. Before this, Analytics, Forecast, table turnover, Revenue
Tonight and two of the three Assistant answers were all empty — the
features worked fine, they just had nothing to work on. Now there's a
proper lunch/dinner double hump on Revenue by Hour, weekends heavier than
weekdays, real best-sellers and slow-movers, and stock tuned so Forecast
shows three ingredients actually trending toward stockout instead of zero
or all eleven. It also seeds a couple of people waiting and one table
already occupied, so the waiter map and chef board aren't blank the second
the demo starts.

Nasty one buried in that: the functions runtime reads Timestamps back in
UTC, not this machine's local zone, so building the seed times with
`setHours` was silently sliding the dinner peak about 5 hours into the
afternoon. Builds them with `setUTCHours` now.

Wrote the README, which was 0 bytes — team name and the hosted link are
still TODO placeholders in it. Filled in the empty sections of AGENTS.md
and deleted `test.txt`, which had `str cold = "yolo"` in it and was sitting
in a repo judges are going to read.

47 test cases passing now, up from 44 — new `test:orders` suite covers both
cancel crash paths.

Still open, roughly in the order it matters: deploy (needs Blaze switched
on first), Google OAuth + email verification, then the Gemini/Groq
assistant. Plans `01`, `02` and `07`.

---

## 2026-07-26 — Frontend overhaul

First round of fixes after actually using the app: renamed everything to
CtrlChef (was still showing the mockup's placeholder "Tandoor & Tales"
and a Bengaluru address that was never real), added a dark mode toggle
to the guest side to match what ops already had, and gave the waiter
screen a live queue panel — before this, guests could check in but no
staff screen showed it or could do anything about it.

Also fixed the actual cause of "the menus are a little slow" — dishes
alone had 4 separate Firestore listeners across different pages, orders
had 3. Centralized all of that into one listener per collection per
surface, and turned on Firestore's persistent cache so repeat visits
don't refetch everything. Rounded it out with hover states everywhere
(there were literally none) and made every action button disable itself
while its request is in flight, so double-clicking doesn't fire it twice.

Wrote all of this up as 5 separate plans first, then worked through them
in order and re-tested the whole app end to end against the emulators
afterward.

---

## 2026-07-26 — Frontend build

Built the frontend for real — Vite + React + Tailwind, off the two
design mockups (guest surface + ops surface). Public menu/queue for
guests, and a staff side (waiter table map, chef tickets, manager
dashboard) behind Firebase Auth gated by role. Everything talks to the
actual Cloud Functions and Firestore listeners, no mock data left.

Added one new backend function, `estimateQueueWait` — guests need a
wait estimate but can't read `tables` (staff-only in the rules), so it's
computed server-side and only the estimate comes back. Also extended
the seed script to create 3 demo staff logins (Auth + `staff` docs) so
there's something to actually sign in with.

Manager's "Assistant" tab answers its 3 fixed questions with plain
templates over real forecast/analytics data — no Gemini function exists
yet, so this is just the spec's own fallback tier, honestly labeled.

Tested every screen against the real emulators end to end. Found one
genuine bug this way: right after login, the redirect could fire before
the staff doc had loaded, bouncing people back to the login screen — a
timing race in how the auth context tracked "loading". Fixed.

---

## 2026-07-25 — Billing breakdown + staff clock-in

`closeOrder` now returns the actual bill (subtotal + service charge +
GST + total), not just the raw total — just used numbers that already
existed, no new function needed. Staff can also clock themselves in/out
now — was a rules-only fix, a waiter couldn't touch their own staff doc
at all before this. 44 test cases passing.

---

## 2026-07-25 — Restocking

Added `restockIngredient` for managers — before this, stock only ever
went down (or came back via a cancelled order), there was no way to
record a real delivery arriving. Updates stock, `lowStock`, and dish
availability together, same shape as the order functions. 41 test cases
now passing across all 5 suites.

---

## 2026-07-25 — Code review fixes (round 2)

Deleting a menu item was quietly breaking historical sales/forecast
numbers — fixed by having order items snapshot the dish's recipe at order
time, same as they already do for name/price. Also tightened up input
validation on the analytics functions. 37 test cases passing.

---

## 2026-07-25 — Analytics + forecasting

Added stock forecasting (rolling average consumption → predicted
stockout) and manager analytics (sales by dish/hour/day/staff, table
turnover). Ingredients now track a `lowStock` flag too. Gemini assistant
still on hold, needs API keys and a scope decision first.

---

## 2026-07-25 — Code review fixes (round 1)

Found and fixed 3 real bugs: closing an order could leave unserved items
stranded, `createdBy` was spoofable, a crafted status value could crash a
function. Also split a 350-line file into three, and added an automated
test for the auth checks.

---

## 2026-07-25 — Real security

Locked everything down — Firestore rules plus auth checks on every
function. Was wide open before this.

---

## 2026-07-25 — Table state machine

Tables (8 seeded) now go empty → occupied → needs_cleaning → empty,
each move guarded so it can't happen out of order.

---

## 2026-07-25 — Kitchen ticket state machine

Orders move received → preparing → ready → served, one step at a time.
Can cancel a line while it's still received, stock comes back correctly.

---

## 2026-07-25 — Seed script + order/stock logic

Seed script plus the core order function — checks stock, decrements it,
updates dish availability, all in one transaction so two orders can't
double-spend the same stock.

---

## 2026-07-25 — Firebase emulator setup

Firebase project wired up — Firestore, Functions, Hosting, emulators.

---

## 2026-07-25 — Project scaffolded

Set up the base project structure.

---
