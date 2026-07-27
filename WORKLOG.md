# CtrlChef Worklog

Newest entry first. Keep entries short and factual.

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
