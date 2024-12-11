'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Task } from '@/types/task';
import { HierarchicalTask } from '@/types/hierarchicalTask';
import { PlusIcon } from '@heroicons/react/24/outline';
import * as api from '@/lib/api';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { HierarchicalTaskItem } from './HierarchicalTaskItem';
import { DailyTaskScheduler, DailyTaskSchedulerRef } from './DailyTaskScheduler';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

interface HierarchicalTaskViewProps {
  tasks: Task[];
  onUpdate: () => void;
}

// ステータスの優先順位を定義
const statusOrder = {
  '進行中': 0,
  '未着手': 1,
  'on hold': 2,
  'casual': 3,
  'backlog': 4,
  '完了': 5
};

// ローカルストレージのキー
const COLLAPSED_TASKS_KEY = 'hierarchical_tasks_collapsed_state';

// パネルサイズを保存するためのキー
const PANEL_SIZES_KEY = 'hierarchical_task_panel_sizes';

export const HierarchicalTaskView: React.FC<HierarchicalTaskViewProps> = ({ tasks, onUpdate }) => {
  const [hierarchicalTasks, setHierarchicalTasks] = useState<HierarchicalTask[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const schedulerRef = useRef<DailyTaskSchedulerRef>(null);

  // 折りたたみ状態の初期化
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(() => {
    try {
      const savedState = localStorage.getItem(COLLAPSED_TASKS_KEY);
      return savedState ? new Set(JSON.parse(savedState)) : new Set<number>();
    } catch (error) {
      console.error('Failed to load expanded state:', error);
      return new Set<number>();
    }
  });

  // パネルサイズの状態を追加
  const [panelSizes, setPanelSizes] = useState<number[]>(() => {
    try {
      const savedSizes = localStorage.getItem(PANEL_SIZES_KEY);
      return savedSizes ? JSON.parse(savedSizes) : [70, 30];
    } catch (error) {
      console.error('Failed to load panel sizes:', error);
      return [70, 30];
    }
  });

  // 状態が変更されたら保存
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_TASKS_KEY, JSON.stringify(Array.from(expandedTasks)));
    } catch (error) {
      console.error('Failed to save expanded state:', error);
    }
  }, [expandedTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // タスクの取得とソート
  useEffect(() => {
    fetchTasks();
  }, [tasks]);

  const sortMainTasks = (mainTasks: HierarchicalTask[]): HierarchicalTask[] => {
    return [...mainTasks].sort((a, b) => {
      // まずステータスで並び替え
      const taskA = tasks.find(t => t.id === a.id);
      const taskB = tasks.find(t => t.id === b.id);
      const statusA = taskA?.status || '未着手';
      const statusB = taskB?.status || '未着手';
      
      // statusOrderに定義されているステータスの順序を使用
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
  };

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
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
      console.error('Failed to fetch tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // タスクをツリー構造に整理する関数
  const organizeTasksIntoTree = (tasks: HierarchicalTask[]): HierarchicalTask[] => {
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
  };

  // イベントハンドラー
  const handleToggleExpand = (taskId: number) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleAddTask = async () => {
    try {
      // 最後のタスクを取得
      const lastTask = hierarchicalTasks[hierarchicalTasks.length - 1];
      
      if (lastTask) {
        // 最後のタスクの子タスクとして追加
        const newTask = await api.createHierarchicalTask({
          title: '新しいタスク',
          is_completed: false,
          parent_id: lastTask.id,
          level: (lastTask.level || 0) + 1,
        });

        // 新しいタスクと親タスクを展開状態にする
        setExpandedTasks(prev => {
          const next = new Set(prev);
          next.add(newTask.id);
          next.add(lastTask.id);
          return next;
        });

        setHierarchicalTasks(prev => {
          const newTasks = [...prev, newTask];
          return organizeTasksIntoTree(newTasks);
        });
      } else {
        // タスクが一つもない場合は第一階層に追加
        const newTask = await api.createHierarchicalTask({
          title: '新しいタスク',
          is_completed: false,
          level: 0,
        });

        // 新しいタスクを展開状態にする
        setExpandedTasks(prev => {
          const next = new Set(prev);
          next.add(newTask.id);
          return next;
        });

        setHierarchicalTasks([newTask]);
      }
    } catch (error) {
      console.error('Failed to add task:', error);
    }
  };

  const handleEditStart = (task: HierarchicalTask) => {
    setEditingTaskId(task.id);
    setEditingContent(task.title);
  };

  const handleEditSave = async (taskId: number, content: string) => {
    try {
      const task = hierarchicalTasks.find(t => t.id === taskId);
      if (!task) return;

      const updatedTask = await api.updateHierarchicalTask(taskId, {
        ...task,
        title: content,
      });

      setHierarchicalTasks(prev => {
        const newTasks = prev.map(t => t.id === taskId ? updatedTask : t);
        return organizeTasksIntoTree(newTasks);
      });
      setEditingTaskId(null);
      setEditingContent('');
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      await api.deleteHierarchicalTask(taskId);
      setHierarchicalTasks(prev => {
        const newTasks = prev.filter(task => task.id !== taskId);
        return organizeTasksIntoTree(newTasks);
      });
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleToggleComplete = async (taskId: number) => {
    try {
      const task = hierarchicalTasks.find(t => t.id === taskId);
      if (!task) return;

      const updatedTask = await api.updateHierarchicalTask(taskId, {
        ...task,
        is_completed: !task.is_completed,
      });

      setHierarchicalTasks(prev => {
        const newTasks = prev.map(t => t.id === taskId ? updatedTask : t);
        return organizeTasksIntoTree(newTasks);
      });
    } catch (error) {
      console.error('Failed to update task completion:', error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = hierarchicalTasks.findIndex(t => t.id === active.id);
    const newIndex = hierarchicalTasks.findIndex(t => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newTasks = arrayMove(hierarchicalTasks, oldIndex, newIndex);
      setHierarchicalTasks(newTasks);
    }
  };

  // HierarchicalTaskをTaskに変換する関数を追加
  const convertToTask = (hTask: HierarchicalTask): Task => {
    const originalTask = tasks.find(t => t.id === hTask.id);
    return {
      ...(originalTask || {
        id: hTask.id,
        title: hTask.title,
        description: hTask.description || '',
        status: hTask.is_completed ? '完了' : '未着手',
        priority: 0,
        created_at: hTask.created_at,
        last_updated: hTask.updated_at,
        motivation: 0,
        priority_score: 0,
        motivation_score: 0,
      }),
      parent_id: hTask.parent_id,
    };
  };

  // DailyTaskSchedulerに渡す前にタスクを変換
  const handleAddToDaily = (task: HierarchicalTask) => {
    schedulerRef.current?.handleAddTask(convertToTask(task));
  };

  const isTaskInDaily = (taskId: number) => {
    return schedulerRef.current?.isTaskInDaily(taskId) || false;
  };

  const handleAddSiblingTask = async (siblingId: number) => {
    try {
      const siblingTask = hierarchicalTasks.find(t => t.id === siblingId);
      if (!siblingTask) return;

      // 前のタスクを親として追加（階層を下げる）
      const newTask = await api.createHierarchicalTask({
        title: '新しいタスク',
        is_completed: false,
        parent_id: siblingId,
        level: (siblingTask.level || 0) + 1,
      });

      // 新しいタスクと親タスクを展開状態にする
      setExpandedTasks(prev => {
        const next = new Set(prev);
        next.add(newTask.id);
        next.add(siblingId);
        return next;
      });

      setHierarchicalTasks(prev => {
        const newTasks = [...prev, newTask];
        return organizeTasksIntoTree(newTasks);
      });
    } catch (error) {
      console.error('Failed to add task:', error);
    }
  };

  const handleIncreaseLevel = async (taskId: number) => {
    try {
      const task = hierarchicalTasks.find(t => t.id === taskId);
      if (!task) return;

      // 同じレベルの前のタスクを探す
      const sameLevel = hierarchicalTasks.filter(t => t.level === task.level);
      const taskIndex = sameLevel.findIndex(t => t.id === taskId);
      if (taskIndex <= 0) return; // 前のタスクがない場合は階層を上げられない

      const newParentId = sameLevel[taskIndex - 1].id;
      const updatedTask = await api.updateHierarchicalTask(taskId, {
        ...task,
        parent_id: newParentId,
        level: task.level + 1,
      });

      setHierarchicalTasks(prev => {
        const newTasks = prev.map(t => t.id === taskId ? updatedTask : t);
        return organizeTasksIntoTree(newTasks);
      });
    } catch (error) {
      console.error('Failed to update task level:', error);
    }
  };

  const handleDecreaseLevel = async (taskId: number) => {
    try {
      const task = hierarchicalTasks.find(t => t.id === taskId);
      if (!task || !task.parent_id) return;

      const parentTask = hierarchicalTasks.find(t => t.id === task.parent_id);
      if (!parentTask) return;

      const updatedTask = await api.updateHierarchicalTask(taskId, {
        ...task,
        parent_id: parentTask.parent_id,
        level: task.level - 1,
      });

      setHierarchicalTasks(prev => {
        const newTasks = prev.map(t => t.id === taskId ? updatedTask : t);
        return organizeTasksIntoTree(newTasks);
      });
    } catch (error) {
      console.error('Failed to update task level:', error);
    }
  };

  // 表示するタスクをフィルタリング
  const getVisibleTasks = (tasks: HierarchicalTask[]): HierarchicalTask[] => {
    const result: HierarchicalTask[] = [];
    let currentLevel = 0;
    let isParentCollapsed = false;
    let collapsedParentIds = new Set<number>();

    tasks.forEach((task) => {
      // 親タスクが折りたたまれている場合はスキップ
      if (isParentCollapsed) {
        if (task.level <= currentLevel) {
          isParentCollapsed = false;
          collapsedParentIds = new Set(Array.from(collapsedParentIds).filter(id => {
            const parentTask = tasks.find(t => t.id === id);
            return parentTask && parentTask.level < task.level;
          }));
        } else {
          return;
        }
      }

      // 親タスクのいずれかが折りたたまれている場合はスキップ
      const parentId = task.parent_id;
      if (parentId && collapsedParentIds.has(parentId)) {
        return;
      }

      result.push(task);

      // このタスクが折りたたまれている場合、以降の子タスクを非表示にする
      if (!expandedTasks.has(task.id)) {
        isParentCollapsed = true;
        collapsedParentIds.add(task.id);
        currentLevel = task.level;
      }
    });

    return result;
  };

  // パネルサイズが変更されたときの処理を追加
  const handlePanelResize = (sizes: number[]) => {
    setPanelSizes(sizes);
    try {
      localStorage.setItem(PANEL_SIZES_KEY, JSON.stringify(sizes));
    } catch (error) {
      console.error('Failed to save panel sizes:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <PanelGroup 
        direction="horizontal" 
        onLayout={handlePanelResize}
      >
        <Panel 
          defaultSize={panelSizes[0]} 
          minSize={30}
        >
          <div className="bg-white">
            <div className="mb-4 flex items-center border-b border-gray-200 pb-3">
              <button
                onClick={() => handleAddTask()}
                className="mr-4 inline-flex items-center px-3 py-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 transition-colors duration-150"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                タスクを追加
              </button>
              <h2 className="text-lg font-normal text-gray-700">階層型タスク</h2>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={hierarchicalTasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-0 divide-y divide-gray-100">
                  {getVisibleTasks(hierarchicalTasks).map((task) => (
                    <HierarchicalTaskItem
                      key={task.id}
                      task={task}
                      onToggleExpand={handleToggleExpand}
                      onToggleComplete={handleToggleComplete}
                      onEditStart={handleEditStart}
                      onEditSave={handleEditSave}
                      onAddSubTask={handleAddTask}
                      onDeleteTask={handleDeleteTask}
                      onAddToDaily={handleAddToDaily}
                      onAddSiblingTask={handleAddSiblingTask}
                      onIncreaseLevel={handleIncreaseLevel}
                      onDecreaseLevel={handleDecreaseLevel}
                      isExpanded={expandedTasks.has(task.id)}
                      isEditing={editingTaskId === task.id}
                      editingContent={editingContent}
                      onEditContentChange={setEditingContent}
                      isInDailyTasks={isTaskInDaily(task.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </Panel>

        <PanelResizeHandle className="w-2 hover:bg-gray-200 transition-colors duration-200" />

        <Panel 
          defaultSize={panelSizes[1]} 
          minSize={20}
        >
          <DailyTaskScheduler
            ref={schedulerRef}
            tasks={hierarchicalTasks.map(convertToTask)}
            onUpdate={onUpdate}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}; 