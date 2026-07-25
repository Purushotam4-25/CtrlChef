# ngs-h Worklog

Append-only log of work sessions. Newest entry at the top. Each entry: date,
what changed, open questions.

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
