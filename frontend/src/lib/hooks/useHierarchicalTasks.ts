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

// IndexedDB設定
const DB_NAME = 'hierarchical-tasks-db';
const STORE_NAME = 'task-orders';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

const initIndexedDB = async () => {
  if (dbInstance) return dbInstance;

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const getTaskOrder = async (taskId: number): Promise<number> => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(taskId);

      request.onerror = () => {
        console.error('Failed to get task order:', request.error);
        resolve(0); // エラー時はデフォルト値を返す
      };

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.order : 0);
      };
    });
  } catch (error) {
    console.error('Error in getTaskOrder:', error);
    return 0; // エラー時はデフォルト値を返す
  }
};

const setTaskOrder = async (taskId: number, order: number): Promise<void> => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ id: taskId, order });

      request.onerror = () => {
        console.error('Failed to set task order:', request.error);
        resolve(); // エラーを無視して続行
      };

      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error in setTaskOrder:', error);
    // エラーを無視して続行
  }
};

export const useHierarchicalTasks = (tasks: Task[]) => {
  const [hierarchicalTasks, setHierarchicalTasks] = useState<HierarchicalTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // タスクの取得とソート
  const sortMainTasks = useCallback(async (mainTasks: HierarchicalTask[]): Promise<HierarchicalTask[]> => {
    const tasksWithOrder = await Promise.all(
      mainTasks.map(async (task) => {
        const order = await getTaskOrder(task.id) || 0;
        return { ...task, order };
      })
    );

    return tasksWithOrder.sort((a, b) => {
      // まずステータスで並び替え
      const taskA = tasks.find(t => t.id === a.id);
      const taskB = tasks.find(t => t.id === b.id);
      const statusA = taskA?.status || '未着手';
      const statusB = taskB?.status || '未着手';
      
      const orderA = statusOrder[statusA as keyof typeof statusOrder] ?? 999;
      const orderB = statusOrder[statusB as keyof typeof statusOrder] ?? 999;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // 次に表示順序で並び替え
      if (a.order !== b.order) {
        return a.order - b.order;
      }

      // 最後に優先度で並び替え
      const priorityA = taskA?.priority || 0;
      const priorityB = taskB?.priority || 0;
      return priorityB - priorityA;
    });
  }, [tasks]);

  // タスクの移動時に表示順序を更新
  const updateTaskOrders = useCallback(async (taskId: number, newOrder: number) => {
    try {
      await setTaskOrder(taskId, newOrder);
    } catch (error) {
      console.error('Failed to update task order:', error);
    }
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

    // 各グループ内でソート
    Object.entries(tasksByParent).forEach(([parentId, group]) => {
      group.sort((a, b) => {
        // まずステータスで並び替え
        const taskA = tasks.find(t => t.id === a.id);
        const taskB = tasks.find(t => t.id === b.id);
        const statusA = taskA?.status || '未着手';
        const statusB = taskB?.status || '未着手';
        
        const orderA = statusOrder[statusA as keyof typeof statusOrder] ?? 999;
        const orderB = statusOrder[statusB as keyof typeof statusOrder] ?? 999;
        
        if (orderA !== orderB) {
          return orderA - orderB;
        }

        // ルートレベルのタスクは既存の並び順を維持
        if (parentId === 'root') {
          // position値で比較（nullやundefinedの場合は0として扱う）
          return (a.position || 0) - (b.position || 0);
        }

        // サブタスク以下はタスクIDの降順でソート
        return b.id - a.id;
      });
    });

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
  const fetchTasks = useCallback(async (silent: boolean = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }
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
        priority: task.priority,
        status: task.status,
        previous_status: task.previous_status
      }));

      // 第一階層のタスクをソート
      const sortedMainTasks = await sortMainTasks(mainTasks);
      
      // すべてのタ��クを組み合わせてツリー構造に整理（重複を防ぐ）
      const allTasks = Array.from(
        new Map([...sortedMainTasks, ...data].map(task => [task.id, task])).values()
      );

      // 現在の状態と新しい状態を比較
      const currentIds = new Set(hierarchicalTasks.map(t => t.id));
      const newIds = new Set(allTasks.map(t => t.id));
      const hasChanges = 
        allTasks.length !== hierarchicalTasks.length ||
        allTasks.some(task => {
          const currentTask = hierarchicalTasks.find(t => t.id === task.id);
          return !currentTask || 
                 currentTask.title !== task.title ||
                 currentTask.is_completed !== task.is_completed ||
                 currentTask.parent_id !== task.parent_id;
        });

      // 変更がある場合のみ状態を更新
      if (hasChanges) {
        setHierarchicalTasks(organizeTasksIntoTree(allTasks));
      }
    } catch (error) {
      if (!silent) {
        setError(error as Error);
      }
      console.error('Failed to fetch tasks:', error);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [tasks, sortMainTasks, organizeTasksIntoTree, hierarchicalTasks]);

  // タスクの追加
  const addTask = useCallback(async (parentId?: number, level: number = 0) => {
    try {
      // 同じ親を持つタスクの中で最大のposition値を取得
      const siblingTasks = hierarchicalTasks.filter(t => t.parent_id === parentId);
      const maxPosition = siblingTasks.reduce((max, task) => 
        Math.max(max, task.position || 0), 0);
      const newPosition = maxPosition + 1000; // 1000ずつ増やして余裕を持たせる

      // 仮のIDを生成
      const tempId = Date.now();
      const tempTask: HierarchicalTask = {
        id: tempId,
        title: '',
        is_completed: false,
        parent_id: parentId,
        level,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        position: newPosition,
      };

      // 楽観的更新
      setHierarchicalTasks(prev => {
        const newTasks = [...prev, tempTask];
        return organizeTasksIntoTree(newTasks);
      });

      // APIを呼び出し
      const newTask = await api.createHierarchicalTask({
        title: '',
        is_completed: false,
        parent_id: parentId,
        level,
        position: newPosition,
      });

      // 最終的な更新
      setHierarchicalTasks(prev => {
        const updatedTasks = prev.map(task => 
          task.id === tempId ? { ...newTask, position: newPosition } : task
        );
        return organizeTasksIntoTree(updatedTasks);
      });

      return { ...newTask, position: newPosition };
    } catch (error) {
      // エラー時は元の状態に戻す
      await fetchTasks();
      console.error('Failed to add task:', error);
      throw error;
    }
  }, [hierarchicalTasks, organizeTasksIntoTree, fetchTasks]);

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

      // 楽観的更新
      setHierarchicalTasks(prev => {
        const updatedTasks = prev.map(t => 
          t.id === taskId ? { ...t, ...updates } : t
        );
        return organizeTasksIntoTree(updatedTasks);
      });

      // APIに送信するデータを準備
      const apiUpdates = {
        title: updates.title ?? task.title,
        description: updates.description ?? task.description ?? '',
        is_completed: updates.is_completed ?? task.is_completed,
        parent_id: updates.parent_id,
        level: updates.level ?? task.level,
        deadline: updates.deadline,
        priority: updates.priority ?? task.priority ?? 0,
      };

      // APIを呼び出し
      const updatedTask = await api.updateHierarchicalTask(taskId, apiUpdates);

      // APIの結果で再更新（エラーがあった場合の修正のため）
      setHierarchicalTasks(prev => {
        const updatedTasks = prev.map(t => 
          t.id === taskId ? { ...t, ...updatedTask } : t
        );
        return organizeTasksIntoTree(updatedTasks);
      });

      return updatedTask;
    } catch (error) {
      // エラー時は元の状態に戻す
      await fetchTasks();
      console.error('Failed to update task:', error);
      throw error;
    }
  }, [hierarchicalTasks, organizeTasksIntoTree, fetchTasks]);

  // 初期データの取得
  useEffect(() => {
    fetchTasks();
  }, []); // 初回マウント時のみ実行

  // タブの可視性変更時にデータを再取得
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let lastFetchTime = 0;
    const FETCH_COOLDOWN = 2000; // 2秒のクールダウン

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const now = Date.now();
        if (now - lastFetchTime > FETCH_COOLDOWN) {
          timeoutId = setTimeout(async () => {
            await fetchTasks(true); // サイレントモードでフェッ
            lastFetchTime = Date.now();
          }, 500);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [fetchTasks]);

  // ドラッグ＆ドロップ時の���序更新
  const handleTaskMove = useCallback(async (taskId: number, targetIndex: number, newPosition?: number) => {
    try {
      if (newPosition !== undefined) {
        await updateTaskOrders(taskId, newPosition);
      } else {
        await updateTaskOrders(taskId, targetIndex * 1000); // 1000単位で順序を付与
      }

      // タスクの位置情報を更新
      const task = hierarchicalTasks.find(t => t.id === taskId);
      if (task && newPosition !== undefined) {
        await updateTask(taskId, {
          ...task,
          position: newPosition,
        });
      }
    } catch (error) {
      console.error('Failed to handle task move:', error);
    }
  }, [updateTaskOrders, hierarchicalTasks, updateTask]);

  return {
    hierarchicalTasks,
    isLoading,
    error,
    addTask,
    deleteTask,
    updateTask,
    fetchTasks,
    handleTaskMove,
  };
}; 