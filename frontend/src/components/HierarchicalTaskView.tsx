"use client";

import React, { useState, useEffect, useRef } from "react";
import { Task } from "@/types/task";
import { HierarchicalTask } from "@/types/hierarchicalTask";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useHierarchicalTasks } from "@/lib/hooks/useHierarchicalTasks";
import { HierarchicalTaskItem } from "./HierarchicalTaskItem";
import {
  DailyTaskScheduler,
  DailyTaskSchedulerRef,
} from "@/components/DailyTaskScheduler";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

interface HierarchicalTaskViewProps {
  tasks: Task[];
  onUpdate: () => void;
}

// ローカルストレージのキー
const COLLAPSED_TASKS_KEY = "hierarchical_tasks_collapsed_state";
const PANEL_SIZES_KEY = "hierarchical_task_panel_sizes";
const LAST_EDIT_STATE_KEY = "hierarchical_tasks_last_edit_state";

export const HierarchicalTaskView: React.FC<HierarchicalTaskViewProps> = ({
  tasks,
  onUpdate,
}) => {
  const [editingTaskId, setEditingTaskId] = useState<number | null>(() => {
    try {
      const savedState = localStorage.getItem(LAST_EDIT_STATE_KEY);
      return savedState ? JSON.parse(savedState).taskId : null;
    } catch {
      return null;
    }
  });

  const [editingContent, setEditingContent] = useState(() => {
    try {
      const savedState = localStorage.getItem(LAST_EDIT_STATE_KEY);
      return savedState ? JSON.parse(savedState).content : "";
    } catch {
      return "";
    }
  });

  const schedulerRef = useRef<DailyTaskSchedulerRef>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(() => {
    try {
      const savedState = localStorage.getItem(COLLAPSED_TASKS_KEY);
      return savedState ? new Set(JSON.parse(savedState)) : new Set<number>();
    } catch (error) {
      console.error("Failed to load expanded state:", error);
      return new Set<number>();
    }
  });

  // パネルサイズの状態を追加（初期値を50:50に設定）
  const DEFAULT_PANEL_SIZES = [50, 50];

  const [panelSizes, setPanelSizes] = useState<number[]>(() => {
    try {
      const savedSizes = localStorage.getItem(PANEL_SIZES_KEY);
      return savedSizes ? JSON.parse(savedSizes) : DEFAULT_PANEL_SIZES;
    } catch (error) {
      console.error("Failed to load panel sizes:", error);
      return DEFAULT_PANEL_SIZES;
    }
  });

  // 状態が変更されたら保存
  useEffect(() => {
    try {
      localStorage.setItem(
        COLLAPSED_TASKS_KEY,
        JSON.stringify(Array.from(expandedTasks))
      );
    } catch (error) {
      console.error("Failed to save expanded state:", error);
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
    handleTaskMove,
  } = useHierarchicalTasks(tasks);

  // タスクの取得とソート
  useEffect(() => {
    const initialFetch = async () => {
      await fetchTasks();
    };
    initialFetch();
  }, []);

  // 編集状態の保存
  useEffect(() => {
    if (editingTaskId !== null) {
      const input = document.querySelector(
        `input[data-task-id="${editingTaskId}"]`
      ) as HTMLInputElement;
      const cursorPosition = input?.selectionStart || 0;

      localStorage.setItem(
        LAST_EDIT_STATE_KEY,
        JSON.stringify({
          taskId: editingTaskId,
          content: editingContent,
          cursorPosition: cursorPosition
        })
      );
    }
  }, [editingTaskId, editingContent]);

  // タブ切り替え時のデータ保持
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        try {
          const savedState = localStorage.getItem(LAST_EDIT_STATE_KEY);
          if (savedState) {
            const { taskId, content } = JSON.parse(savedState);
            setEditingTaskId(taskId);
            setEditingContent(content);
          }
        } catch (error) {
          console.error("Failed to restore edit state:", error);
        }
      } else if (!document.hidden && editingTaskId !== null) {
        localStorage.setItem(
          LAST_EDIT_STATE_KEY,
          JSON.stringify({
            taskId: editingTaskId,
            content: editingContent,
          })
        );
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [editingTaskId, editingContent]);

  const handleEditSave = async (taskId: number, content: string) => {
    try {
      // タイトルが空の場合は保存せずに編集状態を維持
      if (!content.trim()) {
        return;
      }

      const task = hierarchicalTasks.find((t) => t.id === taskId);
      if (!task) return;

      // 現在のカーソル位置を保存
      const input = document.querySelector(
        `input[data-task-id="${taskId}"]`
      ) as HTMLInputElement;
      const cursorPosition = input?.selectionStart || 0;

      await updateTask(taskId, {
        ...task,
        title: content,
      });

      // 編集状態を維持
      setEditingContent(content);

      // カーソル位置を復元（次のレンダリングサイクルで）
      requestAnimationFrame(() => {
        const input = document.querySelector(
          `input[data-task-id="${taskId}"]`
        ) as HTMLInputElement;
        if (input) {
          input.focus();
          input.setSelectionRange(cursorPosition, cursorPosition);
        }
      });
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const handleAddTask = async () => {
    try {
      // 最後のルートタスクを親として使用
      const rootTasks = hierarchicalTasks.filter((t) => t.level === 0);
      const lastRootTask = rootTasks[rootTasks.length - 1];

      if (lastRootTask) {
        // 既存のルートタスクがある場合は、その子タスクとして追加
        const newTask = await addTask(lastRootTask.id, 1);
        setExpandedTasks((prev) => {
          const next = new Set(prev);
          next.add(lastRootTask.id);
          return next;
        });
        setEditingTaskId(newTask.id);
        setEditingContent(newTask.title);
      } else {
        // ルートタスクが1つもない場合は、新しいルートタスクを作成
        const newRootTask = await addTask(undefined, 0);
        const newSubTask = await addTask(newRootTask.id, 1);
        setExpandedTasks((prev) => {
          const next = new Set(prev);
          next.add(newRootTask.id);
          return next;
        });
        setEditingTaskId(newSubTask.id);
        setEditingContent(newSubTask.title);
      }
    } catch (error) {
      console.error("Failed to add task:", error);
    }
  };

  const handleAddSubTask = async (
    taskId: number
  ): Promise<HierarchicalTask> => {
    try {
      const parentTask = hierarchicalTasks.find((t) => t.id === taskId);
      if (!parentTask) throw new Error("Parent task not found");

      const newTask = await addTask(taskId, (parentTask.level || 0) + 1);

      // 親タスクの��後の子タスクの後に新しいタスクを配置
      const childTasks = hierarchicalTasks.filter(
        (t) => t.parent_id === taskId
      );
      const updatedTasks = [...hierarchicalTasks];
      const newTaskIndex = updatedTasks.findIndex((t) => t.id === newTask.id);
      if (newTaskIndex !== -1) {
        const taskToMove = updatedTasks.splice(newTaskIndex, 1)[0];
        const lastChildIndex =
          childTasks.length > 0
            ? updatedTasks.findIndex(
                (t) => t.id === childTasks[childTasks.length - 1].id
              ) + 1
            : updatedTasks.findIndex((t) => t.id === taskId) + 1;
        updatedTasks.splice(lastChildIndex, 0, taskToMove);
        await fetchTasks();
      }

      // 編集モードを有効化
      setEditingTaskId(newTask.id);
      setEditingContent(newTask.title);

      // 親タスクを展開
      setExpandedTasks((prev) => {
        const next = new Set(prev);
        next.add(taskId);
        return next;
      });

      return newTask;
    } catch (error) {
      console.error("Failed to add subtask:", error);
      throw error;
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      // 削除前に一つ上のタスクを特定
      const currentTaskIndex = hierarchicalTasks.findIndex(
        (t) => t.id === taskId
      );
      const previousTask =
        currentTaskIndex > 0 ? hierarchicalTasks[currentTaskIndex - 1] : null;

      await deleteTask(taskId);

      // 一つ上のタスクが存在する場合、そのタスクの編集モードを有効化
      if (previousTask) {
        setEditingTaskId(previousTask.id);
        setEditingContent(previousTask.title);
        
        // 編集開始時のカーソル制御を setTimeout で遅延させる
        setTimeout(() => {
          const input = document.querySelector(
            `input[data-task-id="${previousTask.id}"]`
          ) as HTMLInputElement;
          if (input) {
            input.focus();
            // カーソルは先頭に配置（必要に応じて変更可能）
            input.setSelectionRange(0, 0);
          }
        }, 100); // タイミングを少し遅らせる
      }
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const handleToggleComplete = async (taskId: number) => {
    try {
      const task = hierarchicalTasks.find((t) => t.id === taskId);
      if (!task) return;

      await updateTask(taskId, {
        ...task,
        is_completed: !task.is_completed,
        parent_id: task.parent_id,
        level: task.level,
      });
    } catch (error) {
      console.error("Failed to update task completion:", error);
    }
  };

  const handleAddSiblingTask = async (taskId: number) => {
    try {
      const task = hierarchicalTasks.find((t) => t.id === taskId);
      if (!task) return;

      // ルートレベルのタスクからの追加の場合は、子スクとして追加
      if (task.level === 0) {
        const newTask = await addTask(taskId, 1); // 親タスクのIDを指定し、レベルを1に設定
        setEditingTaskId(newTask.id);
        setEditingContent(newTask.title);

        // 親タスクを展開
        setExpandedTasks((prev) => {
          const next = new Set(prev);
          next.add(taskId);
          return next;
        });
      } else {
        // 通常の同階層追加
        const newTask = await addTask(task.parent_id, task.level);
        setEditingTaskId(newTask.id);
        setEditingContent(newTask.title);
      }
    } catch (error) {
      console.error("Failed to add sibling task:", error);
    }
  };

  // 表示するタスクをフィルタリング
  const getVisibleTasks = (tasks: HierarchicalTask[]): HierarchicalTask[] => {
    const result: HierarchicalTask[] = [];
    let currentLevel = 0;
    let isParentCollapsed = false;
    let collapsedParentIds = new Set<number>();

    tasks.forEach((task) => {
      // 親���スクが折りたたまれている場合はスキップ
      if (isParentCollapsed) {
        if (task.level <= currentLevel) {
          isParentCollapsed = false;
          collapsedParentIds = new Set(
            Array.from(collapsedParentIds).filter((id) => {
              const parentTask = tasks.find((t) => t.id === id);
              return parentTask && parentTask.level < task.level;
            })
          );
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

  // パネルサイズが変更されたときの処理を修正
  const handlePanelResize = (sizes: number[]) => {
    setPanelSizes(sizes);
    try {
      localStorage.setItem(PANEL_SIZES_KEY, JSON.stringify(sizes));
    } catch (error) {
      console.error("Failed to save panel sizes:", error);
    }
  };

  // HierarchicalTaskをTaskに変換する関数を追加
  const convertToTask = (hTask: HierarchicalTask): Task => {
    const originalTask = tasks.find((t) => t.id === hTask.id);
    return {
      ...(originalTask || {
        id: hTask.id,
        title: hTask.title,
        description: hTask.description || "",
        status: hTask.is_completed ? "完了" : "未着手",
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
    // 既に編集中の場合は何もしない
    if (editingTaskId === task.id) {
      return;
    }

    setEditingTaskId(task.id);
    setEditingContent(task.title);
    // カーソル制御はHierarchicalTaskItemのuseEffectに任せる
  };

  const handleIncreaseLevel = async (taskId: number) => {
    try {
      const task = hierarchicalTasks.find((t) => t.id === taskId);
      if (!task) return;

      // 同じレベルの前のタスクを探す
      const sameLevel = hierarchicalTasks.filter((t) => t.level === task.level);
      const taskIndex = sameLevel.findIndex((t) => t.id === taskId);
      if (taskIndex <= 0) return; // 前のタスクがない場合は階層を上げれない

      const newParentId = sameLevel[taskIndex - 1].id;
      await updateTask(taskId, {
        ...task,
        parent_id: newParentId,
        level: task.level + 1,
      });
    } catch (error) {
      console.error("Failed to update task level:", error);
    }
  };

  const handleDecreaseLevel = async (taskId: number) => {
    try {
      const task = hierarchicalTasks.find((t) => t.id === taskId);
      if (!task || !task.parent_id) return;

      const parentTask = hierarchicalTasks.find((t) => t.id === task.parent_id);
      if (!parentTask) return;

      await updateTask(taskId, {
        ...task,
        parent_id: parentTask.parent_id,
        level: task.level - 1,
      });
    } catch (error) {
      console.error("Failed to update task level:", error);
    }
  };

  // handleMoveTaskを追加
  const handleMoveTask = async (
    taskId: number,
    newParentId: number | undefined,
    newLevel: number
  ) => {
    try {
      const task = hierarchicalTasks.find((t) => t.id === taskId);
      if (!task) return;

      await updateTask(taskId, {
        ...task,
        parent_id: newParentId,
        level: newLevel,
      });

      await fetchTasks();
    } catch (error) {
      console.error("Failed to move task:", error);
    }
  };

  // タスクの展開状態を切り替える
  const handleToggleExpand = (taskId: number) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // 階層型タスクの表示/非表示の状態を管理
  const [showHierarchicalTasks, setShowHierarchicalTasks] = useState<boolean>(() => {
    try {
      const savedState = localStorage.getItem("show_hierarchical_tasks");
      return savedState ? JSON.parse(savedState) : true;
    } catch {
      return true;
    }
  });

  // 表示/非表示の状態が変更されたら保存
  useEffect(() => {
    try {
      localStorage.setItem("show_hierarchical_tasks", JSON.stringify(showHierarchicalTasks));
    } catch (error) {
      console.error("Failed to save hierarchical tasks visibility state:", error);
    }
  }, [showHierarchicalTasks]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen">
      <PanelGroup 
        direction="horizontal" 
        onLayout={handlePanelResize}
      >
        {showHierarchicalTasks && (
          <>
            <Panel 
              defaultSize={DEFAULT_PANEL_SIZES[0]}
              minSize={20}
            >
              <div className="bg-white h-full overflow-auto">
                <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-3 sticky top-0 bg-white z-10 px-4 pt-4">
                  <div className="flex items-center gap-4">
                    <h2 className="text-lg font-normal text-gray-700">
                      階層型タスク
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      // 現在のパネルサイズを保存してから非表示に
                      localStorage.setItem(PANEL_SIZES_KEY, JSON.stringify(panelSizes));
                      setShowHierarchicalTasks(false);
                    }}
                    className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 transition-colors duration-150"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                    階層を隠す
                  </button>
                </div>

                <div className="space-y-0 px-4">
                  {getVisibleTasks(hierarchicalTasks).map((task) => (
                    <HierarchicalTaskItem
                      key={task.id}
                      task={task}
                      allTasks={hierarchicalTasks}
                      onToggleExpand={() => handleToggleExpand(task.id)}
                      onToggleComplete={(taskId) => handleToggleComplete(taskId)}
                      onEditStart={(task) => handleEditStart(task)}
                      onEditSave={handleEditSave}
                      onAddSubTask={(taskId) => handleAddSubTask(taskId)}
                      onDeleteTask={handleDeleteTask}
                      onAddToDaily={handleAddToDaily}
                      onAddSiblingTask={handleAddSiblingTask}
                      onIncreaseLevel={handleIncreaseLevel}
                      onDecreaseLevel={handleDecreaseLevel}
                      isExpanded={expandedTasks.has(task.id)}
                      expandedTasks={expandedTasks}
                      isEditing={editingTaskId === task.id}
                      editingContent={editingContent}
                      onEditContentChange={setEditingContent}
                      isInDailyTasks={isTaskInDaily(task.id)}
                      onFocusToggle={() => {}}
                    />
                  ))}
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="w-2 hover:bg-gray-200 transition-colors duration-200" />
          </>
        )}

        <Panel 
          defaultSize={showHierarchicalTasks ? DEFAULT_PANEL_SIZES[1] : 100}
          minSize={30}
        >
          <div className="h-full overflow-auto">
            {!showHierarchicalTasks && (
              <button
                onClick={() => {
                  setShowHierarchicalTasks(true);
                  // 保存されていたパネルサイズを復元
                  const savedSizes = localStorage.getItem(PANEL_SIZES_KEY);
                  if (savedSizes) {
                    setPanelSizes(JSON.parse(savedSizes));
                  }
                  // リサイズハンドラが反転しないようにおまじない
                  fetchTasks();
                }}
                className="absolute top-2 left-2 inline-flex items-center px-3 py-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 transition-colors duration-150"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                階層を表示
              </button>
            )}
            <DailyTaskScheduler
              ref={schedulerRef}
              tasks={hierarchicalTasks.map(convertToTask)}
              onUpdate={async () => {
                await fetchTasks();
                onUpdate();
              }}
            />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
};
