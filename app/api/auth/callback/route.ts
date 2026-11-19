import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getSupabaseConfig } from '@/lib/supabase';

function redirectToSite(authError = false) {
  const siteUrl = process.env.SITE_URL?.trim();
  if (!siteUrl) {
    return NextResponse.json({ error: 'SITE_URL is not configured.' }, { status: 503 });
  }

  const destination = new URL('/', siteUrl);
  if (authError) destination.searchParams.set('authError', 'confirmation');
  return NextResponse.redirect(destination, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code || !getSupabaseConfig().configured) {
    return redirectToSite(true);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirectToSite(true);
    }

    return redirectToSite();
  } catch {
    return redirectToSite(true);
  }
}
