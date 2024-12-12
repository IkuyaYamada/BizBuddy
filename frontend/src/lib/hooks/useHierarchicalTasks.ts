import { useState, useCallback, useEffect } from 'react';
import { HierarchicalTask } from '@/types/hierarchicalTask';
import { Task } from '@/types/task';
import * as api from '@/lib/api';

// ステータスの優先順位を定義
const statusOrder = {
  '進行中': 0,
  '未着手': 1,
  'on hold': 2,
  'casual': 3,
  'backlog': 4,
  '完了': 5
};

export const useHierarchicalTasks = (tasks: Task[]) => {
  const [hierarchicalTasks, setHierarchicalTasks] = useState<HierarchicalTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // タスクの取得とソート
  const sortMainTasks = useCallback((mainTasks: HierarchicalTask[]): HierarchicalTask[] => {
    return [...mainTasks].sort((a, b) => {
      // まずステータスで並び替え
      const taskA = tasks.find(t => t.id === a.id);
      const taskB = tasks.find(t => t.id === b.id);
      const statusA = taskA?.status || '未着手';
      const statusB = taskB?.status || '未着手';
      
      const orderA = statusOrder[statusA as keyof typeof statusOrder];
      const orderB = statusOrder[statusB as keyof typeof statusOrder];
      
      if (orderA !== orderB) {
        return (orderA ?? 999) - (orderB ?? 999);
      }

      // 同ステータス内では優先度の降順で並び替え
      const priorityA = taskA?.priority || 0;
      const priorityB = taskB?.priority || 0;
      return priorityB - priorityA;
    });
  }, [tasks]);

  // タスクをツリー構造に整理する関数
  const organizeTasksIntoTree = useCallback((tasks: HierarchicalTask[]): HierarchicalTask[] => {
    const tasksByParent = tasks.reduce((acc, task) => {
      const parentId = task.parent_id || 'root';
      if (!acc[parentId]) {
        acc[parentId] = [];
      }
      acc[parentId].push(task);
      return acc;
    }, {} as Record<string | number, HierarchicalTask[]>);

    const buildTree = (parentId: string | number = 'root', level: number = 0): HierarchicalTask[] => {
      const children = tasksByParent[parentId] || [];
      const result: HierarchicalTask[] = [];
      
      for (const task of children) {
        result.push({
          ...task,
          level
        });
        if (tasksByParent[task.id]) {
          result.push(...buildTree(task.id, level + 1));
        }
      }
      
      return result;
    };

    return buildTree();
  }, []);

  // タスクの取得
  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getHierarchicalTasks();
      
      // 既存のタスクを第一階層として表示
      const mainTasks = tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        is_completed: task.status === '完了',
        level: 0,
        created_at: task.created_at,
        updated_at: task.last_updated,
        priority: task.priority
      }));

      // 第一階層のタスクをソート
      const sortedMainTasks = sortMainTasks(mainTasks);
      
      // すべてのタスクを組み合わせてツリー構造に整理
      const allTasks = [...sortedMainTasks, ...data];
      setHierarchicalTasks(organizeTasksIntoTree(allTasks));
    } catch (error) {
      setError(error as Error);
      console.error('Failed to fetch tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tasks, sortMainTasks, organizeTasksIntoTree]);

  // タスクの追加
  const addTask = useCallback(async (parentId?: number, level: number = 0) => {
    try {
      const newTask = await api.createHierarchicalTask({
        title: '新しいタスク',
        is_completed: false,
        parent_id: parentId,
        level,
      });

      setHierarchicalTasks(prev => {
        const newTasks = [...prev, { ...newTask, children: [] }];
        return organizeTasksIntoTree(newTasks);
      });

      return newTask;
    } catch (error) {
      console.error('Failed to add task:', error);
      throw error;
    }
  }, [organizeTasksIntoTree]);

  // タスクの削除
  const deleteTask = useCallback(async (taskId: number) => {
    try {
      await api.deleteHierarchicalTask(taskId);
      
      setHierarchicalTasks(prev => {
        const deletedTaskIds = new Set<number>();
        
        const collectTaskIds = (tasks: HierarchicalTask[], targetId: number) => {
          const task = tasks.find(t => t.id === targetId);
          if (!task) return;
          
          deletedTaskIds.add(task.id);
          tasks.forEach(t => {
            if (t.parent_id === task.id) {
              collectTaskIds(tasks, t.id);
            }
          });
        };
        
        collectTaskIds(prev, taskId);
        const newTasks = prev.filter(task => !deletedTaskIds.has(task.id));
        return organizeTasksIntoTree(newTasks);
      });
    } catch (error) {
      console.error('Failed to delete task:', error);
      throw error;
    }
  }, [organizeTasksIntoTree]);

  // タスクの更新
  const updateTask = useCallback(async (taskId: number, updates: Partial<HierarchicalTask>) => {
    try {
      const task = hierarchicalTasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task not found');

      const updatedTask = await api.updateHierarchicalTask(taskId, {
        ...task,
        ...updates,
      });

      setHierarchicalTasks(prev => {
        const newTasks = prev.map(t => t.id === taskId ? { ...t, ...updatedTask } : t);
        return organizeTasksIntoTree(newTasks);
      });

      return updatedTask;
    } catch (error) {
      console.error('Failed to update task:', error);
      throw error;
    }
  }, [hierarchicalTasks, organizeTasksIntoTree]);

  // 初期データの取得
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    hierarchicalTasks,
    isLoading,
    error,
    addTask,
    deleteTask,
    updateTask,
    fetchTasks,
  };
}; 