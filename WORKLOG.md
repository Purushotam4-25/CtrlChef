# CtrlChef Worklog

Newest entry first. Keep entries short and factual.

---

## 2026-07-27 — Merged plans 05/12/09, seed.js was broken against the emulator

Merged the queue-lifecycle, food-cost, and members branches into `frontend`
(three-way conflicts in `WORKLOG.md`/`HANDOFF.md` throughout, plus a real one
in `functions/analytics.js` — plan 12's cost logic needed folding into the
`lib/analytics.js` version plan 07 had already extracted, not the standalone
copy it was written against). All 9 backend suites plus the split-bill
self-check pass after merging (70 cases total).

Along the way, `npm run seed` turned out to be completely broken against the
local emulator: the `preferRest: true` fix from earlier today disables the
Admin SDK's `FIRESTORE_EMULATOR_HOST` auto-detection, so every emulator
write tried to authenticate against real Google credentials and failed.
Gated it to `SEED_PROD` only — the gRPC hang it was fixing is a
real-network problem, not a localhost one.

## 2026-07-27 — Members: optional customer login, order history, "usuals"

`members/{uid}` had rules but nothing in the app ever touched it. `AuthContext`
now checks for a member doc alongside the staff one and exposes `accountType`
("staff" | "member" | null); anyone who signs in with neither gets provisioned
as a member automatically (rules already allowed exactly that write). Member
signup itself lives on a new `/account` page — email/password, no Google
sign-in yet, same as staff.

Plan 05 (queue lifecycle) hasn't landed on this branch yet, so orders link to
a member the simpler way: the waiter attaches one by search when starting a
tab (`TableMap.jsx`), and `addOrderItem` takes it as an optional `memberId`
that's only ever set on the order-creation branch — nothing about the
stock-decrement transaction changed.

Two new member-scoped callables (`functions/members.js`), same "narrow read
via a callable" pattern `estimateQueueWait` already uses rather than loosening
the isStaff-only rule on `orders`: `getMyOrderHistory` and
`getMyRecommendations` (top dishes by order frequency, filtered to what's
still `available` right now — plain counting, not a model, labelled that way
on the menu same as the forecast tab is honest about being a heuristic). Both
check `request.auth.uid` against the memberId being asked for.

Guest menu shows a "Your usuals" strip above the grid when signed in with
history; new `/account/orders` page lists past orders; manager dashboard got
a Customers tab (visits, spend, favourite dish, last visit — client-side
aggregation over `members` + the same capped `allOrders` the Orders tab
already reads). No points, no loyalty tiers — frequency-history only, on
purpose.

New `test:members` suite (5 cases). Re-ran `test:auth` too since `addOrderItem`
changed shape — still 13/13, no regressions from the new optional field.

## 2026-07-27 — Food cost % / COGS (plan 12)

Ingredients now carry an optional `costPerUnit` — added to the same
`upsertIngredient` callable and Inventory add/edit form plan 08 shipped,
not a second one. `getSalesAnalytics` reads the `ingredients` collection
once (same pattern as `restockIngredient`) and folds cost into the
existing per-item loop, computed from each order item's `ingredientsUsed`
snapshot, never the live dish recipe — same reasoning as the
`cancelOrderItem` stock-restore fix from plan 03. Ingredients missing a
`costPerUnit` resolve to 0 cost but get flagged, both per-dish
(`missingCost`) and restaurant-wide (`missingCostIngredientIds`), so the
UI can say "cost data incomplete" instead of quietly showing a
too-good food-cost %. Uses today's `costPerUnit` for every order in the
window since cost isn't versioned — fine for a demo, noted in the code.

AnalyticsTab has a new "Food Cost % by Dish" panel (worst first) and a
blended food-cost % stat tile. Picked seed ingredient costs (paneer 320/kg,
chicken 220/kg, basmati 120/kg, base gravy 80/L, and so on) that land the
blended food cost around 29% against the seeded menu prices, weighted by
how the demo order history actually sells — right in the 28-35% range.
Added a cost/missing-cost test case to `test:analytics`; all 8 cases pass.

