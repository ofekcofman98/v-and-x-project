---
description: Docs-as-source-of-truth rules and file creation discipline
globs: docs/**, **/*.md
---

# Documentation Rules

## Docs Are the Source of Truth

- The `/docs` folder contains chapters 00–14 plus `docs/features/` — these define all architecture, data models, API contracts, and implementation decisions.
- **Before writing or modifying any code**, verify the approach aligns with the relevant `/docs` chapter.
- If code and docs conflict, **the docs win**. Flag the conflict and ask before deviating.
- Never invent APIs, schema fields, or architectural patterns not described in `/docs`.

## How to Navigate Docs Efficiently

1. Always start with `/docs/00_PROJECT_STRUCTURE.md` to orient yourself.
2. Read only the Table of Contents at the top of each file to locate the relevant section.
3. Load only the specific section needed — not the entire file.
4. Do not load multiple large doc files simultaneously unless the task explicitly requires cross-referencing.
5. When in doubt about which section is relevant, check `00_PROJECT_STRUCTURE.md` first — do not guess.

## File Creation Rules

- **No junk files** — do not create standalone `.md` files in the root or `docs/` for summaries, notes, or checklists.
- **Change logs** go only in `docs/logs/`.
- **Spec updates** — if a change impacts architecture or logic, update the existing relevant spec file in `docs/` and ask for approval before doing so.
- Prefer providing summaries directly in the chat interface rather than generating documentation files, unless explicitly requested.
