'use client';

import React, { useRef, useEffect, useState } from 'react';
import { HierarchicalTask } from '@/types/hierarchicalTask';
import { ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

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
}

// 進捗率計算用のヘルパー関数を追加
const calculateProgress = (task: HierarchicalTask, allTasks: HierarchicalTask[]): { completed: number; total: number } => {
  const childTasks = allTasks.filter(t => t.parent_id === task.id);
  if (childTasks.length === 0) {
    return { completed: 0, total: 0 };
  }

  let totalCompleted = 0;
  let totalTasks = childTasks.length;

  childTasks.forEach(childTask => {
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
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [canDelete, setCanDelete] = useState(true);
  const deleteTimeoutRef = useRef<NodeJS.Timeout>();
  const [deleteConfirmState, setDeleteConfirmState] = useState<'initial' | 'confirming'>('initial');
  const deleteConfirmTimeoutRef = useRef<NodeJS.Timeout>();

  // テキストエリアの高さを自動調整する関数
  const adjustTextareaHeight = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
      if (deleteConfirmTimeoutRef.current) {
        clearTimeout(deleteConfirmTimeoutRef.current);
      }
    };
  }, []);

  // 編集モード開始時にカーソルを最後に移動
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      const length = editingContent.length;
      inputRef.current.setSelectionRange(length, length);
      adjustTextareaHeight();
    }
  }, [isEditing, editingContent]);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        if (task.title !== editingContent) {
          await onEditSave(task.id, editingContent);
        }
      } else {
        if (task.level > 0 && task.title !== editingContent) {
          await onEditSave(task.id, editingContent);
        }
        if (editingContent.trim()) {
          onAddSubTask(task.id);
        } else {
          onEditContentChange('\n');
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        onDecreaseLevel(task.id);
      } else {
        onIncreaseLevel(task.id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEditStart(task);
    } else if (e.key === 'Backspace' && editingContent === '' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      
      if (canDelete) {
        onDeleteTask(task.id);
        setCanDelete(false);
        
        deleteTimeoutRef.current = setTimeout(() => {
          setCanDelete(true);
        }, 500);
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();

      const getVisibleTaskIds = (tasks: HierarchicalTask[]): number[] => {
        const result: number[] = [];
        const processTask = (taskId: number) => {
          result.push(taskId);
          if (expandedTasks.has(taskId)) {
            const children = tasks.filter(t => t.parent_id === taskId);
            children.forEach(child => processTask(child.id));
          }
        };

        const rootTasks = tasks.filter(t => !t.parent_id);
        rootTasks.forEach(rootTask => processTask(rootTask.id));
        return result;
      };

      const visibleTaskIds = getVisibleTaskIds(allTasks);
      const currentIndex = visibleTaskIds.indexOf(task.id);

      // 現在の編集内容を保存
      if (editingContent.trim() !== task.title) {
        await onEditSave(task.id, editingContent);
      }

      if (e.key === 'ArrowUp' && currentIndex > 0) {
        const prevTaskId = visibleTaskIds[currentIndex - 1];
        const prevTask = allTasks.find(t => t.id === prevTaskId);
        if (prevTask) {
          onEditStart(prevTask);
          setTimeout(() => {
            const textarea = document.querySelector(`textarea[data-task-id="${prevTask.id}"]`) as HTMLTextAreaElement;
            if (textarea) {
              textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            }
          }, 0);
        }
      } else if (e.key === 'ArrowDown' && currentIndex < visibleTaskIds.length - 1) {
        const nextTaskId = visibleTaskIds[currentIndex + 1];
        const nextTask = allTasks.find(t => t.id === nextTaskId);
        if (nextTask) {
          onEditStart(nextTask);
          setTimeout(() => {
            const textarea = document.querySelector(`textarea[data-task-id="${nextTask.id}"]`) as HTMLTextAreaElement;
            if (textarea) {
              textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            }
          }, 0);
        }
      }
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Backspace') {
      setCanDelete(true);
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    }
  };

  const handleDeleteClick = () => {
    if (deleteConfirmState === 'initial') {
      setDeleteConfirmState('confirming');
      deleteConfirmTimeoutRef.current = setTimeout(() => {
        setDeleteConfirmState('initial');
      }, 2000); // 2秒後にリセット
    } else {
      onDeleteTask(task.id);
      setDeleteConfirmState('initial');
    }
  };

  // 進捗率の計算
  const progress = calculateProgress(task, allTasks);
  const hasSubtasks = progress.total > 0;
  const progressPercentage = hasSubtasks ? (progress.completed / progress.total) * 100 : 0;

  // 表示モードと編集モードのスタイルを統一
  const commonTextStyle = `text-base ${
    task.is_completed ? 'text-green-600 line-through' : 'text-gray-600'
  }`;

  return (
    <div className="flex items-start gap-2 py-1 px-2 transition-colors duration-150 hover:bg-gray-50">
      {task.level === 0 && (
        <div className="flex-shrink-0 w-4">
          {allTasks.some(t => t.parent_id === task.id) ? (
            <button
              onClick={onToggleExpand}
              className="mt-0.5 p-0.5 rounded hover:bg-gray-200 text-gray-400"
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-3.5 h-3.5" />
              ) : (
                <ChevronRightIcon className="w-3.5 h-3.5" />
              )}
            </button>
          ) : null}
        </div>
      )}

      <div
        className="flex-1 min-w-0"
        style={{
          marginLeft: `${task.level * 1.5}rem`,
        }}
      >
        <div className="flex items-center gap-1.5">
          {task.level > 0 && (
            <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
              {allTasks.some(t => t.parent_id === task.id) ? (
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
          )}
          <button
            onClick={() => onToggleComplete(task.id)}
            className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
              task.is_completed
                ? 'bg-gray-100 text-gray-400'
                : 'bg-gray-50 text-gray-300 hover:bg-gray-100 hover:text-gray-400'
            }`}
            title={task.is_completed ? "完了を取り消す" : "完了にする"}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
                onBlur={() => {
                  if (editingContent.trim() !== task.title) {
                    onEditSave(task.id, editingContent);
                  }
                }}
                className={`w-full bg-transparent border-none focus:ring-0 px-0 py-0.5 ${commonTextStyle} outline-none whitespace-pre-wrap break-words resize-none overflow-hidden leading-snug min-h-[22px]`}
                style={{
                  fontSize: 'inherit',
                  lineHeight: '1.375rem',
                  margin: '1px 0',
                }}
                rows={1}
              />
            ) : (
              <button
                onClick={() => onEditStart(task)}
                className={`w-full text-left whitespace-pre-wrap break-words ${commonTextStyle} py-0.5 leading-snug min-h-[22px]`}
                style={{
                  margin: '1px 0',
                  lineHeight: '1.375rem',
                }}
              >
                {task.title}
              </button>
            )}
          </div>
          {hasSubtasks && (
            <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">
              {progress.completed}/{progress.total}
            </span>
          )}
          <button
            onClick={() => onAddToDaily(task)}
            className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 ${
              isInDailyTasks ? 'text-blue-500' : 'text-gray-400'
            }`}
            title={isInDailyTasks ? "本日のタスクから削除" : "本日のタスクに追加"}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={handleDeleteClick}
            className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 ${
              deleteConfirmState === 'confirming' ? 'text-red-500' : 'text-gray-400'
            }`}
            title={deleteConfirmState === 'confirming' ? "もう一度クリックで削除" : "削除"}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}; 