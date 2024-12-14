"use client";

import React, { useRef, useEffect, useState } from "react";
import { HierarchicalTask } from "@/types/hierarchicalTask";
import { ChevronRightIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

interface HierarchicalTaskItemProps {
  task: HierarchicalTask;
  allTasks: HierarchicalTask[];
  onToggleExpand: () => void;
  onToggleComplete: (taskId: number) => void;
  onEditStart: (task: HierarchicalTask) => void;
  onEditSave: (taskId: number, content: string) => void;
  onAddSubTask: (taskId: number) => void;
  onDeleteTask: (taskId: number) => void;
  onAddToDaily: (task: HierarchicalTask) => void;
  onAddSiblingTask: (taskId: number) => void;
  onIncreaseLevel: (taskId: number) => void;
  onDecreaseLevel: (taskId: number) => void;
  isExpanded: boolean;
  expandedTasks: Set<number>;
  isEditing: boolean;
  editingContent: string;
  onEditContentChange: (content: string) => void;
  isInDailyTasks: boolean;
  isFocused?: boolean;
  onFocusToggle: () => void;
}

// 進捗率計算用のヘルパー関数を追加
const calculateProgress = (
  task: HierarchicalTask,
  allTasks: HierarchicalTask[]
): { completed: number; total: number } => {
  const childTasks = allTasks.filter((t) => t.parent_id === task.id);
  if (childTasks.length === 0) {
    return { completed: 0, total: 0 };
  }

  let totalCompleted = 0;
  let totalTasks = childTasks.length;

  childTasks.forEach((childTask) => {
    if (childTask.is_completed) {
      totalCompleted++;
    }
  });

  return { completed: totalCompleted, total: totalTasks };
};

export const HierarchicalTaskItem: React.FC<HierarchicalTaskItemProps> = ({
  task,
  allTasks,
  onToggleExpand,
  onToggleComplete,
  onEditStart,
  onEditSave,
  onAddSubTask,
  onDeleteTask,
  onAddToDaily,
  onAddSiblingTask,
  onIncreaseLevel,
  onDecreaseLevel,
  isExpanded,
  expandedTasks,
  isEditing,
  editingContent,
  onEditContentChange,
  isInDailyTasks,
  isFocused = false,
  onFocusToggle,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [canDelete, setCanDelete] = useState(true);
  const deleteTimeoutRef = useRef<NodeJS.Timeout>();
  const [deleteConfirmState, setDeleteConfirmState] = useState<
    "initial" | "confirming"
  >("initial");
  const deleteConfirmTimeoutRef = useRef<NodeJS.Timeout>();
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [targetTime] = useState(25 * 60); // 25分
  const timerRef = useRef<NodeJS.Timeout>();
  const [isComposing, setIsComposing] = useState(false);
  const [focusedMemo, setFocusedMemo] = useState("");
  const memoInputRef = useRef<HTMLTextAreaElement>(null);

  // 作業ログを保存する関数
  const saveWorkLog = async (description: string) => {
    try {
      const response = await fetch(`http://localhost:8000/tasks/${task.id}/work-logs/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description,
          started_at: new Date().toISOString(),
          task_id: task.id,
        }),
      });

      if (response.ok) {
        setFocusedMemo(""); // メモをクリア
        if (memoInputRef.current) {
          memoInputRef.current.style.height = "auto"; // 高さをリセット
        }
      }
    } catch (error) {
      console.error('Error saving work log:', error);
    }
  };

  // メモの高さを自動調整する関数
  const adjustMemoHeight = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  // テキストエリアの高さを自動調整する関数
  const adjustTextareaHeight = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  // フォーカスモードの変更を監視
  useEffect(() => {
    if (isFocused) {
      // フォーカスモードが有効になったら自動的にタイマーを開始
      if (!isTimerRunning) {
        timerRef.current = setInterval(() => {
          setTimeElapsed((prev) => {
            if (prev >= targetTime) {
              if (timerRef.current) {
                clearInterval(timerRef.current);
              }
              setIsTimerRunning(false);
              return targetTime;
            }
            return prev + 1;
          });
        }, 1000);
        setIsTimerRunning(true);
      }
    } else {
      // フォーカスモードが解除されたらタイマーをリセット
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setIsTimerRunning(false);
      setTimeElapsed(0);
    }
  }, [isFocused]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
      if (deleteConfirmTimeoutRef.current) {
        clearTimeout(deleteConfirmTimeoutRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // 編集モード開始時のカーソル制御を修正
  useEffect(() => {
    if (isEditing && inputRef.current) {
      // 新規編集開始時のみカーソルを末尾に移動
      const isNewEdit = document.activeElement !== inputRef.current;
      
      inputRef.current.focus();
      if (isNewEdit) {
        const length = editingContent.length;
        inputRef.current.setSelectionRange(length, length);
      }
      adjustTextareaHeight();
    }
  }, [isEditing]);

  // タイマーの開始/停止
  const toggleTimer = () => {
    if (isTimerRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setIsTimerRunning(false);
    } else {
      timerRef.current = setInterval(() => {
        setTimeElapsed((prev) => {
          if (prev >= targetTime) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            setIsTimerRunning(false);
            return targetTime;
          }
          return prev + 1;
        });
      }, 1000);
      setIsTimerRunning(true);
    }
  };

  // 時間のフォーマット
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposing) return;

    if (e.key === "Enter") {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        if (task.title !== editingContent) {
          await onEditSave(task.id, editingContent);
        }
        // メモとして保存
        if (editingContent.trim()) {
          try {
            const response = await fetch(`http://localhost:8000/tasks/${task.id}/work-logs/`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                description: editingContent,
                started_at: new Date().toISOString(),
                task_id: task.id,
              }),
            });

            if (response.ok) {
              // メモを保存した後、入力欄をクリア
              onEditContentChange("");
              if (inputRef.current) {
                inputRef.current.style.height = "auto";
              }
            }
          } catch (error) {
            console.error('Error saving work log:', error);
          }
        }
      } else {
        if (task.level > 0 && task.title !== editingContent) {
          await onEditSave(task.id, editingContent);
        }
        if (editingContent.trim()) {
          onAddSubTask(task.id);
        }
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        onDecreaseLevel(task.id);
      } else {
        onIncreaseLevel(task.id);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onEditStart(task);
    } else if (e.key === "Backspace" && editingContent === "") {
      e.preventDefault();
      if (canDelete) {
        onDeleteTask(task.id);
        setCanDelete(false);
        deleteTimeoutRef.current = setTimeout(() => {
          setCanDelete(true);
        }, 500);
      }
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();

      const getVisibleTaskIds = (tasks: HierarchicalTask[]): number[] => {
        const result: number[] = [];
        const processTask = (taskId: number) => {
          result.push(taskId);
          if (expandedTasks.has(taskId)) {
            const children = tasks.filter((t) => t.parent_id === taskId);
            children.forEach((child) => processTask(child.id));
          }
        };

        const rootTasks = tasks.filter((t) => !t.parent_id);
        rootTasks.forEach((rootTask) => processTask(rootTask.id));
        return result;
      };

      const visibleTaskIds = getVisibleTaskIds(allTasks);
      const currentIndex = visibleTaskIds.indexOf(task.id);

      // 現在の編集内容を保存
      if (editingContent.trim() !== task.title) {
        await onEditSave(task.id, editingContent);
      }

      if (e.key === "ArrowUp" && currentIndex > 0) {
        const prevTaskId = visibleTaskIds[currentIndex - 1];
        const prevTask = allTasks.find((t) => t.id === prevTaskId);
        if (prevTask) {
          onEditStart(prevTask);
        }
      } else if (e.key === "ArrowDown" && currentIndex < visibleTaskIds.length - 1) {
        const nextTaskId = visibleTaskIds[currentIndex + 1];
        const nextTask = allTasks.find((t) => t.id === nextTaskId);
        if (nextTask) {
          onEditStart(nextTask);
        }
      }
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Backspace") {
      setCanDelete(true);
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    }
  };

  const handleDeleteClick = () => {
    if (deleteConfirmState === "initial") {
      setDeleteConfirmState("confirming");
      deleteConfirmTimeoutRef.current = setTimeout(() => {
        setDeleteConfirmState("initial");
      }, 2000); // 2秒後��リセット
    } else {
      onDeleteTask(task.id);
      setDeleteConfirmState("initial");
    }
  };

  // 進捗率の計算
  const progress = calculateProgress(task, allTasks);
  const hasSubtasks = progress.total > 0;
  const progressPercentage = hasSubtasks
    ? (progress.completed / progress.total) * 100
    : 0;

  // 表示モードと編集モードのスタイルを統一
  const commonTextStyle = `text-base ${
    task.is_completed ? "text-green-600 line-through" : "text-gray-600"
  }`;

  // フォーカスモード用のスタイルを定義
  const focusedStyles = isFocused
    ? {
        transform: "scale(1.02)",
        boxShadow: "0 0 20px rgba(59, 130, 246, 0.1)",
        background: "white",
        zIndex: 20,
      }
    : {};

  return (
    <div
      className={`flex items-start gap-2 py-1 px-2 transition-all duration-300 ${
        isFocused
          ? "rounded-lg border border-blue-100 hover:bg-blue-50/30"
          : "hover:bg-gray-50"
      }`}
      style={{
        ...focusedStyles,
        marginLeft: `${task.level * 1.5}rem`,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className={`flex items-center gap-1.5 ${isFocused ? "py-2" : ""}`}>
          <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
            {allTasks.some((t) => t.parent_id === task.id) ? (
              <button
                onClick={onToggleExpand}
                className="p-0.5 rounded hover:bg-gray-200 text-gray-400"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRightIcon className="w-3.5 h-3.5" />
                )}
              </button>
            ) : null}
          </div>
          <button
            onClick={() => onToggleComplete(task.id)}
            className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
              task.is_completed
                ? "bg-gray-100 text-gray-400"
                : "bg-gray-50 text-gray-300 hover:bg-gray-100 hover:text-gray-400"
            }`}
            title={task.is_completed ? "完了を取り消す" : "完了にする"}
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <textarea
                ref={inputRef}
                value={editingContent}
                data-task-id={task.id}
                onChange={(e) => {
                  onEditContentChange(e.target.value);
                  adjustTextareaHeight();
                }}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                onBlur={() => {
                  if (editingContent.trim() !== task.title) {
                    onEditSave(task.id, editingContent);
                  }
                }}
                className={`w-full bg-transparent border-none focus:ring-0 px-0 py-0.5 ${commonTextStyle} outline-none whitespace-pre-wrap break-words resize-none overflow-hidden leading-snug min-h-[22px]`}
                style={{
                  fontSize: "inherit",
                  lineHeight: "1.375rem",
                  margin: "1px 0",
                }}
                rows={1}
              />
            ) : (
              <button
                onClick={() => onEditStart(task)}
                className={`w-full text-left whitespace-pre-wrap break-words ${commonTextStyle} py-0.5 leading-snug min-h-[22px]`}
                style={{
                  margin: "1px 0",
                  lineHeight: "1.375rem",
                }}
              >
                {task.title}
              </button>
            )}
          </div>
          {task.level === 0 && task.status && (
            <span
              className={`flex-shrink-0 text-xs px-2 py-0.5 rounded ${
                task.status === "完了"
                  ? "bg-green-100 text-green-800"
                  : task.status === "進行中"
                  ? "bg-blue-100 text-blue-800"
                  : task.status === "on hold"
                  ? "bg-yellow-100 text-yellow-800"
                  : task.status === "casual"
                  ? "bg-purple-100 text-purple-800"
                  : task.status === "backlog"
                  ? "bg-gray-100 text-gray-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {task.status}
            </span>
          )}
          {hasSubtasks && (
            <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">
              {progress.completed}/{progress.total}
            </span>
          )}
          <button
            onClick={() => onAddToDaily(task)}
            className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-all duration-200 ${
              isInDailyTasks
                ? "bg-blue-100 text-blue-500 hover:bg-blue-200"
                : "text-gray-400 hover:bg-gray-200"
            }`}
            title={
              isInDailyTasks ? "本日のタスクから削除" : "本日のタスクに追加"
            }
          >
            <svg
              className={`w-3.5 h-3.5 ${
                isInDailyTasks
                  ? "fill-blue-100 stroke-blue-500"
                  : "fill-none stroke-current"
              }`}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>
          <button
            onClick={handleDeleteClick}
            className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 ${
              deleteConfirmState === "confirming"
                ? "text-red-500"
                : "text-gray-400"
            }`}
            title={
              deleteConfirmState === "confirming"
                ? "もう一度クリックで削除"
                : "削除"
            }
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
          {isFocused && (
            <div className="ml-2 flex items-center gap-2">
              <div className="text-sm text-gray-600">
                {formatTime(timeElapsed)} / {formatTime(targetTime)}
              </div>
              <button
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  isTimerRunning
                    ? "bg-gray-500 text-white hover:bg-gray-600"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
                onClick={toggleTimer}
              >
                {isTimerRunning ? "一時停止" : "開始"}
              </button>
              <textarea
                ref={memoInputRef}
                value={focusedMemo}
                onChange={(e) => {
                  setFocusedMemo(e.target.value);
                  adjustMemoHeight(e.target);
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !isComposing) {
                    e.preventDefault();
                    if (focusedMemo.trim()) {
                      saveWorkLog(focusedMemo);
                    }
                  }
                }}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder="メモを入力... (Ctrl+Enter で保存)"
                className="flex-1 min-h-[2rem] p-2 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none ml-2"
              />
            </div>
          )}
        </div>
        {isFocused && (
          <>
            <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-1000"
                style={{ width: `${(timeElapsed / targetTime) * 100}%` }}
              />
            </div>
            {task.description && (
              <div className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">
                {task.description}
              </div>
            )}
            <div className="mt-4">
              <textarea
                ref={memoInputRef}
                value={focusedMemo}
                onChange={(e) => {
                  setFocusedMemo(e.target.value);
                  adjustMemoHeight(e.target);
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !isComposing) {
                    e.preventDefault();
                    if (focusedMemo.trim()) {
                      saveWorkLog(focusedMemo);
                    }
                  }
                }}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder="メモを入力... (Ctrl+Enter で保存)"
                className="w-full min-h-[4rem] p-2 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
