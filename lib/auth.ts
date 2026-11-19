import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { Database } from './database.types';
import { createSupabaseServerClient, getSupabaseConfig } from './supabase';

type AuthenticatedRequest =
  | { ok: true; client: SupabaseClient<Database>; user: User }
  | { ok: false; response: NextResponse };

export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export async function requireAuthenticatedUser(request?: NextRequest): Promise<AuthenticatedRequest> {
  if (request && !isSameOriginRequest(request)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'This request origin is not allowed.' }, { status: 403 }),
    };
  }

  if (!getSupabaseConfig().configured) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Supabase is not configured. Add server-side SUPABASE_URL and SUPABASE_ANON_KEY to enable account features.' },
        { status: 503 },
      ),
    };
  }

  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();

  if (error?.name === 'AuthSessionMissingError' || (!error && !data.user)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 }),
    };
  }

  if (error || !data.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Your session could not be verified. Please sign in again.' }, { status: 503 }),
    };
  }

  return { ok: true, client, user: data.user };
}
