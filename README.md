# VocalGrid

Voice-first spreadsheet data entry application built with Next.js 15.

## Tech Stack

- **Framework:** Next.js 15 (App Router, Server Components)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS + shadcn/ui
- **UI State:** Zustand
- **Server State:** TanStack Query v5
- **Database:** Supabase (PostgreSQL + RLS + Realtime)
- **Auth:** Supabase Auth
- **AI:** OpenAI Whisper & GPT-4o-mini

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```

3. Fill in your environment variables in `.env.local`

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

See `docs/00_PROJECT_STRUCTURE.md` for detailed information.

```
.
├── app/                    # Next.js App Router pages
├── components/             # React components
│   └── ui/                # shadcn/ui primitives
├── lib/
│   ├── hooks/             # Custom React hooks (UI logic)
│   ├── queries/           # TanStack Query queries
│   ├── mutations/         # TanStack Query mutations
│   ├── stores/            # Zustand stores
│   ├── utils/             # Utility functions
│   └── monitoring/        # Monitoring helpers
└── docs/                  # Technical documentation
```

## Documentation

The `/docs` folder contains comprehensive technical documentation:

- Architecture & design decisions
- Database schema & RLS policies
- State management patterns
- API contracts
- Implementation roadmap

## Screenshots 

<img width="2713" height="1477" alt="image" src="https://github.com/user-attachments/assets/b71ef6eb-1a3e-4bce-ae68-8aed762c81f5" />

<img width="2812" height="1473" alt="image" src="https://github.com/user-attachments/assets/8b550c85-5e6f-41ac-b7db-b49711590e87" />

<img width="2796" height="1470" alt="image" src="https://github.com/user-attachments/assets/34d26a7f-e857-4537-ad65-b8664a7d5edd" />

## Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests

## Code Quality

This project follows strict TypeScript and architecture patterns:

- TypeScript strict mode enabled
- No `any` types allowed
- Three-layer architecture (UI / Logic / Data)
- Query keys centralized in `lib/query-keys.ts`
- Zod validation at all API boundaries

See `.cursorrules` for complete coding standards.

All rights reserved. This repository is provided for portfolio/demonstration purposes only. No license is granted for use, modification, or distribution
