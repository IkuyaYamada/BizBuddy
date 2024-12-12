export interface HierarchicalTask {
  id: number;
  title: string;
  description?: string;
  is_completed: boolean;
  parent_id?: number;
  level: number;
  children?: HierarchicalTask[];
  deadline?: string;
  priority?: number;
  created_at: string;
  updated_at: string;
  position?: number;
}

export interface TaskTreeNode extends HierarchicalTask {
  children: TaskTreeNode[];
}

export interface TasksByParent {
  [key: string | number]: HierarchicalTask[];
} 