import { NextRequest, NextResponse } from 'next/server';
import { generateGoalPlan } from '@/lib/planner';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userGoal = String(body?.goal || '').trim();

    if (!userGoal) {
      return NextResponse.json({ error: 'Goal is required.' }, { status: 400 });
    }

    const plan = generateGoalPlan(userGoal);

    return NextResponse.json({
      ok: true,
      goal: plan,
      provider: process.env.AI_PROVIDER || 'not-configured',
      status: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY ? 'provider-configured' : 'provider-missing',
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Unable to generate a goal plan right now.',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
