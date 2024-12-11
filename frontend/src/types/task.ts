export interface WorkLog {
  id: number
  task_id: number
  description: string
  started_at: string
  ended_at?: string
}

export interface Task {
  id: number
  title: string
  description: string
  motivation: number
  priority: number
  deadline?: string
  estimated_time?: number
  priority_score: number
  motivation_score: number
  status: string
  created_at: string
  last_updated: string
  work_logs?: WorkLog[]
  parent_id?: number
}

export interface SubTask {
  id: number;
  task_id: number;
  title: string;
  description?: string;
  created_at: string;
  updated_at: string;
  leaf_tasks?: LeafTask[];
}

export interface LeafTask {
  id: number;
  sub_task_id: number;
  title: string;
  description?: string;
  created_at: string;
  updated_at: string;
  action_items?: ActionItem[];
}

export interface ActionItem {
  id: number;
  leaf_task_id: number;
  content: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
} 