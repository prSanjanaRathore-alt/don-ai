"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { generateGoalPlan, getCurrentMission, summarizeProgress } from '@/lib/planner';
import { isGoal } from '@/lib/goal-validation';
import { Goal, Task } from '@/lib/types';

const STORAGE_KEY = 'don-ai-goals';

type NavigationTab = 'home' | 'coach' | 'goal' | 'progress' | 'profile';
type AuthStatus = 'loading' | 'signed_out' | 'signed_in' | 'local' | 'error';
const NAVIGATION_TABS: NavigationTab[] = ['home', 'coach', 'goal', 'progress', 'profile'];

function readLocalGoals(): { goals: Goal[]; error: string | null } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { goals: [], error: null };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { goals: [], error: 'Local data is not in the expected format.' };
    return { goals: parsed.filter(isGoal), error: null };
  } catch {
    return { goals: [], error: 'Local data could not be loaded. The app is ready to start a new goal.' };
  }
}

function updateTaskStatus(goals: Goal[], taskId: string, status: Task['status']): Goal[] {
  return goals.map((goal) => {
    if (!goal.milestones.some((milestone) => milestone.tasks.some((task) => task.id === taskId))) {
      return goal;
    }

    return {
      ...goal,
      milestones: goal.milestones.map((milestone) => ({
        ...milestone,
        tasks: milestone.tasks.map((task) => (task.id === taskId ? { ...task, status } : task)),
      })),
      updatedAt: new Date().toISOString(),
    };
  });
}

