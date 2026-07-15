# VocalGrid — Claude Code Guide

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Server Components) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) |
| UI State | Zustand |
| Server State | TanStack Query v5 |
| Database | Supabase (PostgreSQL + RLS + Realtime) |
| Auth | Supabase Auth |
| AI — STT | OpenAI Whisper (`whisper-1`) |
| AI — Parsing | OpenAI GPT-4o-mini (JSON mode) |
| Deployment | Vercel (Serverless + Edge) |
| Testing | Vitest, Playwright, MSW |
| Key libs | `zod`, `fastest-levenshtein`, `soundex-code`, `chrono-node`, `xlsx` |

## Commands

```bash
npm run dev        # Start dev server (Turbopack)
npm run build      # Production build
npm run lint       # ESLint via next lint
npm run test       # Vitest unit tests
npx playwright test  # Playwright e2e tests
```

## Key Rules

- `/docs` is the source of truth — always check the relevant chapter before writing code.
- Start with `/docs/00_PROJECT_STRUCTURE.md` to orient yourself.
- `any` is forbidden — use `unknown`, type guards, or `z.infer<>`.
- Never import across lib zone boundaries (client ↔ server). See `.claude/rules/architecture.md`.
- Do not install unapproved libraries without explicit user confirmation.
- Ask one focused clarifying question when a task is ambiguous — do not assume and write.
