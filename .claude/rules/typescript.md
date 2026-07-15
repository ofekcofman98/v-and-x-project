---
description: TypeScript strict-mode rules and general code cleanliness standards
globs: **/*.ts, **/*.tsx
---

# TypeScript Rules

## Strict Mode

- `tsconfig.json` must keep `"strict": true`. Never relax it.
- **`any` is forbidden** — no exceptions, not even as a temporary placeholder.
  - Use `unknown` and narrow with type guards.
  - Use `z.infer<typeof Schema>` for runtime-validated types.
  - Use generics when the type is truly variable.
- All function parameters and return types must be explicitly typed.
- Prefer `interface` for object shapes, `type` for unions and aliases.
- Use `as` type assertions only when you can justify them with an inline comment.

## Code Cleanliness

- **No `console.log`** in committed code — use the helpers in `lib/shared/monitoring/`.
- **No magic strings or numbers** — extract to named constants or enums.
- One concern per file. Co-locate types with the code that owns them.
- All async functions must handle errors explicitly. Silent `catch (() => {})` is only allowed for intentional fire-and-forget — add a comment explaining why.
- Zod schemas are the single source of validation truth for every API boundary.
- Prefer early returns over deeply nested conditionals.
- Delete dead code. Do not comment it out and leave it.

## File & Folder Conventions

- Feature code lives under the path described in `docs/02_ARCHITECTURE.md`.
- API routes use the standard response envelope `{ success, data }` / `{ success, error }` (see `docs/11_API_ROUTES.md`).
- Query keys must go through the central `lib/query-keys.ts` factory — never inline raw key arrays.
