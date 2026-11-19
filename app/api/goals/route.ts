import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth';
import { isGoal } from '@/lib/goal-validation';
import { Task } from '@/lib/types';

function isTaskStatus(status: unknown): status is Task['status'] {
  return status === 'todo' || status === 'in_progress' || status === 'done' || status === 'blocked';
}

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.client
    .from('goal_plans')
    .select('plan')
    .eq('user_id', auth.user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: 'Could not load saved goals. Confirm the goal_plans table is installed.' },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { goals: data.map((row) => row.plan) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 1_000_000) {
    return NextResponse.json({ error: 'The import is too large.' }, { status: 413 });
  }

  let body: { goals?: unknown };
  try {
    const rawBody = await request.text();
    if (rawBody.length > 1_000_000) {
      return NextResponse.json({ error: 'The import is too large.' }, { status: 413 });
    }
    body = JSON.parse(rawBody) as { goals?: unknown };
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON request.' }, { status: 400 });
  }

  if (!Array.isArray(body.goals) || body.goals.length < 1 || body.goals.length > 50 || !body.goals.every(isGoal)) {
    return NextResponse.json({ error: 'The import contains invalid goal data.' }, { status: 400 });
  }

  const goals = body.goals;
  const { error } = await auth.client.from('goal_plans').insert(
    goals.map((plan) => ({ id: plan.id, user_id: auth.user.id, plan })),
  );

  if (error?.code === '23505') {
    return NextResponse.json({ error: 'One or more goals already exist in your account.' }, { status: 409 });
  }
  if (error) {
    return NextResponse.json({ error: 'Could not import goals. Check the Supabase goal_plans schema.' }, { status: 503 });
  }

  return NextResponse.json(
    { ok: true, imported: goals.length },
    { status: 201, headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) return auth.response;

  let body: { goalId?: unknown; taskId?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON request.' }, { status: 400 });
  }

  const { goalId, taskId, status } = body;
  if (
    typeof goalId !== 'string'
    || goalId.length > 200
    || typeof taskId !== 'string'
    || !isTaskStatus(status)
  ) {
    return NextResponse.json({ error: 'The task update is invalid.' }, { status: 400 });
  }

  const { data, error: loadError } = await auth.client
    .from('goal_plans')
    .select('plan')
    .eq('id', goalId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: 'Could not load this goal for updating.' }, { status: 503 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Goal not found.' }, { status: 404 });
  }

  let taskFound = false;
  const goal = {
    ...data.plan,
    updatedAt: new Date().toISOString(),
    milestones: data.plan.milestones.map((milestone) => ({
      ...milestone,
      tasks: milestone.tasks.map((task) => {
        if (task.id !== taskId) return task;
        taskFound = true;
        return { ...task, status };
      }),
    })),
  };

  if (!taskFound) {
    return NextResponse.json({ error: 'Task not found in this goal.' }, { status: 404 });
  }

  const { error: saveError } = await auth.client
    .from('goal_plans')
    .update({ plan: goal })
    .eq('id', goalId)
    .eq('user_id', auth.user.id)
    .select('id')
    .maybeSingle();

  if (saveError) {
    return NextResponse.json({ error: 'Could not save your task progress. Try again.' }, { status: 503 });
  }

  return NextResponse.json({ goal }, { headers: { 'Cache-Control': 'private, no-store' } });
}
