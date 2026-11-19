import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth';
import { AiProviderError, getAiProviderConfig, requestCoachReply } from '@/lib/ai';

export async function POST(request: NextRequest) {
  const providerResult = getAiProviderConfig();
  if (!providerResult.ok) {
    return NextResponse.json({ error: providerResult.error }, { status: 503 });
  }

  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  let body: { message?: unknown; goal?: unknown; task?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON request.' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
  const task = typeof body.task === 'string' ? body.task.trim() : '';

  if (!message && !goal && !task) {
    return NextResponse.json({ error: 'At least one message or goal context is required.' }, { status: 400 });
  }
  if (message.length > 4_000 || goal.length > 10_000 || task.length > 2_000) {
    return NextResponse.json({ error: 'The coach request is too long.' }, { status: 413 });
  }

  const prompt = [
    goal ? `User goal: ${goal}` : '',
    task ? `Current mission: ${task}` : '',
    message ? `User request: ${message}` : '',
  ].filter(Boolean).join('\n\n');

  try {
    const reply = await requestCoachReply(providerResult.config, prompt);
    return NextResponse.json({
      ok: true,
      coach: { role: 'AI Coach', provider: providerResult.config.provider, message: reply },
    });
  } catch (error) {
    const message = error instanceof AiProviderError
      ? error.message
      : 'The AI provider could not respond. Verify its server-side configuration and try again.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
