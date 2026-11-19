import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth';
import { generateGoalPlan } from '@/lib/planner';

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  let body: { goal?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON request.' }, { status: 400 });
  }

  const userGoal = typeof body.goal === 'string' ? body.goal.trim() : '';
  if (!userGoal) {
    return NextResponse.json({ error: 'Goal is required.' }, { status: 400 });
  }
  if (userGoal.length > 10_000) {
    return NextResponse.json({ error: 'Goals must be 10,000 characters or fewer.' }, { status: 400 });
  }

  const goal = generateGoalPlan(userGoal);
  const { error } = await auth.client
    .from('goal_plans')
    .insert({ id: goal.id, user_id: auth.user.id, plan: goal });

  if (error) {
    return NextResponse.json(
      { error: 'Could not save your goal. Confirm the goal_plans table is installed and try again.' },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, goal }, { status: 201 });
}
