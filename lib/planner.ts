import { Goal, Milestone, Task } from './types';

export interface CurrentMission {
  task: Task;
  milestone: Milestone;
  nextTask: Task | null;
}

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const createTask = (title: string, objective: string, why: string, timeEstimate: string, resources: string, steps: string[], verification: string, verificationMode: Task['verificationMode']): Task => ({
  id: `${title}-${Math.random().toString(16).slice(2, 8)}`,
  title,
  objective,
  why,
  timeEstimate,
  resources,
  steps,
  doneDefinition: `Completed and verified through ${verification.toLowerCase()}`,
  verification,
  verificationMode,
  status: 'todo',
});

export function getCurrentMission(goal: Goal | null): CurrentMission | null {
  if (!goal) return null;

  const plannedTasks = goal.milestones.flatMap((milestone) =>
    milestone.tasks.map((task) => ({ task, milestone })),
  );
  const activeIndex = plannedTasks.findIndex(({ task }) => task.status === 'in_progress');
  const missionIndex = activeIndex >= 0
    ? activeIndex
    : plannedTasks.findIndex(({ task }) => task.status !== 'done');

  if (missionIndex < 0) return null;

  const mission = plannedTasks[missionIndex];
  const remainingTasks = plannedTasks.filter(
    ({ task }, index) => index !== missionIndex && task.status !== 'done',
  );
  const nextTask = remainingTasks.find(({ task }) => task.status === 'in_progress')?.task
    ?? remainingTasks[0]?.task
    ?? null;

  return { ...mission, nextTask };
}

export function generateGoalPlan(userGoal: string): Goal {
  const trimmed = userGoal.trim();
  const outcome = trimmed.length > 0 ? trimmed : 'Build a clear, actionable plan';

  const milestones: Milestone[] = [
    {
      id: `milestone-1-${Math.random().toString(16).slice(2, 8)}`,
      title: 'Clarify the goal and baseline',
      objective: 'Define the target outcome and measure where you are today.',
      targetDate: addDays(3),
      completionCondition: 'You can explain the goal, the success metric, and current starting point in one sentence.',
      tasks: [
        createTask(
          'Write the end state',
          'Describe the result you want in plain language.',
          'A precise outcome keeps the plan realistic and motivating.',
          '20 minutes',
          'Notebook or notes app',
          ['Write your goal in one sentence.', 'Identify the most important outcome.', 'State what success should look like.'],
          'User confirms the outcome matches the target result.',
          'manual',
        ),
        createTask(
          'Measure today’s baseline',
          'Assess the current state before planning the work.',
          'Without a baseline, effort appears productive but may not move the goal.',
          '30 minutes',
          'Current materials, previous work, metrics',
          ['List your current starting point.', 'Capture any limiting factors.', 'Note what is already working.'],
          'Baseline is recorded and used in the roadmap.',
          'evidence',
        ),
      ],
    },
    {
      id: `milestone-2-${Math.random().toString(16).slice(2, 8)}`,
      title: 'Build the first execution loop',
      objective: 'Create the first practical actions that move the goal forward quickly.',
      targetDate: addDays(7),
      completionCondition: 'The first meaningful actions are scheduled and the user knows the exact next step.',
      tasks: [
        createTask(
          'Select your top priority',
          'Choose the highest-value task with the greatest leverage.',
          'A focused first win builds momentum and reduces friction.',
          '15 minutes',
          'Goal list and constraints',
          ['Review the options.', 'Pick the most urgent and highest-impact item.', 'Check whether the task has required prerequisites.'],
          'The chosen action is clearly recorded as the current mission.',
          'manual',
        ),
        createTask(
          'Create the execution plan',
          'Break the task into clear steps with deadlines and evidence.',
          'Smaller steps are easier to start and harder to avoid.',
          '25 minutes',
          'Planner, calendar, notes',
          ['List the required steps.', 'Estimate time needed.', 'Assign a completion check.'],
          'The task contains steps, time estimate, and verification method.',
          'evidence',
        ),
      ],
    },
    {
      id: `milestone-3-${Math.random().toString(16).slice(2, 8)}`,
      title: 'Track progress and adapt',
      objective: 'Review what worked, identify obstacles, and adjust the roadmap based on real evidence.',
      targetDate: addDays(14),
      completionCondition: 'At least one task has been completed and the next action is adjusted using evidence.',
      tasks: [
        createTask(
          'Complete the first task',
          'Take action and finish the current mission.',
          'Focused execution is the core mechanism for improvement.',
          '30-60 minutes',
          'Task instructions and needed tools',
          ['Follow the task steps.', 'Capture evidence.', 'Note any blockers or surprises.'],
          'The task is marked done and evidence is saved.',
          'evidence',
        ),
        createTask(
          'Review the outcome',
          'Decide what changed, what blocked progress, and what should happen next.',
          'Real improvement comes from learning from execution, not from planning alone.',
          '15 minutes',
          'Progress notes and evidence',
          ['Review what happened.', 'Identify the blocker or success factor.', 'Update the next best action.'],
          'The plan and next mission are updated based on new evidence.',
          'manual',
        ),
      ],
    },
  ];

  return {
    id: `goal-${Math.random().toString(16).slice(2, 10)}`,
    userGoal: trimmed,
    outcome,
    motivation: 'The user wants progress that is meaningful, measurable, and realistic.',
    currentBaseline: 'The user has defined the goal but has not yet started execution.',
    constraints: 'Time, budget, and skill level will be confirmed as the plan unfolds.',
    targetDate: addDays(21),
    milestones,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function summarizeProgress(goals: Goal[]) {
  const allTasks = goals.flatMap((goal) => goal.milestones.flatMap((milestone) => milestone.tasks));
  const completed = allTasks.filter((task) => task.status === 'done').length;
  const total = allTasks.length;
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}
