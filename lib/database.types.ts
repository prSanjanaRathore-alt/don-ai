import { Goal } from './types';

export type Database = {
  public: {
    Tables: {
      goal_plans: {
        Row: {
          id: string;
          user_id: string;
          plan: Goal;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          plan: Goal;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan?: Goal;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