export default function Page() {
  const [tab, setTab] = useState<NavigationTab>('home');
  const [goalText, setGoalText] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [authConfigured, setAuthConfigured] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [localGoalCount, setLocalGoalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isTaskSaving, setIsTaskSaving] = useState(false);
  const [isImportingGoals, setIsImportingGoals] = useState(false);
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [coachMessage, setCoachMessage] = useState('');
  const [coachError, setCoachError] = useState('');
  const [error, setError] = useState('');

  const loadAccountGoals = useCallback(async () => {
    const response = await fetch('/api/goals', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || 'Could not load your saved goals.');
    }

    const loadedGoals: unknown = payload?.goals;
    if (!Array.isArray(loadedGoals) || !loadedGoals.every(isGoal)) {
      throw new Error('Saved goals could not be read. Contact support if this keeps happening.');
    }

    return loadedGoals;
  }, []);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      const callbackUrl = new URL(window.location.href);
      if (callbackUrl.searchParams.get('authError') === 'confirmation') {
        setAuthMessage('That confirmation link could not be verified. Request a new email and try again.');
        callbackUrl.searchParams.delete('authError');
        window.history.replaceState(null, '', `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`);
      }

      try {
        const response = await fetch('/api/auth', { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'Could not verify your account.');
        }

        if (!active) return;
        const configured = payload?.configured === true;
        setAuthConfigured(configured);
        const local = readLocalGoals();
        setLocalGoalCount(local.goals.length);
        if (local.error) setError(local.error);

        if (!configured) {
          setGoals(local.goals);
          setSelectedGoalId(local.goals[0]?.id || '');
          setAuthStatus('local');
        } else if (payload?.user?.email) {
          setUserEmail(payload.user.email);
          const accountGoals = await loadAccountGoals();
          if (active) {
            setGoals(accountGoals);
            setSelectedGoalId(accountGoals[0]?.id || '');
            setAuthStatus('signed_in');
          }
        } else {
          setAuthStatus('signed_out');
        }
      } catch (initializationError) {
        if (active) {
          setAuthStatus('error');
          setError(initializationError instanceof Error ? initializationError.message : 'Could not verify your account.');
        }
      } finally {
        if (active) setHasLoaded(true);
      }
    };

    void initialize();
    return () => {
      active = false;
    };
  }, [loadAccountGoals]);

  useEffect(() => {
    if (!hasLoaded || authStatus !== 'local') return;

    try {
      if (goals.length > 0) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
      }
    } catch {
      window.setTimeout(
        () => setError('Your progress could not be saved in this browser. Check available storage and try again.'),
        0,
      );
    }
  }, [goals, hasLoaded, authStatus]);

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedGoalId) || goals[0] || null,
    [goals, selectedGoalId],
  );

  const currentMission = useMemo(
    () => getCurrentMission(selectedGoal),
    [selectedGoal],
  );

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
      let generated: Goal;
      if (authStatus === 'signed_in') {
        const response = await fetch('/api/goal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal: trimmed }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'Could not generate and save the goal plan.');
        }
        if (!isGoal(payload?.goal)) {
          throw new Error('The saved goal response was invalid. Please try again.');
        }
        generated = payload.goal;
      } else {
        generated = generateGoalPlan(trimmed);
      }

      setGoals((previous) => [generated, ...previous]);
      setSelectedGoalId(generated.id);
      setGoalText('');
      setCoachMessage(`Your goal is saved. Your first mission is to ${generated.milestones[0]?.tasks[0]?.title || 'start the next action'} with clear evidence.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAuthLoading(true);
    setError('');
    setAuthMessage('');

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: authMode, email: authEmail, password: authPassword }),
      });
      const payload = await response.json();
      if (response.status === 202 && payload?.emailConfirmationRequired) {
        setAuthMessage(payload.message || 'Check your email to confirm your account, then sign in.');
        return;
      }
      if (!response.ok || !payload?.user?.email) {
        throw new Error(payload?.error || 'Your account could not be verified.');
      }

      setUserEmail(payload.user.email);
      const accountGoals = await loadAccountGoals();
      setGoals(accountGoals);
      setSelectedGoalId(accountGoals[0]?.id || '');
      setAuthPassword('');
      setAuthStatus('signed_in');
      setHasLoaded(true);
      setAuthMessage('');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Your account could not be verified.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const continueLocally = () => {
    const local = readLocalGoals();
    setGoals(local.goals);
    setSelectedGoalId(local.goals[0]?.id || '');
    setLocalGoalCount(local.goals.length);
    setError(local.error || '');
    setAuthStatus('local');
    setHasLoaded(true);
  };

  const signOut = async () => {
    setIsAuthLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth', { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Could not sign out.');
      setGoals([]);
      setSelectedGoalId('');
      setUserEmail('');
      setAuthStatus('signed_out');
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Could not sign out.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const importLocalGoals = async () => {
    const local = readLocalGoals();
    if (local.error) {
      setError(local.error);
      return;
    }
    if (local.goals.length === 0) {
      setLocalGoalCount(0);
      return;
    }

    setIsImportingGoals(true);
    setError('');
    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goals: local.goals }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Could not import local goals.');

      const accountGoals = await loadAccountGoals();
      setGoals(accountGoals);
      setSelectedGoalId(accountGoals[0]?.id || '');
      window.localStorage.removeItem(STORAGE_KEY);
      setLocalGoalCount(0);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Could not import local goals.');
    } finally {
      setIsImportingGoals(false);
    }
  };

  const handleCoachPrompt = async () => {
    if (!selectedGoal) {
      setCoachMessage('Add a goal first so the coach can understand your context.');
      setTab('coach');
      return;
    }

    const currentTask = currentMission?.task?.title || 'No active task';
    const goal = selectedGoal.userGoal;

    setTab('coach');
    setIsCoachLoading(true);
    setCoachError('');
    setError('');

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
      if (!response.ok) {
        throw new Error(payload?.error || 'The coach could not respond right now.');
      }
      setCoachMessage(payload?.coach?.message || 'The coach is ready to help when you need it.');
      setCoachError('');
    } catch (err) {
      setCoachError(err instanceof Error ? err.message : 'The coach could not respond right now. Please try again in a moment.');
    } finally {
      setIsCoachLoading(false);
    }
  };

  const toggleTaskDone = async (taskId: string, status: Task['status']) => {
    if (isTaskSaving) return;

    if (authStatus === 'signed_in' && selectedGoal) {
      setIsTaskSaving(true);
      setError('');
      try {
        const response = await fetch('/api/goals', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goalId: selectedGoal.id, taskId, status }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Could not save your mission progress.');
        if (!isGoal(payload?.goal)) throw new Error('The saved progress response was invalid.');
        setGoals((previous) => previous.map((goal) => goal.id === payload.goal.id ? payload.goal : goal));
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Could not save your mission progress.');
      } finally {
        setIsTaskSaving(false);
      }
      return;
    }

    setGoals((previous) => updateTaskStatus(previous, taskId, status));
  };

  if (authStatus === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8f6] p-4 text-slate-900">
        <section aria-busy="true" className="w-full max-w-md rounded-3xl bg-white p-7 shadow-soft">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
          <div className="mt-4 h-7 w-48 animate-pulse rounded bg-slate-100" />
          <p className="mt-5 text-sm text-slate-600">Checking your account and saved progress…</p>
        </section>
      </main>
    );
  }

  if (authStatus === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8f6] p-4 text-slate-900">
        <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Account unavailable</p>
          <h1 className="mt-2 text-2xl font-semibold">We couldn’t verify your session.</h1>
          <p role="alert" className="mt-3 text-sm text-red-700">{error || 'Check your connection and account configuration.'}</p>
          <div className="mt-5 flex flex-col gap-3">
            <button onClick={() => window.location.reload()} className="min-h-11 rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white">
              Try again
            </button>
            <button onClick={continueLocally} className="min-h-11 rounded-xl border border-slate-300 px-5 py-2 text-sm font-medium text-slate-800">
              Continue in local-only mode
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (authStatus === 'signed_out') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8f6] p-4 text-slate-900">
        <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-soft sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white" aria-hidden="true">D</div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Personal AI coach</p>
              <h1 className="text-xl font-semibold">DON AI</h1>
            </div>
          </div>
          <p className="mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Your account</p>
          <h2 className="mt-2 text-2xl font-semibold">{authMode === 'sign-in' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Sign in to securely sync goals and progress across your devices.
          </p>
          {error ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          {authMessage ? <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{authMessage}</p> : null}
          <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="account-email" className="mb-1.5 block text-sm font-medium">Email</label>
              <input
                id="account-email"
                type="email"
                autoComplete="email"
                required
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label htmlFor="account-password" className="mb-1.5 block text-sm font-medium">Password</label>
              <input
                id="account-password"
                type="password"
                autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'}
                minLength={authMode === 'sign-up' ? 8 : undefined}
                required
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
              />
              {authMode === 'sign-up' ? <p className="mt-1 text-xs text-slate-500">Use at least 8 characters.</p> : null}
            </div>
            <button
              type="submit"
              disabled={isAuthLoading}
              className="min-h-11 w-full rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60"
            >
              {isAuthLoading ? 'Checking…' : authMode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setAuthMode((mode) => mode === 'sign-in' ? 'sign-up' : 'sign-in');
              setError('');
              setAuthMessage('');
            }}
            className="mt-4 min-h-11 w-full rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {authMode === 'sign-in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </button>
          {localGoalCount > 0 ? (
            <p className="mt-3 text-center text-xs text-slate-600">
              {localGoalCount} goal{localGoalCount === 1 ? '' : 's'} saved on this device. You can import them after signing in.
            </p>
          ) : null}
          <button
            type="button"
            onClick={continueLocally}
            className="mt-4 min-h-11 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Continue in local-only mode
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-slate-900">
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
            <nav aria-label="Main navigation" className="space-y-2">
              {NAVIGATION_TABS.map((item) => (
                <button
                  key={item}
                  onClick={() => setTab(item)}
                  aria-current={tab === item ? 'page' : undefined}
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
          <header className="mb-6 flex items-center justify-between gap-3 rounded-3xl bg-white p-4 shadow-soft sm:p-5">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Your next step</p>
              <h2 className="mt-1 line-clamp-2 text-xl font-semibold sm:text-2xl">
                {selectedGoal ? selectedGoal.userGoal : 'Build your next step'}
              </h2>
            </div>
            <div className="shrink-0 rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-medium text-[#1d4ed8]">
              {selectedGoal ? `${progress.percent}% complete` : 'Ready to begin'}
            </div>
          </header>

          {authStatus === 'local' ? (
            <div role="status" className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Local-only mode: goals stay in this browser and are not synced.
                {!authConfigured ? ' Set up Supabase to enable secure accounts and cloud storage.' : ''}
              </p>
              {authConfigured ? (
                <button onClick={() => setAuthStatus('signed_out')} className="min-h-11 shrink-0 rounded-xl border border-amber-300 px-4 py-2 font-medium hover:bg-amber-100">
                  Sign in to sync
                </button>
              ) : null}
            </div>
          ) : null}

          {error ? <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

          {tab === 'home' && (
            <div className="space-y-6">
              {!hasLoaded ? (
                <section aria-busy="true" aria-live="polite" className="rounded-3xl bg-white p-6 shadow-soft">
                  <p className="text-sm text-slate-600">Loading your saved progress…</p>
                  <div className="mt-4 h-2 animate-pulse rounded-full bg-slate-100" />
                </section>
              ) : !selectedGoal ? (
                <section className="rounded-3xl bg-white p-5 shadow-soft sm:p-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Start here</p>
                  <h3 className="mt-2 text-2xl font-semibold">What would you like to move forward?</h3>
                  <p className="mt-2 max-w-xl text-sm text-slate-600">Tell us the outcome you want. We’ll turn it into a practical first step.</p>
                  <form
                    className="mt-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void createGoal();
                    }}
                  >
                    <label htmlFor="goal-description" className="mb-2 block text-sm font-medium text-slate-800">
                      Your goal
                    </label>
                    <textarea
                      id="goal-description"
                      value={goalText}
                      onChange={(event) => setGoalText(event.target.value)}
                      rows={4}
                      placeholder="I want to feel confident giving a 5-minute presentation at work."
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 p-3 text-sm outline-none transition focus:border-slate-900"
                    />
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <button
                        type="submit"
                        disabled={isLoading || !goalText.trim()}
                        className="min-h-11 rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isLoading ? 'Creating your plan…' : 'Create my goal'}
                      </button>
                      <span className="text-xs text-slate-500">
                        {authStatus === 'local' ? 'This plan is saved only in this browser.' : 'This plan is saved to your account.'}
                      </span>
                    </div>
                  </form>
                </section>
              ) : currentMission ? (
                <section aria-labelledby="mission-title" className="overflow-hidden rounded-3xl bg-white shadow-soft">
                  <div className="border-b border-slate-100 p-5 sm:p-7">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Today’s mission</p>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {currentMission.task.status === 'in_progress'
                          ? 'In progress'
                          : currentMission.task.status === 'blocked'
                            ? 'Needs attention'
                            : 'Ready when you are'}
                      </span>
                    </div>
                    <p className="mt-5 text-sm font-medium text-slate-500">{currentMission.milestone.title}</p>
                    <h3 id="mission-title" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                      {currentMission.task.title}
                    </h3>
                    <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">{currentMission.task.objective}</p>
                  </div>

                  <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-7 lg:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Why it matters</p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">{currentMission.task.why}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Time to set aside</p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">{currentMission.task.timeEstimate}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2 lg:col-span-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">You’re done when</p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">{currentMission.task.doneDefinition}</p>
                    </div>
                  </div>

                  <div className="px-5 pb-5 sm:px-7 sm:pb-7">
                    <details className="group rounded-2xl border border-slate-200">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium text-slate-800">
                        <span>Steps to complete this mission</span>
                        <span aria-hidden="true" className="text-slate-500 transition-transform group-open:rotate-180">⌄</span>
                      </summary>
                      <ol className="list-decimal space-y-2 px-9 pb-4 text-sm leading-relaxed text-slate-600">
                        {currentMission.task.steps.map((step, index) => (
                          <li key={`${currentMission.task.id}-${index}`}>{step}</li>
                        ))}
                      </ol>
                    </details>

                    <div className="mt-4 rounded-2xl bg-[#f3f6ff] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#445c91]">After this</p>
                      <p className="mt-1 text-sm text-slate-700">
                        {currentMission.nextTask
                          ? `Your next step is “${currentMission.nextTask.title}.”`
                          : 'You’ll have completed this goal. Take a moment to review your progress.'}
                      </p>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => toggleTaskDone(currentMission.task.id, 'in_progress')}
                        disabled={currentMission.task.status === 'in_progress'}
                        className="min-h-11 rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-default disabled:bg-emerald-700"
                      >
                        {currentMission.task.status === 'in_progress' ? 'Mission in progress' : 'Start mission'}
                      </button>
                      <button
                        onClick={() => toggleTaskDone(currentMission.task.id, 'done')}
                        className="min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                      >
                        Mark complete
                      </button>
                      <button
                        onClick={() => void handleCoachPrompt()}
                        disabled={isCoachLoading}
                        className="min-h-11 rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isCoachLoading ? 'Asking coach…' : 'Ask coach for help'}
                      </button>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="rounded-3xl bg-white p-6 shadow-soft sm:p-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-800" aria-hidden="true">✓</div>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">Goal complete</p>
                  <h3 className="mt-2 text-2xl font-semibold">You made it happen.</h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
                    You’ve completed every mission for this goal. Review what worked and carry that momentum into what’s next.
                  </p>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <button onClick={() => setTab('progress')} className="min-h-11 rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700">
                      Review my progress
                    </button>
                    <button onClick={() => setTab('goal')} className="min-h-11 rounded-xl border border-slate-300 px-5 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50">
                      View the roadmap
                    </button>
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
                <button
                  onClick={() => void handleCoachPrompt()}
                  disabled={isCoachLoading}
                  className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60"
                >
                  {isCoachLoading ? 'Thinking…' : 'Ask coach'}
                </button>
              </div>

              {coachError ? (
                <div role="alert" aria-live="polite" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-800">
                  {coachError}
                </div>
              ) : (
                <div role="status" aria-live="polite" className="rounded-2xl bg-slate-100 p-4 text-sm leading-relaxed text-slate-700">
                  {coachMessage || 'Your coach will use the current goal and task context to recommend the next step.'}
                </div>
              )}
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
                  {authStatus === 'signed_in' ? (
                    <>
                      <p className="mt-2">Signed in as {userEmail}. Goals are saved to your Supabase account.</p>
                      <button
                        onClick={() => void signOut()}
                        disabled={isAuthLoading}
                        className="mt-3 min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-60"
                      >
                        {isAuthLoading ? 'Signing out…' : 'Sign out'}
                      </button>
                      {localGoalCount > 0 ? (
                        <div className="mt-4 border-t border-slate-200 pt-4">
                          <p>{localGoalCount} local goal{localGoalCount === 1 ? '' : 's'} are still saved in this browser.</p>
                          <button
                            onClick={() => void importLocalGoals()}
                            disabled={isImportingGoals}
                            className="mt-3 min-h-11 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                          >
                            {isImportingGoals ? 'Importing…' : 'Import local goals'}
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : authConfigured ? (
                    <>
                      <p className="mt-2">You are using local-only mode. Sign in to sync goals securely across devices.</p>
                      <button onClick={() => setAuthStatus('signed_out')} className="mt-3 min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium">
                        Sign in to sync
                      </button>
                    </>
                  ) : (
                    <p className="mt-2">Local-only mode is active. Goals are stored in this browser. Configure server-side Supabase settings to enable accounts and synced storage.</p>
                  )}
                </div>
                <div className="rounded-2xl bg-slate-100 p-4">
                  <p className="font-medium text-slate-900">AI configuration</p>
                  <p className="mt-2">The coach requires a signed-in account and a server-side AI_PROVIDER plus matching OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY. Keys are never sent to the browser.</p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-2 text-center text-[11px] font-medium text-slate-700">
          {NAVIGATION_TABS.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              aria-current={tab === item ? 'page' : undefined}
              className={`min-h-11 rounded-xl px-1 py-2 capitalize transition ${tab === item ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
            >
              {item}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
