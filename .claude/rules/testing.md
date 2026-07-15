---
description: Testing conventions for Vitest, Playwright, and MSW
globs: **/*.test.ts, **/*.test.tsx, **/*.spec.ts, **/*.spec.tsx, tests/**, e2e/**
---

# Testing Rules

## Stack

- **Unit tests:** Vitest (`npm run test`)
- **E2E tests:** Playwright (`npx playwright test`)
- **API mocking:** MSW (Mock Service Worker)

## Conventions

- Test files live co-located with the code they test or under `tests/` / `e2e/` for integration and end-to-end tests.
- Name test files `*.test.ts` (unit) or `*.spec.ts` (integration/e2e).
- Each `describe` block tests one unit of behaviour. Each `it` / `test` block asserts one outcome.
- Never use `any` in test code — the same TypeScript strict rules apply.
- Use MSW handlers to mock all network requests in unit and integration tests — do not mock fetch/axios directly.
- Do not `console.log` in tests. Use `vitest` matchers and meaningful assertion messages.

## What to Test

- Unit test pure functions in `lib/shared/utils/` and parsers in `lib/server/parsers/`.
- Integration test API routes by calling the handler directly with a mocked Prisma/Supabase client.
- E2E test critical user flows (voice entry, data submission, navigation) with Playwright.
- Do not test implementation details — test observable behaviour and outputs.
