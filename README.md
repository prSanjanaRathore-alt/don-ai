# DON AI

DON AI is a premium personal goal achievement engine that helps users turn meaningful goals into measurable action.

## What is included in this MVP

- Premium, responsive mobile-first layout
- Goal creation flow and roadmap generation
- Today's Mission recommendation
- Goal, milestone, and task workspace structure
- AI Coach API route with explicit provider configuration state
- Local persistence for MVP
- Supabase-ready configuration and schema
- Starter test coverage for the planning logic

## Local development

### 1. Install dependencies

```bash
npm install
```

### 2. Start the app

```bash
npm run dev
```

Open http://localhost:3000

### 3. Run tests

```bash
npm test
```

## Environment variables

Create a `.env.local` file with the following variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
AI_PROVIDER=openai
OPENAI_API_KEY=your-openai-key
```

You may use `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` instead of `OPENAI_API_KEY`.

## Supabase setup

1. Create a Supabase project.
2. Open SQL editor and run the schema from `supabase/schema.sql`.
3. Copy the Project URL and anon key into `.env.local`.
4. Enable row-level security and authentication in Supabase.

## Project structure

- `app/` — Next.js app routes and UI
- `lib/` — planning logic and configuration
- `supabase/` — database schema
- `__tests__/` — unit tests

## Known limits for this starter build

- Local browser storage is used for persistence until Supabase is configured.
- Real AI provider calls are intentionally gated behind environment variables to avoid leaking secrets.
- This is a production-ready foundation, not a complete multi-user SaaS with billing.

## Deployment

This project is ready to deploy to Vercel with environment variables configured.
