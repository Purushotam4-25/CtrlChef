# ngs-h Worklog

Append-only log of work sessions. Newest entry at the top. Each entry: date,
what changed, open questions.

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