## 2026-07-27 — Closed the queue lifecycle gaps

Plan 05's five open items. Seating from the queue was two unguarded round
trips — `seatTable` then a separate queue-entry update — so a failure
between them left a table occupied with the party stuck "waiting" forever
and nothing to catch it. New `seatFromQueue` does both writes in one
transaction, checks the table actually fits the party first, and writes real
`partySize` onto the table. That let `getTableTurnoverStats` group by actual
party size instead of table capacity, which was only ever a stand-in.

Added a no-show button — queue entries could only become "seated" before
this, so a party that left just sat in the list. `estimateQueueWait` now
factors in how many parties are already ahead in line instead of handing
everyone the same flat average. Locked down the public queue-create rule
with `hasOnly` and a name-length check — it validated partySize and status
but nothing stopped an anonymous write from carrying arbitrary extra fields.
Killed the hardcoded `~8 min` on the guest home page, now a real
`estimateQueueWait` call.

Skipped the optional guest-side live queue position — plan called it
explicitly optional. 21 rules cases now (was 19), plus the existing
`test:analytics` fixture updated for the partySize grouping.

## 2026-07-27 — Wired up the Gemini/Groq assistant

`functions/assistant.js` (`askAssistant`, manager-only) answers the three
fixed questions for real now: Gemini first, Groq if Gemini's slow or errors,
a plain template if both fail. Pulled the query bodies out of
`forecast.js`/`analytics.js` into `functions/lib/` so the assistant and the
existing callables share one source of truth instead of two copies of the
same aggregation — `test:forecast`/`test:analytics` still pass unchanged.

The spec's model id, `gemini-3-flash`, doesn't exist — 404s against the real
API. Used `gemini-flash-latest` instead, Google's own alias for the current
flash-tier model, so it won't rot when the model line moves on. Verified all
three tiers live against the real emulator + real keys: Gemini currently
fails because this project's API key has no prepaid credits left, so every
real call falls through to Groq, which answers correctly and grounded in the
real numbers; then deliberately broke Groq's model name too and got the
template tier's canned answers back, confirming the full chain degrades the
way it's supposed to.

`AssistantTab.jsx` now calls `askAssistant` instead of running the templates
client-side, with a small Gemini/Groq/Offline badge on each answer.

## 2026-07-27 — Forecast/Assistant hung silently on a failed call

Neither had error handling — a failed `getStockForecast`/`getSalesAnalytics`
call left Forecast stuck on "Loading forecast…" forever and Assistant just
did nothing. Added a real error message to both. Root cause of the actual
failures they hit was unrelated to this code: several Gen 2 functions
(Cloud Run under the hood) weren't set to allow public invocation, so calls
403'd before reaching the function at all — fixed per-function in the Cloud
Run console (Security tab → Allow public access), not something deploy or
code can fix on its own.

## 2026-07-27 — seed.js couldn't actually seed prod, and hung forever trying

Two real bugs, both in `seed.js`. First: `preferRest: true` added on the
Firestore client — on some networks (VPN, antivirus doing HTTP/2 inspection)
the default gRPC transport just hangs with zero error, forever. Second, and
the bigger one: the "unset FIRESTORE_EMULATOR_HOST to hit prod" guidance
(mine, from earlier today) was backwards — `||=` fills in the emulator
default when the var is *unset*, so there was never a way to reach
production through env vars alone. Replaced it with an explicit
`SEED_PROD=true` opt-in. Confirmed both fixes work with a one-off write
against real Firestore before patching the script properly.

## 2026-07-27 — Notifications and guest order tracking

Built plan 06: in-app toasts plus a guest-facing order tracker. Skipped FCM
push — it's the plan's explicit bonus item, cut it per the plan's own call.

`ToastContext` is a `useState` array and a `setTimeout` per toast, no
library. All three triggers share one hook, `useTransitionWatch(items,
keyFn, fieldFn, onChange)` — diffs a Map of the previous snapshot against
the new one and only fires on an actual field change, never on the first
snapshot and never on an unrelated re-fire of the same listener. Item ->
ready toasts the waiter in `TableMap`, a new ticket toasts the chef in
`Tickets`, and an ingredient crossing low-stock toasts both manager and
chef — that watch lives in `OpsLayout` instead of `Dashboard`, since
`Dashboard` only renders for a manager and chef needed it too (the
ingredients listener itself was already shared via `OpsDataContext`, it
just had nothing watching the false->true edge).

