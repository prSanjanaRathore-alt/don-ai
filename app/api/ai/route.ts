import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = String(body?.message || '').trim();
    const goal = String(body?.goal || '').trim();
    const task = String(body?.task || '').trim();

    if (!message && !goal && !task) {
      return NextResponse.json({ error: 'At least one message context is required.' }, { status: 400 });
    }

    const provider = process.env.AI_PROVIDER || 'not-configured';

    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        ok: true,
        coach: {
          role: 'AI Coach',
          provider,
          status: 'provider-missing',
          message: 'AI is configured but no provider key is active yet. Connect one of OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY to enable live model responses.',
          context: {
            goal: goal || 'Not set yet',
            task: task || 'No task selected',
          },
        },
      });
    }

    return NextResponse.json({
      ok: true,
      coach: {
        role: 'AI Coach',
        provider,
        status: 'provider-configured',
        message: `I understand your goal and task context. Based on the current plan, the best next step is to stay focused on the highest-value action and capture evidence before changing direction.`,
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Unable to reach the AI provider right now.',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
