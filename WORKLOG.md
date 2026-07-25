# ngs-h Worklog

Append-only log of work sessions. Newest entry at the top. Each entry: date,
what changed, open questions.

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
