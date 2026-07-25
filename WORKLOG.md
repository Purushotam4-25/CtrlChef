# ngs-h Worklog

Append-only log of work sessions. Newest entry at the top. Each entry: date,
who/what worked, what changed, open questions.

---

## 2026-07-25 — Seed script + order/stock transaction

Backend spine (Day 1 scope): `functions/seed.js` writes demo ingredients +
menu (11 ingredients, 12 dishes, deliberate paneer/rice/gravy overlap).
`functions/index.js` adds `addOrderItem` — an `onCall` Cloud Function that
runs stock check → decrement → dish-availability recompute → append order
line, all inside one Firestore transaction, so two simultaneous orders can't
oversell the same ingredient. Both verified against the emulator (seed
counts checked via REST API, order call checked for correct stock decrement,
availability flips, and rejection when stock is insufficient). Known
issue: floating-point stock math (kg as decimals) can make a dish flip
unavailable a hair early due to rounding — fails safe (blocks ordering)
rather than oversells, not fixed yet. No auth/security-rules enforcement
on this function yet — that's the dedicated Day 3 rules block per the spec.

---

## 2026-07-25 — Firebase emulator setup

Wired up Firebase project `ctrlchef-b8ba2`: Firestore, Functions, Hosting,
plus the emulator suite (auth/functions/firestore/hosting/UI) in
`firebase.json`. Default init scaffold only, no custom app code yet.
Verified git staging before push (no node_modules/secrets included). Spec
doc is intentionally gitignored, not pushed. Open question: default
Firestore rules expire 2026-08-24 — need real rules before then.

---

## 2026-07-25 — Project scaffolded

Initial structure created via project-init: AGENTS.md, CLAUDE.md, GEMINI.md,
HANDOFF.md, WORKLOG.md, .gitignore, src/, plans/.

---
