import { Goal, Milestone, Task } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isTask(value: unknown): value is Task {
  if (!isRecord(value)) return false;
  const statuses = ['todo', 'in_progress', 'done', 'blocked'];
  const verificationModes = ['manual', 'evidence', 'test', 'integration'];

  return typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.objective === 'string'
    && typeof value.why === 'string'
    && typeof value.timeEstimate === 'string'
    && typeof value.resources === 'string'
    && Array.isArray(value.steps)
    && value.steps.every((step) => typeof step === 'string')
    && typeof value.doneDefinition === 'string'
    && typeof value.verification === 'string'
    && typeof value.verificationMode === 'string'
    && verificationModes.includes(value.verificationMode)
    && typeof value.status === 'string'
    && statuses.includes(value.status)
    && (value.notes === undefined || typeof value.notes === 'string');
}

function isMilestone(value: unknown): value is Milestone {
  if (!isRecord(value)) return false;

  return typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.objective === 'string'
    && (value.targetDate === undefined || typeof value.targetDate === 'string')
    && typeof value.completionCondition === 'string'
    && Array.isArray(value.tasks)
    && value.tasks.length <= 100
    && value.tasks.every(isTask);
}

export function isGoal(value: unknown): value is Goal {
  if (!isRecord(value)) return false;

  return typeof value.id === 'string'
    && value.id.length > 0
    && value.id.length <= 200
    && typeof value.userGoal === 'string'
    && value.userGoal.length <= 10_000
    && typeof value.outcome === 'string'
    && typeof value.motivation === 'string'
    && typeof value.currentBaseline === 'string'
    && typeof value.constraints === 'string'
    && (value.targetDate === undefined || typeof value.targetDate === 'string')
    && Array.isArray(value.milestones)
    && value.milestones.length <= 100
    && value.milestones.every(isMilestone)
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string';
}
