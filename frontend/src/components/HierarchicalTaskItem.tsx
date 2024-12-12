'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  ChevronRightIcon, 
  CalendarDaysIcon,
  ArrowSmallLeftIcon,
  ArrowSmallRightIcon
} from '@heroicons/react/24/outline';
import { HierarchicalTask } from '@/types/hierarchicalTask';

interface HierarchicalTaskItemProps {
  task: HierarchicalTask;
  onToggleExpand: (taskId: number) => void;
  onToggleComplete: (taskId: number) => void;
  onEditStart: (task: HierarchicalTask) => void;
  onEditSave: (taskId: number, content: string) => void;
  onAddSubTask: (parentId: number) => void;
  onDeleteTask: (taskId: number) => void;
  onAddToDaily?: (task: HierarchicalTask) => void;
  onAddSiblingTask?: (taskId: number) => void;
  onIncreaseLevel?: (taskId: number) => void;
  onDecreaseLevel?: (taskId: number) => void;
  isExpanded: boolean;
  isEditing: boolean;
  editingContent: string;
  onEditContentChange: (content: string) => void;
  isInDailyTasks?: boolean;
}

export const HierarchicalTaskItem: React.FC<HierarchicalTaskItemProps> = ({
  task,
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
  isEditing,
  editingContent,
  onEditContentChange,
  isInDailyTasks = false,
}) => {
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const deleteTimeoutRef = useRef<NodeJS.Timeout>();

  // 削除確認モードをリセット
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, []);

  const handleDeleteClick = () => {
    if (isDeleteConfirming) {
      onDeleteTask(task.id);
      setIsDeleteConfirming(false);
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    } else {
      setIsDeleteConfirming(true);
      deleteTimeoutRef.current = setTimeout(() => {
        setIsDeleteConfirming(false);
      }, 3000);
    }
  };

  return (
    <div
      className="group flex items-start gap-2 py-2 hover:bg-gray-50 transition-colors duration-150"
      style={{ marginLeft: `${task.level * 1.5}rem` }}
    >
      <div className="flex gap-1">
        <button
          onClick={() => onToggleExpand(task.id)}
          className="mt-1 text-gray-300 hover:text-gray-400"
          title="展開/折りたたみ"
        >
          <ChevronRightIcon className={`h-3 w-3 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
        </button>

        <button
          onClick={() => onAddSiblingTask?.(task.id)}
          className="mt-1 text-gray-300 hover:text-gray-500"
          title="同じ階層にタスクを追加"
        >
          <PlusIcon className="h-3 w-3" />
        </button>

        <div className="flex gap-0.5">
          {task.level > 0 && (
            <button
              onClick={() => onDecreaseLevel?.(task.id)}
              className="mt-1 text-gray-300 hover:text-gray-500"
              title="インデントを下げる"
            >
              <ArrowSmallLeftIcon className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => onIncreaseLevel?.(task.id)}
            className="mt-1 text-gray-300 hover:text-gray-500"
            title="インデントを上げる"
          >
            <ArrowSmallRightIcon className="h-3 w-3" />
          </button>
        </div>
      </div>

      {task.level > 0 && (
        <input
          type="checkbox"
          checked={task.is_completed}
          onChange={() => onToggleComplete(task.id)}
          className="mt-1 h-3 w-3 rounded border-gray-200 text-gray-500 focus:ring-gray-400"
        />
      )}

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            type="text"
            value={editingContent}
            onChange={(e) => onEditContentChange(e.target.value)}
            onBlur={(e) => {
              if (e.currentTarget.dataset.isComposing === 'true') {
                return;
              }
              if (!e.currentTarget.dataset.saveTriggered) {
                onEditSave(task.id, editingContent);
              }
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) {
                return;
              }

              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.currentTarget.dataset.saveTriggered = 'true';
                onEditSave(task.id, editingContent);
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.currentTarget.dataset.saveTriggered = 'true';
                onEditContentChange(task.title);
                onEditSave(task.id, task.title);
                e.currentTarget.blur();
              } else if (e.key === 'Enter') {
                e.preventDefault();
              }
            }}
            onCompositionStart={(e) => {
              e.currentTarget.dataset.isComposing = 'true';
            }}
            onCompositionEnd={(e) => {
              const input = e.currentTarget;
              requestAnimationFrame(() => {
                if (input && input.dataset) {
                  input.dataset.isComposing = 'false';
                }
              });
            }}
            className="w-full py-0.5 text-sm border-0 bg-transparent focus:ring-0"
            autoFocus
          />
        ) : (
          <div
            className={`text-sm cursor-pointer ${
              task.level > 0 && task.is_completed ? 'text-gray-300 line-through' : 'text-gray-600'
            }`}
            onClick={() => onEditStart(task)}
          >
            {task.title}
            {task.children && task.children.length > 0 && (
              <span className="ml-1.5 text-xs text-gray-300">
                ({task.children.length})
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-1">
        {onAddToDaily && !isInDailyTasks && (
          <button
            onClick={() => onAddToDaily(task)}
            className="p-1 text-gray-300 hover:text-gray-500"
            title="本日のタスクに追加"
          >
            <CalendarDaysIcon className="h-3 w-3" />
          </button>
        )}
        {task.level > 0 && (
          <button
            onClick={handleDeleteClick}
            className={`p-1 transition-colors duration-200 ${
              isDeleteConfirming 
                ? 'text-red-500 hover:text-red-700' 
                : 'text-gray-300 hover:text-gray-500'
            }`}
            title={isDeleteConfirming ? "もう一度クリックで削除" : "削除"}
          >
            <TrashIcon className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}; 