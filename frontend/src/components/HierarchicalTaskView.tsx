'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Task } from '@/types/task';
import { HierarchicalTask } from '@/types/hierarchicalTask';
import { PlusIcon } from '@heroicons/react/24/outline';
import * as api from '@/lib/api';
import { useHierarchicalTasks } from '@/lib/hooks/useHierarchicalTasks';
import { HierarchicalTaskItem } from './HierarchicalTaskItem';
import { DailyTaskScheduler, DailyTaskSchedulerRef } from './DailyTaskScheduler';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

interface HierarchicalTaskViewProps {
  tasks: Task[];
  onUpdate: () => void;
}

// ローカルストレージのキー
const COLLAPSED_TASKS_KEY = 'hierarchical_tasks_collapsed_state';
const PANEL_SIZES_KEY = 'hierarchical_task_panel_sizes';

export const HierarchicalTaskView: React.FC<HierarchicalTaskViewProps> = ({ tasks, onUpdate }) => {
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const schedulerRef = useRef<DailyTaskSchedulerRef>(null);
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

  const {
    hierarchicalTasks,
    isLoading,
    error,
    addTask,
    deleteTask,
    updateTask,
    fetchTasks,
  } = useHierarchicalTasks(tasks);

  // タスクの取得とソート
  useEffect(() => {
    const initialFetch = async () => {
      await fetchTasks();
    };
    initialFetch();
  }, []);

  const handleAddTask = async () => {
    try {
      // 第一階層のタスクとして追加
      const newTask = await addTask(undefined, 0);

      // 新しいタスクを展開状態にする
      setExpandedTasks(prev => {
        const next = new Set(prev);
        next.add(newTask.id);
        return next;
      });
    } catch (error) {
      console.error('Failed to add task:', error);
    }
  };

  const handleAddSubTask = async (parentId: number) => {
    try {
      const parentTask = hierarchicalTasks.find(t => t.id === parentId);
      if (!parentTask) return;

      // 親タスクの子タスクとして追加
      const newTask = await addTask(parentId, (parentTask.level || 0) + 1);

      // 新しいタスクと親タスクを展開状態にする
      setExpandedTasks(prev => {
        const next = new Set(prev);
        next.add(newTask.id);
        next.add(parentId);
        return next;
      });
    } catch (error) {
      console.error('Failed to add subtask:', error);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      const task = hierarchicalTasks.find(t => t.id === taskId);
      await deleteTask(taskId);
      
      // 削除後に強制的にタスク一覧を再取得
      await fetchTasks();

      // 親タスクの展開状態を更新
      if (task?.parent_id) {
        setExpandedTasks(prev => {
          const next = new Set(prev);
          next.add(task.parent_id!);
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleToggleComplete = async (taskId: number) => {
    try {
      const task = hierarchicalTasks.find(t => t.id === taskId);
      if (!task) return;

      await updateTask(taskId, {
        is_completed: !task.is_completed,
      });
    } catch (error) {
      console.error('Failed to update task completion:', error);
    }
  };

  const handleAddSiblingTask = async (siblingId: number) => {
    try {
      const siblingTask = hierarchicalTasks.find(t => t.id === siblingId);
      if (!siblingTask) return;

      // 前のタスクを親として追加（階層を下げる）
      const newTask = await addTask(siblingId, (siblingTask.level || 0) + 1);

      // 新しいタスクと親タスクを展開状態にする
      setExpandedTasks(prev => {
        const next = new Set(prev);
        next.add(newTask.id);
        next.add(siblingId);
        return next;
      });
    } catch (error) {
      console.error('Failed to add task:', error);
    }
  };

  // 表示��るタスクをフィルタリング
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

  const handleEditStart = (task: HierarchicalTask) => {
    setEditingTaskId(task.id);
    setEditingContent(task.title);
  };

  const handleEditSave = async (taskId: number, content: string) => {
    try {
      const task = hierarchicalTasks.find(t => t.id === taskId);
      if (!task) return;

      await updateTask(taskId, {
        ...task,
        title: content,
      });

      setEditingTaskId(null);
      setEditingContent('');
    } catch (error) {
      console.error('Failed to update task:', error);
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
      await updateTask(taskId, {
        ...task,
        parent_id: newParentId,
        level: task.level + 1,
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

      await updateTask(taskId, {
        ...task,
        parent_id: parentTask.parent_id,
        level: task.level - 1,
      });
    } catch (error) {
      console.error('Failed to update task level:', error);
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

            <div className="space-y-0 divide-y divide-gray-100">
              {getVisibleTasks(hierarchicalTasks).map((task) => (
                <HierarchicalTaskItem
                  key={task.id}
                  task={task}
                  onToggleExpand={() => {
                    setExpandedTasks(prev => {
                      const next = new Set(prev);
                      if (next.has(task.id)) {
                        next.delete(task.id);
                      } else {
                        next.add(task.id);
                      }
                      return next;
                    });
                  }}
                  onToggleComplete={handleToggleComplete}
                  onEditStart={handleEditStart}
                  onEditSave={handleEditSave}
                  onAddSubTask={handleAddSubTask}
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