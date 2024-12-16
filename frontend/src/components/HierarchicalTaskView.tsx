"use client";

import React, { useState, useEffect } from "react";
import { Task } from "@/types/task";
import { HierarchicalTask } from "@/types/hierarchicalTask";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useHierarchicalTasks } from "@/lib/hooks/useHierarchicalTasks";
import { HierarchicalTaskItem } from "./HierarchicalTaskItem";

interface HierarchicalTaskViewProps {
  tasks: Task[];
  onUpdate: () => void;
}

// ローカルストレージのキー
const COLLAPSED_TASKS_KEY = "hierarchical_tasks_collapsed_state";
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

  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(() => {
    try {
      const savedState = localStorage.getItem(COLLAPSED_TASKS_KEY);
      return savedState ? new Set(JSON.parse(savedState)) : new Set<number>();
    } catch (error) {
      console.error("Failed to load expanded state:", error);
      return new Set<number>();
    }
  });

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

  // タブ切り替え時データ保持
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
      // 最後のルートタスクをとして使用
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

      // 親タスクの後の子タスクの後に新しいタスクを配置
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

      // 編集モード有効化
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
        
        // 編集開始時のカーソル制御を setTimeout で延させる
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

  const handleIncreaseLevel = async (taskId: number) => {
    const task = hierarchicalTasks.find((t) => t.id === taskId);
    if (!task || task.level === 0) return;

    const prevTask = hierarchicalTasks.find((t, i) => 
      hierarchicalTasks[i + 1]?.id === taskId && t.level < task.level
    );
    if (!prevTask) return;

    await updateTask(taskId, {
      ...task,
      parent_id: prevTask.id,
      level: prevTask.level + 1,
    });
  };

  const handleDecreaseLevel = async (taskId: number) => {
    const task = hierarchicalTasks.find((t) => t.id === taskId);
    if (!task || task.level === 0) return;

    const parentTask = hierarchicalTasks.find((t) => t.id === task.parent_id);
    if (!parentTask) return;

    await updateTask(taskId, {
      ...task,
      parent_id: parentTask.parent_id,
      level: task.level - 1,
    });
  };

  const handleEditStart = (task: HierarchicalTask) => {
    setEditingTaskId(task.id);
    setEditingContent(task.title);
  };

  const handleAddSiblingTask = async (taskId: number) => {
    try {
      const task = hierarchicalTasks.find((t) => t.id === taskId);
      if (!task) return;

      // ルートレベルのタスクからの追加の場合は、子スクとして追加
      if (task.level === 0) {
        const newTask = await addTask(taskId, 1); // 親タスクのIDを���、レベルを1に設定
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
      // 親スクが折りたたまれている場合はスキップ
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

      // このタスクが折りたたまている場合、以降の子タスクを非表示にする
      if (!expandedTasks.has(task.id)) {
        isParentCollapsed = true;
        collapsedParentIds.add(task.id);
        currentLevel = task.level;
      }
    });

    return result;
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

  const handleAddToDaily = (task: HierarchicalTask) => {
    try {
      // 日本時間で現在の日付を取得
      const now = new Date();
      const jstOffset = 9 * 60; // JSTは+9時間
      now.setMinutes(now.getMinutes() + jstOffset);
      const today = now.toISOString().split('T')[0];
      const storageKey = `daily_tasks_${today}`;

      // 現在のデイ���ータスクを取得
      const storedTasks = localStorage.getItem(storageKey);
      const currentDailyTasks = storedTasks ? JSON.parse(storedTasks) : [];

      // タスクが既に存在するかチェック
      if (currentDailyTasks.some((t: any) => t.id === task.id)) {
        // タスクが存在する場合は削除
        const updatedTasks = currentDailyTasks.filter((t: any) => t.id !== task.id);
        localStorage.setItem(storageKey, JSON.stringify(updatedTasks));
        return;
      }

      // 新しいタスクを作成
      const taskForDaily = {
        id: task.id,
        title: task.title,
        description: task.description || "",
        status: task.is_completed ? "完了" : "未着手",
        priority: task.priority || 0,
        created_at: task.created_at,
        last_updated: now.toISOString(),
        parent_id: task.parent_id,
        motivation: 0,
        priority_score: 0,
        motivation_score: 0,
        order: currentDailyTasks.length,
        estimated_minutes: 30,
        hierarchy_path: [] as string[],
        is_completed: task.is_completed,
      };

      // 階層パスを構築
      let currentTask = task;
      const hierarchyPath: string[] = [];
      while (currentTask.parent_id) {
        const parentTask = hierarchicalTasks.find(t => t.id === currentTask.parent_id);
        if (parentTask) {
          hierarchyPath.unshift(parentTask.title);
          currentTask = parentTask;
        } else {
          break;
        }
      }
      taskForDaily.hierarchy_path = hierarchyPath;

      // タスクを追加して保存
      const updatedTasks = [...currentDailyTasks, taskForDaily];
      localStorage.setItem(storageKey, JSON.stringify(updatedTasks));
    } catch (error) {
      console.error("Failed to add/remove task to/from daily:", error);
      alert("タスクの追加/削除に失敗しました");
    }
  };

  // タスクが本日のタスクに追加されているかチェック
  const isTaskInDaily = (taskId: number): boolean => {
    try {
      const now = new Date();
      const jstOffset = 9 * 60;
      now.setMinutes(now.getMinutes() + jstOffset);
      const today = now.toISOString().split('T')[0];
      const storageKey = `daily_tasks_${today}`;

      const storedTasks = localStorage.getItem(storageKey);
      const currentDailyTasks = storedTasks ? JSON.parse(storedTasks) : [];

      return currentDailyTasks.some((t: any) => t.id === taskId);
    } catch (error) {
      console.error("Failed to check daily task status:", error);
      return false;
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
    <div className="w-full h-screen">
      <div className="bg-white h-full overflow-auto">
        <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-3 sticky top-0 bg-white z-10 px-4 pt-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-normal text-gray-700">
              階層型タスク
            </h2>
          </div>
          <button
            onClick={handleAddTask}
            className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 hover:border-gray-300 transition-colors duration-150"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            タスクを追加
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
              onAddSiblingTask={handleAddSiblingTask}
              onIncreaseLevel={handleIncreaseLevel}
              onDecreaseLevel={handleDecreaseLevel}
              isExpanded={expandedTasks.has(task.id)}
              expandedTasks={expandedTasks}
              isEditing={editingTaskId === task.id}
              editingContent={editingContent}
              onEditContentChange={setEditingContent}
              isInDailyTasks={isTaskInDaily(task.id)}
              onAddToDaily={() => handleAddToDaily(task)}
              onFocusToggle={() => {}}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
