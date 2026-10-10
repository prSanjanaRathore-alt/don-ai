"use client";

import { useEffect, useMemo, useState } from 'react';
import { generateGoalPlan, summarizeProgress } from '@/lib/planner';
import { Goal, Task } from '@/lib/types';

const STORAGE_KEY = 'don-ai-goals';

type NavigationTab = 'home' | 'coach' | 'goal' | 'progress' | 'profile';

function updateTaskStatus(goals: Goal[], taskId: string, status: Task['status']): Goal[] {
  return goals.map((goal) => ({
    ...goal,
    milestones: goal.milestones.map((milestone) => ({
      ...milestone,
      tasks: milestone.tasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
    })),
    updatedAt: new Date().toISOString(),
  }));
}

export default function Page() {
  const [tab, setTab] = useState<NavigationTab>('home');
  const [goalText, setGoalText] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [coachMessage, setCoachMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: Goal[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setGoals(parsed);
        setSelectedGoalId(parsed[0].id);
      }
    } catch {
      setError('Local data could not be loaded. The app is ready to start a new goal.');
    }
  }, []);

  useEffect(() => {
    if (goals.length > 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
    }
  }, [goals]);

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedGoalId) || goals[0] || null,
    [goals, selectedGoalId],
  );

  const currentMission = useMemo(() => {
    if (!selectedGoal) return null;
    for (const milestone of selectedGoal.milestones) {
      for (const task of milestone.tasks) {
        if (task.status !== 'done') return { task, milestone };
      }
    }
    return null;
  }, [selectedGoal]);

  const progress = selectedGoal ? summarizeProgress([selectedGoal]) : { completed: 0, total: 0, percent: 0 };

  const createGoal = async () => {
    const trimmed = goalText.trim();
    if (!trimmed) {
      setError('Please describe the goal you want to achieve.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: trimmed }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Could not generate the goal plan.');
      }

      const generated = payload.goal || generateGoalPlan(trimmed);
      const nextGoals = [generated, ...goals];
      setGoals(nextGoals);
      setSelectedGoalId(generated.id);
      setGoalText('');
      setCoachMessage(`Your goal is saved. Your first mission is to ${generated.milestones[0]?.tasks[0]?.title || 'start the next action'} with clear evidence.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCoachPrompt = async () => {
    if (!selectedGoal) {
      setCoachMessage('Add a goal first so the coach can understand your context.');
      return;
    }

    const currentTask = currentMission?.task?.title || 'No active task';
    const goal = selectedGoal.userGoal;

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          task: currentTask,
          message: 'Please help me focus on the next best action and explain the simplest way to complete it.',
        }),
      });
      const payload = await response.json();
      setCoachMessage(payload?.coach?.message || 'The coach is ready to help when you need it.');
    } catch {
      setCoachMessage('The coach could not respond right now. Please try again in a moment.');
    }
  };

  const toggleTaskDone = (taskId: string, status: Task['status']) => {
    setGoals((prev) => updateTaskStatus(prev, taskId, status));
  };

  return (
    <main className="min-h-screen bg-stone-50 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        <aside className="hidden w-72 border-r border-slate-200 bg-white p-5 lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">D</div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Personal AI coach</p>
                <h1 className="text-xl font-semibold">DON AI</h1>
              </div>
            </div>
            <nav className="space-y-2">
              {['home', 'coach', 'goal', 'progress', 'profile'].map((item) => (
                <button
                  key={item}
                  onClick={() => setTab(item as NavigationTab)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                    tab === item ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </button>
              ))}
            </nav>
          </div>
          <div className="rounded-2xl bg-slate-100 p-3 text-sm text-slate-600">
            {selectedGoal ? selectedGoal.userGoal : 'No active goal yet'}
          </div>
        </aside>

        <div className="flex-1 p-4 pb-28 lg:p-8">
          <header className="mb-6 flex items-center justify-between rounded-3xl bg-white p-4 shadow-soft">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Goal achievement engine</p>
              <h2 className="mt-1 text-2xl font-semibold">{selectedGoal ? selectedGoal.userGoal : 'Build your next step'}</h2>
            </div>
            <div className="rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-medium text-[#1d4ed8]">
              {selectedGoal ? `${progress.percent}% complete` : 'Ready to begin'}
            </div>
          </header>

          {error ? <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

          {tab === 'home' && (
            <div className="space-y-6">
              <section className="rounded-3xl bg-white p-5 shadow-soft">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Today’s Mission</p>
                  {currentMission ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">{currentMission.milestone.title}</span> : null}
                </div>

                {currentMission ? (
                  <>
                    <h3 className="text-3xl font-semibold">{currentMission.task.title}</h3>
                    <p className="mt-3 max-w-2xl text-slate-600">{currentMission.task.objective}</p>
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-slate-100 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Why it matters</p>
                        <p className="mt-2 text-sm text-slate-700">{currentMission.task.why}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-100 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Time</p>
                        <p className="mt-2 text-sm text-slate-700">{currentMission.task.timeEstimate}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-100 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Success looks like</p>
                        <p className="mt-2 text-sm text-slate-700">{currentMission.task.doneDefinition}</p>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        onClick={() => toggleTaskDone(currentMission.task.id, 'done')}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                      >
                        Mark complete
                      </button>
                      <button
                        onClick={() => toggleTaskDone(currentMission.task.id, 'in_progress')}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                      >
                        Start task
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl bg-slate-100 p-6 text-slate-700">
                    <p className="font-medium">No task is active yet.</p>
                    <p className="mt-2 text-sm">Create a goal and the roadmap will unlock your first mission.</p>
                  </div>
                )}
              </section>

              {!selectedGoal && (
                <section className="rounded-3xl bg-white p-5 shadow-soft">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Start here</p>
                  <h3 className="mt-2 text-2xl font-semibold">What do you want to achieve?</h3>
                  <textarea
                    value={goalText}
                    onChange={(e) => setGoalText(e.target.value)}
                    rows={4}
                    placeholder="I want to improve my public speaking so I can confidently give a 5-minute presentation at work in 8 weeks."
                    className="mt-4 w-full rounded-2xl border border-slate-300 bg-slate-50 p-3 text-sm outline-none ring-0 transition focus:border-slate-900"
                  />
                  <div className="mt-4 flex justify-between gap-3">
                    <button
                      onClick={createGoal}
                      disabled={isLoading}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoading ? 'Creating plan...' : 'Create my goal'}
                    </button>
                    <span className="text-xs text-slate-500">AI planning is ready when credentials are added.</span>
                  </div>
                </section>
              )}
            </div>
          )}

          {tab === 'coach' && (
            <section className="rounded-3xl bg-white p-5 shadow-soft">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">AI Coach</p>
                  <h3 className="mt-2 text-2xl font-semibold">Context-aware support</h3>
                </div>
                <button onClick={handleCoachPrompt} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                  Ask coach
                </button>
              </div>

              <div className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-700">
                {coachMessage || 'Your coach will use the current goal and task context to recommend the next step.'}
              </div>
            </section>
          )}

          {tab === 'goal' && selectedGoal && (
            <section className="space-y-6">
              {selectedGoal.milestones.map((milestone) => (
                <div key={milestone.id} className="rounded-3xl bg-white p-5 shadow-soft">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Milestone</p>
                      <h3 className="mt-2 text-xl font-semibold">{milestone.title}</h3>
                    </div>
                    <span className="text-xs text-slate-500">{milestone.targetDate || 'Flexible'}</span>
                  </div>
                  <p className="text-slate-600">{milestone.objective}</p>
                  <p className="mt-3 text-sm text-slate-700">Completion condition: {milestone.completionCondition}</p>

                  <div className="mt-5 space-y-3">
                    {milestone.tasks.map((task) => (
                      <div key={task.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h4 className="font-semibold">{task.title}</h4>
                            <p className="mt-1 text-sm text-slate-600">{task.objective}</p>
                          </div>
                          <button onClick={() => setTab('home')} className="rounded-xl border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700">
                            Open task
                          </button>
                        </div>
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {task.steps.map((step, idx) => (
                            <li key={`${task.id}-${idx}`}>{step}</li>
                          ))}
                        </ul>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>{task.timeEstimate}</span>
                          <span>{task.verification}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {tab === 'progress' && (
            <section className="space-y-6">
              <div className="rounded-3xl bg-white p-5 shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Progress</p>
                <div className="mt-4 flex items-end gap-4">
                  <div>
                    <p className="text-4xl font-semibold">{progress.percent}%</p>
                    <p className="text-sm text-slate-500">Completed</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-slate-900" style={{ width: `${progress.percent}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {selectedGoal && (
                <div className="rounded-3xl bg-white p-5 shadow-soft">
                  <h3 className="text-xl font-semibold">Task status</h3>
                  <div className="mt-4 space-y-3">
                    {selectedGoal.milestones.flatMap((milestone) => milestone.tasks).map((task) => (
                      <div key={task.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-3">
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-xs text-slate-500">{task.verification}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium capitalize text-slate-700">{task.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === 'profile' && (
            <section className="rounded-3xl bg-white p-5 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profile</p>
              <h3 className="mt-2 text-2xl font-semibold">Preferences and memory</h3>
              <div className="mt-5 space-y-4 text-sm text-slate-700">
                <div className="rounded-2xl bg-slate-100 p-4">
                  <p className="font-medium text-slate-900">Storage mode</p>
                  <p className="mt-2">Local browser storage is active for the MVP. Configure Supabase to keep the same data safely across users and sessions.</p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-4">
                  <p className="font-medium text-slate-900">AI configuration</p>
                  <p className="mt-2">Add OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY in GitHub Codespaces secrets or a local .env.local file.</p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/90 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-2 text-center text-[11px] font-medium text-slate-700">
          {['home', 'coach', 'goal', 'progress', 'profile'].map((item) => (
            <button key={item} onClick={() => setTab(item as NavigationTab)} className={`rounded-xl px-2 py-2 ${tab === item ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>
              {item}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
