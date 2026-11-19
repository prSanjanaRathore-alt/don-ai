import { describe, expect, it } from 'vitest';
import { generateGoalPlan, getCurrentMission, summarizeProgress } from '../lib/planner';

describe('generateGoalPlan', () => {
  it('creates milestones and tasks for a user goal', () => {
    const goal = generateGoalPlan('I want to prepare for a job interview in 4 weeks.');

    expect(goal.userGoal).toContain('prepare for a job interview');
    expect(goal.milestones.length).toBeGreaterThanOrEqual(3);
    expect(goal.milestones[0].tasks.length).toBeGreaterThanOrEqual(2);
  });

  it('summarizes progress correctly', () => {
    const goal = generateGoalPlan('I want to build a small project in 2 weeks.');
    goal.milestones[0].tasks[0].status = 'done';
    goal.milestones[1].tasks[1].status = 'done';

    const summary = summarizeProgress([goal]);
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.completed).toBeGreaterThanOrEqual(2);
    expect(summary.percent).toBeGreaterThanOrEqual(0);
  });
});

describe('getCurrentMission', () => {
  it('resumes an in-progress task and points to the next unfinished task', () => {
    const goal = generateGoalPlan('I want to prepare for a job interview in 4 weeks.');
    const [firstTask, activeTask] = goal.milestones[0].tasks;
    firstTask.status = 'done';
    activeTask.status = 'in_progress';

    const mission = getCurrentMission(goal);

    expect(mission?.task).toBe(activeTask);
    expect(mission?.nextTask).toBe(goal.milestones[1].tasks[0]);
  });

  it('returns the first unfinished task and no mission when the goal is complete', () => {
    const goal = generateGoalPlan('I want to prepare for a job interview in 4 weeks.');

    expect(getCurrentMission(goal)?.task).toBe(goal.milestones[0].tasks[0]);

    goal.milestones.forEach((milestone) => {
      milestone.tasks.forEach((task) => {
        task.status = 'done';
      });
    });

    expect(getCurrentMission(goal)).toBeNull();
    expect(getCurrentMission(null)).toBeNull();
  });

  it('keeps an earlier unfinished task in the next-step preview when resuming later work', () => {
    const goal = generateGoalPlan('I want to prepare for a job interview in 4 weeks.');
    const [earlierTask, activeTask] = goal.milestones[0].tasks;
    activeTask.status = 'in_progress';

    const mission = getCurrentMission(goal);

    expect(mission?.task).toBe(activeTask);
    expect(mission?.nextTask).toBe(earlierTask);
  });
});
