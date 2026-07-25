# ngs-h Worklog

Append-only log of work sessions. Newest entry at the top. Each entry: date,
who/what worked, what changed, open questions.

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
