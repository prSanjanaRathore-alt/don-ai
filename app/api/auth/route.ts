import { NextRequest, NextResponse } from 'next/server';
import { isSameOriginRequest } from '@/lib/auth';
import { createSupabaseServerClient, getSupabaseConfig } from '@/lib/supabase';

function privateJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'private, no-store');
  return NextResponse.json(body, { ...init, headers });
}

function publicUser(user: { email?: string | undefined } | null) {
  return user ? { email: user.email ?? '' } : null;
}

export async function GET() {
  if (!getSupabaseConfig().configured) {
    return privateJson({ configured: false, user: null });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error && error.name !== 'AuthSessionMissingError') {
      return privateJson({ error: 'Unable to verify your account right now.' }, { status: 503 });
    }

    return privateJson({ configured: true, user: publicUser(data.user) });
  } catch {
    return privateJson({ error: 'Unable to check your account right now.' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return privateJson({ error: 'This request origin is not allowed.' }, { status: 403 });
  }
  if (!getSupabaseConfig().configured) {
    return privateJson({ error: 'Supabase is not configured. Account sign-in is unavailable.' }, { status: 503 });
  }

  let body: { action?: unknown; email?: unknown; password?: unknown };
  try {
    const rawBody = await request.text();
    if (rawBody.length > 16_000) {
      return privateJson({ error: 'The account request is too large.' }, { status: 413 });
    }
    body = JSON.parse(rawBody) as { action?: unknown; email?: unknown; password?: unknown };
  } catch {
    return privateJson({ error: 'Send a valid JSON request.' }, { status: 400 });
  }

  const action = body.action;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (action !== 'sign-in' && action !== 'sign-up') {
    return privateJson({ error: 'Choose sign in or create an account.' }, { status: 400 });
  }
  if (!email || email.length > 320 || !email.includes('@') || !password || password.length > 256) {
    return privateJson({ error: 'Enter a valid email address and password.' }, { status: 400 });
  }
  if (action === 'sign-up' && password.length < 8) {
    return privateJson({ error: 'Choose a password with at least 8 characters.' }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    let result;
    if (action === 'sign-up') {
      const siteUrl = process.env.SITE_URL?.trim();
      if (!siteUrl) {
        return privateJson(
          { error: 'Set SITE_URL to your app origin and allow its /api/auth/callback URL in Supabase redirects before creating accounts.' },
          { status: 503 },
        );
      }
      result = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: new URL('/api/auth/callback', siteUrl).toString() },
      });
    } else {
      result = await supabase.auth.signInWithPassword({ email, password });
    }

    if (result.error) {
      return privateJson(
        { error: action === 'sign-in' ? 'Email or password is incorrect.' : 'Could not create the account. Check the email and try again.' },
        { status: 400 },
      );
    }

    if (action === 'sign-up' && !result.data.session) {
      return privateJson(
        { user: null, emailConfirmationRequired: true, message: 'Check your email to confirm your account, then sign in.' },
        { status: 202 },
      );
    }

    return privateJson({
      user: publicUser(result.data.user),
      emailConfirmationRequired: false,
    });
  } catch {
    return privateJson({ error: 'The account service is unavailable. Try again shortly.' }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return privateJson({ error: 'This request origin is not allowed.' }, { status: 403 });
  }
  if (!getSupabaseConfig().configured) {
    return privateJson({ error: 'Supabase is not configured.' }, { status: 503 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      return privateJson({ error: 'Could not sign out. Try again.' }, { status: 503 });
    }
    return privateJson({ ok: true });
  } catch {
    return privateJson({ error: 'Could not sign out. Try again.' }, { status: 503 });
  }
}