Guest order tracking is a new `/table/:tableId` route (meant for a QR code
at the table), backed by a new public callable `getTableOrderStatus` — same
shape as `estimateQueueWait`, hands back item names, statuses, and the
running total, nothing a guest shouldn't see. `orders` stays staff-read-only
in the rules either way. The page polls the callable every 8s instead of a
live listener, since a guest has no auth to hold a rules-scoped
subscription.

No new test suite — `getTableOrderStatus` has none, matching
`estimateQueueWait`, its closest sibling, which doesn't have one either.
Verified by hand against the emulator instead: occupied table, empty table,
unknown table, missing args. 58 existing backend cases still pass, `npm run
build` clean.

---

## 2026-07-27 — Login stuck on "Loading…" for a signed-in account with no staff doc

Firestore rules deny reading a staff doc that doesn't exist (the isStaff
check does a get() on it), which the AuthContext listener had no error
handler for — so it just spun forever instead of resolving to "no staff".
Added the error handler. Actual reported case: demo Auth accounts existed
in prod but their staff docs didn't, most likely from a seed run where only
`FIRESTORE_EMULATOR_HOST` got unset and not `FIREBASE_AUTH_EMULATOR_HOST`
too — worth reseeding prod with both unset.

## 2026-07-27 — Fixed the functions deploy failing on npm ci

First deploy attempt failed all 16 functions with `npm ci` complaining about
missing `@emnapi/core`/`@emnapi/runtime` in the lockfile — some transitive
optional dep of `unrs-resolver` had drifted out of sync. Regenerated
`functions/package-lock.json` from scratch, `npm ci` now reproducible
locally. No actual dependency changed, just the lockfile.

---

## 2026-07-27 — Deploy prep + bug fixes

Node 22 for functions (24 isn't supported for deploy), readme updated for
the auth and manager-CRUD work that's since landed. Fixed the last two bugs
from plan 03: `firebase.js` white-screened on a bad config fetch with no
message, and chef tickets could crash on a missing `addedAt`. Deploy is
next — nothing else blocking it.

---

## 2026-07-27 — Google sign-in, email verification, password reset

Implements PS User Story 2's remaining auth surface. `AuthContext` gained
`signInWithGoogle`, `signUp` (creates the account and immediately sends a
verification email), `resendVerification`, `resetPassword`, and an
`emailVerified` flag. `Login.jsx` now has a "Continue with Google" button, a
"Forgot password?" flow, and — instead of silently bouncing a signed-in user
back to the login form — an explicit "not registered as staff" screen when
there's no matching `staff` doc (covers both Google sign-in and any future
self-signup). New `/signup` page collects email/password and shows a
verification-pending screen with a resend button. Staff accounts (manager-
provisioned) are not gated on `emailVerified` — nothing currently gates on it,
since the `members` surface (plan 09) isn't built yet; that's the natural
place to require it. Still needed before this counts as done: enable the
Google provider in the Firebase console, add the deployed domain to
Authorized domains, and a manual click-through once deployed. Build clean.

---

## 2026-07-27 — Merge billing and manager-CRUD branches

Merged `worktree-billing-split-system` and `worktree-menu-crud-tags-branding`
into `frontend`. Fixed the reconciliation the billing branch flagged: the new
manager Orders tab was recomputing a closed order's bill from the
restaurant's *current* tax/service-charge settings instead of reading the
now-persisted `order.bill` — same stale-bill bug `closeOrder` itself was just
fixed for. `OrdersTab.jsx` now reads `order.bill` (falling back to a live
recompute only for orders closed before that field existed) and shows
discount and payment method too. Build clean.

---

## 2026-07-27 — LLM setup ready

Confirmed Blaze and saved the Gemini and Groq keys as Firebase secrets. The
assistant code still needs to be built and deployed.

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
