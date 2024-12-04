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
} 