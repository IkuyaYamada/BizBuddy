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
  }, []);

  // タスクをツリー構造に整理する関数
  const organizeTasksIntoTree = useCallback((tasks: HierarchicalTask[]): HierarchicalTask[] => {
    // 親IDでタスクをグループ化
    const tasksByParent = tasks.reduce((acc, task) => {
      const parentId = task.parent_id || 'root';
      if (!acc[parentId]) {
        acc[parentId] = [];
      }
      acc[parentId].push(task);
      return acc;
    }, {} as Record<string | number, HierarchicalTask[]>);

    // ルートレベルのタスクを取得（parent_idがnullまたはundefinedのタスク）
    const rootTasks = tasks.filter(task => !task.parent_id);
    
    // 再帰的にツリーを構築
    const buildTree = (tasks: HierarchicalTask[], level: number = 0): HierarchicalTask[] => {
      return tasks.map(task => {
        const children = tasksByParent[task.id] || [];
        return {
          ...task,
          level,
          children: buildTree(children, level + 1)
        };
      });
    };

    // ルートタスクから開始
    const result = buildTree(rootTasks);
    
    // ツリー構造を配列に平坦化
    const flattenTree = (tasks: HierarchicalTask[]): HierarchicalTask[] => {
      return tasks.reduce((acc, task) => {
        acc.push(task);
        if (task.children?.length) {
          acc.push(...flattenTree(task.children));
        }
        return acc;
      }, [] as HierarchicalTask[]);
    };

    return flattenTree(result);
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
        title: 'しいタスク',
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
      
      // 削除されたタスクとその子タスクをローカルの状態から除外
      setHierarchicalTasks(prev => {
        // 削除対象のタスクIDを収集（削除対象のタスクとその子タスク）
        const deletedIds = new Set<number>();
        const collectIds = (id: number) => {
          deletedIds.add(id);
          prev.forEach(task => {
            if (task.parent_id === id) {
              collectIds(task.id);
            }
          });
        };
        collectIds(taskId);

        // 削除対象以外のタスクを保持
        const remainingTasks = prev.filter(task => !deletedIds.has(task.id));
        return organizeTasksIntoTree(remainingTasks);
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
  }, []); // 初回マウント時のみ実行

  // タブの可視性変更時にデータを再取得
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchTasks();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
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