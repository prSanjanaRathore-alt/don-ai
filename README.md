# DON AI

DON AI helps users turn personal goals into measurable missions, track progress, and get context-aware coaching.

## Local development

Use Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Run `npm test`, `npm run lint`, and `npm run build` to validate changes.

## Configuration

Create `.env.local` with server-side values. Do not prefix provider keys with `NEXT_PUBLIC_`.

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SITE_URL=http://localhost:3000
AI_PROVIDER=openai
OPENAI_API_KEY=your-provider-key
```

For the coach, choose `openai`, `anthropic`, or `gemini` and provide its matching server-side key (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY`). Optional model overrides are `OPENAI_MODEL`, `ANTHROPIC_MODEL`, and `GEMINI_MODEL`. Provider credentials are only used by server routes and never returned to the browser. Without a configured provider key, the coach shows a configuration error rather than a simulated response.

Without Supabase configuration, users can continue in local-only mode; goals remain in that browser and are not synced. Supabase is required for account authentication, cloud goal persistence, and the AI coach.

## Supabase setup

1. Create a Supabase project and configure email/password authentication.
2. Run `supabase/schema.sql` in the project SQL editor to create the goal-plan table and row-level security policy.
3. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SITE_URL` in the app environment.
4. Add `${SITE_URL}/api/auth/callback` to the Supabase Auth redirect URL allowlist.

The app uses the anon key with verified user sessions and row-level security; it does not use a service-role key. Existing local goals can be imported after signing in.

## Project structure

- `app/` — Next.js UI and server API routes
- `lib/` — planning, validation, authentication, and AI-provider logic
- `supabase/schema.sql` — database schema and row-level security
- `__tests__/` — unit tests
