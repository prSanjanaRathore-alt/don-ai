export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';
export type VerificationMode = 'manual' | 'evidence' | 'test' | 'integration';

export interface Task {
  id: string;
  title: string;
  objective: string;
  why: string;
  timeEstimate: string;
  resources: string;
  steps: string[];
  doneDefinition: string;
  verification: string;
  verificationMode: VerificationMode;
  status: TaskStatus;
  notes?: string;
}

export interface Milestone {
  id: string;
  title: string;
  objective: string;
  targetDate?: string;
  completionCondition: string;
  tasks: Task[];
}

export interface Goal {
  id: string;
  userGoal: string;
  outcome: string;
  motivation: string;
  currentBaseline: string;
  constraints: string;
  targetDate?: string;
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
}

export interface GoalDraft {
  userGoal: string;
  outcome: string;
  motivation: string;
  currentBaseline: string;
  constraints: string;
  targetDate?: string;
}
