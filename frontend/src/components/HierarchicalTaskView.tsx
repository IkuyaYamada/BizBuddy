"use client";

import React, { useState, useEffect, useRef } from "react";
import { Task } from "@/types/task";
import { HierarchicalTask } from "@/types/hierarchicalTask";
import { PlusIcon } from "@heroicons/react/24/outline";
import * as api from "@/lib/api";
import { useHierarchicalTasks } from "@/lib/hooks/useHierarchicalTasks";
import { HierarchicalTaskItem } from "./HierarchicalTaskItem";
import {
  DailyTaskScheduler,
  DailyTaskSchedulerRef,
} from "./DailyTaskScheduler";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

interface HierarchicalTaskViewProps {
  tasks: Task[];
  onUpdate: () => void;
}

// ローカルストレージのキー
const COLLAPSED_TASKS_KEY = "hierarchical_tasks_collapsed_state";
const PANEL_SIZES_KEY = "hierarchical_task_panel_sizes";
const LAST_EDIT_STATE_KEY = "hierarchical_tasks_last_edit_state";

// サブタスクを含むすべての子タスクのIDを取得する関数を追加
const getAllChildTaskIds = (
  taskId: number,
  tasks: HierarchicalTask[]
): number[] => {
  const childIds: number[] = [];
  const collectIds = (id: number) => {
    const children = tasks.filter((t) => t.parent_id === id);
    children.forEach((child) => {
      childIds.push(child.id);
      collectIds(child.id);
    });
  };
  collectIds(taskId);
  return childIds;
};

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
  const [editingContent, setEditingContent] = useState("");
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
  const [activeId, setActiveId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);

  // パネルサイズの状態を追加
  const [panelSizes, setPanelSizes] = useState<number[]>(() => {
    try {
      const savedSizes = localStorage.getItem(PANEL_SIZES_KEY);
      return savedSizes ? JSON.parse(savedSizes) : [70, 30];
    } catch (error) {
      console.error("Failed to load panel sizes:", error);
      return [70, 30];
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
      localStorage.setItem(
        LAST_EDIT_STATE_KEY,
        JSON.stringify({
          taskId: editingTaskId,
          content: editingContent,
        })
      );
    }
  }, [editingTaskId, editingContent]);

  const handleEditSave = async (taskId: number, content: string) => {
    try {
      // タイトルが空の場合は保存せずに編集状態を維持
      if (!content.trim()) {
        return;
      }

      const task = hierarchicalTasks.find((t) => t.id === taskId);
      if (!task) return;

      await updateTask(taskId, {
        ...task,
        title: content,
      });

      setEditingTaskId(null);
      setEditingContent("");
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  // タブ切り替え時のデータ保持
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // 画面がアクティブになってから少し待ってからデータを更新
        timeoutId = setTimeout(async () => {
          //await fetchTasks();
          // データ更新後、保存されていた編集状態を復元
          const savedState = localStorage.getItem(LAST_EDIT_STATE_KEY);
          if (savedState) {
            const { taskId, content } = JSON.parse(savedState);
            const task = hierarchicalTasks.find((t) => t.id === taskId);
            if (task) {
              setEditingTaskId(task.id);
              setEditingContent(content || task.title);
              // 次のレンダリングサイクルでカーソルを末尾に移動
              // setTimeout(() => {
              //   const input = document.querySelector(`input[data-task-id="${task.id}"]`) as HTMLInputElement;
              //   if (input) {
              //     input.focus();
              //     const cursorPos = content ? content.length : task.title.length;
              //     input.setSelectionRange(cursorPos, cursorPos);
              //   }
              // }, 0);
            }
          }
        }, 1000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);
    console.log("handleVisibilityChangeが発動");

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [fetchTasks, hierarchicalTasks]);

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
        // ルートタスクが1つもな��場合は、新しいルートタスクを作成
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

      // 親タスクの最後の子タスクの後に新しいタスクを配置
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

      // ルートレベルのタスクからの追加の場合は、子タスクとして追加
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
      // 親タスクが折りたたまれている場合はスキップ
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

  // パネルサイズが変更されたときの処理を追加
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
    setEditingTaskId(task.id);
    setEditingContent(task.title);

    // 次のレンダリングサイクルでカーソルを末尾に移動
    setTimeout(() => {
      const input = document.querySelector(
        `input[data-task-id="${task.id}"]`
      ) as HTMLInputElement;
      if (input) {
        input.focus();
        input.setSelectionRange(task.title.length, task.title.length);
      }
    }, 0);
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

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    task: HierarchicalTask
  ) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleEditSave(task.id, editingContent);
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Tab: レベルを下げる
        handleDecreaseLevel(task.id);
      } else {
        // Tab: レベルを上げる
        handleIncreaseLevel(task.id);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleEditStart(task); // 編集をキャンセルして元の値に戻す
    }
  };

  // handleMoveTask関数を追加
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <PanelGroup direction="horizontal" onLayout={handlePanelResize}>
        <Panel defaultSize={panelSizes[0]} minSize={30}>
          <div className="bg-white">
            <div className="mb-4 flex items-center border-b border-gray-200 pb-3">
              <button
                onClick={() => handleAddTask()}
                className="mr-4 inline-flex items-center px-3 py-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 transition-colors duration-150"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                タスクを追加
              </button>
              <h2 className="text-lg font-normal text-gray-700">
                階層型タスク
              </h2>
            </div>

            <div className="space-y-0">
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

            {/* デバッグ情報 */}
            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                デバッグ情報: APIから取得した全タスク
              </h3>
              <div className="space-y-1 text-xs text-gray-600">
                {hierarchicalTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2">
                    <span className="font-mono">ID: {task.id}</span>
                    <span>|</span>
                    <span>Title: {task.title}</span>
                    <span>|</span>
                    <span>Level: {task.level}</span>
                    <span>|</span>
                    <span>Parent: {task.parent_id || "none"}</span>
                    <span>|</span>
                    <span>Position: {task.position}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-2 hover:bg-gray-200 transition-colors duration-200" />

        <Panel defaultSize={panelSizes[1]} minSize={20}>
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
