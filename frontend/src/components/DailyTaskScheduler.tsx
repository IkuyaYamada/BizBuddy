'use client';

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Task } from '@/types/task';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import * as api from '@/lib/api';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline';
import { CSS } from '@dnd-kit/utilities';
import { addDays, subDays } from 'date-fns';

interface DailyTaskSchedulerProps {
  tasks: Task[];
  onUpdate: () => void;
}

interface DailyTask extends Task {
  order: number;
  estimated_minutes?: number;
  hierarchy_path?: string[];
  is_completed?: boolean;
  parent_id?: number;
}

// ローカルストレージのキーを生成
const getStorageKey = (date: string) => `daily_tasks_${date}`;

export interface DailyTaskSchedulerRef {
  handleAddTask: (task: Task) => void;
  isTaskInDaily: (taskId: number) => boolean;
}

// 完了モーダルのインターフェース
interface CompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { description: string; outcome: string }) => void;
}

// 完了モーダルコンポーネント
const CompletionModal: React.FC<CompletionModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [description, setDescription] = useState('');
  const [outcome, setOutcome] = useState('');
  const [hasNoOutcome, setHasNoOutcome] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ 
      description, 
      outcome: hasNoOutcome ? '特になし' : outcome 
    });
    setDescription('');
    setOutcome('');
    setHasNoOutcome(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 mb-4"
                >
                  タスク完了の記録
                </Dialog.Title>
                <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      感想・振り返り
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      rows={3}
                      required
                    />
                  </div>
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      成果物・結果
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="no-outcome"
                          checked={hasNoOutcome}
                          onChange={(e) => {
                            setHasNoOutcome(e.target.checked);
                            if (e.target.checked) {
                              setOutcome('');
                            }
                          }}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor="no-outcome" className="ml-2 text-sm text-gray-600">
                          特になし
                        </label>
                      </div>
                      {!hasNoOutcome && (
                        <textarea
                          value={outcome}
                          onChange={(e) => setOutcome(e.target.value)}
                          className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          rows={3}
                          required={!hasNoOutcome}
                        />
                      )}
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      記録する (Ctrl+Enter)
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

// QuickAddItemType型を追加
interface QuickAddItemType {
  title: string;
  estimatedMinutes: number;
  icon?: React.ReactNode;
}

// よく使うアイテムの定義を追加
const quickAddItems: QuickAddItemType[] = [
  {
    title: 'タスクのスケジュール',
    estimatedMinutes: 15,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    title: 'ミーティング',
    estimatedMinutes: 30,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    title: '休憩',
    estimatedMinutes: 15,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
];

export const DailyTaskScheduler = forwardRef<DailyTaskSchedulerRef, DailyTaskSchedulerProps>(
  ({ tasks, onUpdate }, ref) => {
    const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
    const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);

    const sensors = useSensors(
      useSensor(PointerSensor),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
    );

    // ローカルストレージからタスクを読み込む
    const loadDailyTasks = () => {
      try {
        const storedTasks = localStorage.getItem(getStorageKey(selectedDate));
        if (storedTasks) {
          const parsedTasks = JSON.parse(storedTasks) as DailyTask[];
          // 現在するタスクのみをフィルタリング
          const validTasks = parsedTasks.filter(storedTask => 
            tasks.some(task => task.id === storedTask.id)
          );
          setDailyTasks(validTasks);
        } else {
          setDailyTasks([]);
        }
      } catch (error) {
        console.error('Failed to load daily tasks:', error);
        setDailyTasks([]);
      }
    };

    // ローカストレージにタスクを保存
    const saveDailyTasks = (tasks: DailyTask[]) => {
      try {
        localStorage.setItem(getStorageKey(selectedDate), JSON.stringify(tasks));
      } catch (error) {
        console.error('Failed to save daily tasks:', error);
      }
    };

    useEffect(() => {
      loadDailyTasks();
    }, [selectedDate, tasks]);

    const handleAddTask = (task: Task) => {
      const hierarchyPath: string[] = [];
      let currentTask = task as DailyTask;
      
      while (currentTask) {
        const parentTask = tasks.find(t => t.id === currentTask.parent_id);
        if (parentTask) {
          hierarchyPath.unshift(parentTask.title);
          currentTask = parentTask as DailyTask;
        } else {
          break;
        }
      }

      const newDailyTask: DailyTask = {
        ...task,
        order: dailyTasks.length,
        estimated_minutes: 30,
        hierarchy_path: hierarchyPath,
        is_completed: task.status === '完了',
        parent_id: currentTask.parent_id
      };

      const updatedTasks = [...dailyTasks, newDailyTask];
      setDailyTasks(updatedTasks);
      saveDailyTasks(updatedTasks);
    };

    const handleRemoveTask = (taskId: number) => {
      const updatedTasks = dailyTasks.filter(task => task.id !== taskId);
      setDailyTasks(updatedTasks);
      saveDailyTasks(updatedTasks);
    };

    const handleDragEnd = (event: any) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = dailyTasks.findIndex(t => t.id === active.id);
      const newIndex = dailyTasks.findIndex(t => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newTasks = arrayMove(dailyTasks, oldIndex, newIndex).map((task, index) => ({
          ...task,
          order: index,
        }));
        setDailyTasks(newTasks);
        saveDailyTasks(newTasks);
      }
    };

    const updateEstimatedTime = (taskId: number, minutes: number) => {
      const updatedTasks = dailyTasks.map(task =>
        task.id === taskId ? { ...task, estimated_minutes: minutes } : task
      );
      setDailyTasks(updatedTasks);
      saveDailyTasks(updatedTasks);
    };

    // タスクの完了状態を切り替える関数を更新
    const onToggleComplete = async (taskId: number) => {
      try {
        const dailyTask = dailyTasks.find(t => t.id === taskId);
        if (!dailyTask) return;

        // タスクが未完了から完了に変更される場合のみモーダルを表示
        if (!dailyTask.is_completed) {
          setCompletingTaskId(taskId);
          setIsCompletionModalOpen(true);
          return;
        }

        // 完了から未完了への変更は直接処理
        await updateTaskStatus(taskId, false);
      } catch (error) {
        console.error('Failed to update task status:', error);
      }
    };

    // タスクのステータスを更新する関数
    const updateTaskStatus = async (taskId: number, isCompleted: boolean) => {
      const originalTask = tasks.find(t => t.id === taskId);
      if (!originalTask) return;

      await api.updateHierarchicalTask(taskId, {
        title: originalTask.title,
        description: originalTask.description,
        is_completed: isCompleted,
        parent_id: originalTask.parent_id,
        level: 0,
        priority: originalTask.priority
      });

      const updatedTasks = dailyTasks.map(t =>
        t.id === taskId ? { ...t, is_completed: isCompleted } : t
      );
      setDailyTasks(updatedTasks);
      saveDailyTasks(updatedTasks);

      onUpdate();
    };

    // 完了モーダルの送信処理を修正
    const handleCompletionSubmit = async (data: { description: string; outcome: string }) => {
      if (!completingTaskId) return;

      try {
        // 完了するタスクを取得
        const completingTask = dailyTasks.find(t => t.id === completingTaskId);
        if (!completingTask) {
          console.error('Completing task not found');
          return;
        }

        // 階層を辿って根のタスクを見つける
        const findRootTask = (taskId: number, visited = new Set<number>()): number => {
          console.log('Finding root for task:', taskId);
          
          // 循環参照防止
          if (visited.has(taskId)) {
            console.log('Circular reference detected for task:', taskId);
            return taskId;
          }
          visited.add(taskId);

          // まず通常のタスクとして探す
          const task = tasks.find(t => t.id === taskId);
          if (task) {
            console.log('Found task in regular tasks:', task);
            if (!task.parent_id) {
              console.log('This is a root task');
              return task.id;
            }
            return findRootTask(task.parent_id, visited);
          }

          // 完了タスクの親IDを取得
          const currentTask = dailyTasks.find(t => t.id === taskId);
          if (!currentTask) {
            console.log('Task not found in dailyTasks:', taskId);
            return taskId;
          }
          console.log('Found task in dailyTasks:', currentTask);

          if (!currentTask.parent_id) {
            console.log('No parent_id found for task:', taskId);
            return taskId;
          }

          // 親タスクを探す
          const parentTask = tasks.find(t => t.id === currentTask.parent_id);
          if (parentTask) {
            console.log('Found parent task:', parentTask);
            if (!parentTask.parent_id) {
              console.log('Parent is a root task');
              return parentTask.id;
            }
            return findRootTask(parentTask.parent_id, visited);
          }

          console.log('Parent task not found, trying to find in dailyTasks:', currentTask.parent_id);
          return findRootTask(currentTask.parent_id, visited);
        };

        // 根のタスクIDを取得
        const mainTaskId = findRootTask(completingTaskId);
        console.log('Final root task ID:', mainTaskId);

        // APIコールの前にタスクの存在確認
        const rootTask = tasks.find(t => t.id === mainTaskId) || dailyTasks.find(t => t.id === mainTaskId);
        if (!rootTask) {
          console.error('Root task not found:', mainTaskId);
          throw new Error('Root task not found');
        }

        // 階層情報を取得
        const hierarchyInfo = completingTask.hierarchy_path 
          ? `${completingTask.hierarchy_path.join(' > ')} > ${completingTask.title}`
          : `\n\n【タスク】\n${completingTask.title}`;

        // 現在時刻をJSTで取得
        const now = new Date();
        const jstOffset = 9 * 60; // JSTは+9時間
        now.setMinutes(now.getMinutes() + jstOffset);

        // ワークログを作成
        const response = await fetch(`http://localhost:8000/tasks/${mainTaskId}/work-logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description: `【完了報告】\n${hierarchyInfo}\n\n感想・振り返り:\n${data.description}\n\n成果物・結果:\n${data.outcome}`,
            started_at: now.toISOString(),
            task_id: mainTaskId
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error:', errorText);
          throw new Error(`Failed to create work log: ${response.status} ${response.statusText}\nDetails: ${errorText}`);
        }

        // タスクを完了態に更新
        await updateTaskStatus(completingTaskId, true);

        setIsCompletionModalOpen(false);
        setCompletingTaskId(null);
      } catch (error) {
        console.error('Failed to complete task:', error);
      }
    };

    // タスクを移動する関数を追加
    const handleMoveTask = (taskId: number, direction: 'up' | 'down') => {
      const currentIndex = dailyTasks.findIndex(t => t.id === taskId);
      if (currentIndex === -1) return;

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= dailyTasks.length) return;

      const newTasks = arrayMove(dailyTasks, currentIndex, newIndex).map((task, index) => ({
        ...task,
        order: index,
      }));
      setDailyTasks(newTasks);
      saveDailyTasks(newTasks);
    };

    // クイックアイテム追加関数
    const handleQuickAdd = (item: QuickAddItemType) => {
      const newTask: DailyTask = {
        id: Date.now(), // 一時的なID
        title: item.title,
        description: '',
        status: '未着手',
        priority: 0,
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        order: dailyTasks.length,
        estimated_minutes: item.estimatedMinutes,
        is_completed: false,
        motivation: 0,
        priority_score: 0,
        motivation_score: 0,
      };

      const updatedTasks = [...dailyTasks, newTask];
      setDailyTasks(updatedTasks);
      saveDailyTasks(updatedTasks);
    };

    // ref経由で公開する関数
    useImperativeHandle(ref, () => ({
      handleAddTask: (task: Task) => {
        if (!dailyTasks.some(dt => dt.id === task.id)) {
          handleAddTask(task);
        }
      },
      isTaskInDaily: (taskId: number) => {
        return dailyTasks.some(task => task.id === taskId);
      },
    }));

    // 合計見積時間を計算
    const totalEstimatedMinutes = dailyTasks.reduce((sum, task) => sum + (task.estimated_minutes || 0), 0);
    const totalHours = Math.floor(totalEstimatedMinutes / 60);
    const remainingMinutes = totalEstimatedMinutes % 60;

    // SortableTaskItemをコンポーネント内に移動
    const SortableTaskItem = ({ task, index, onRemove, onUpdateTime, onToggleComplete }: {
      task: DailyTask;
      index: number;
      onRemove: (id: number) => void;
      onUpdateTime: (id: number, minutes: number) => void;
      onToggleComplete: (taskId: number) => void;
    }) => {
      const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
      } = useSortable({ id: task.id });

      const style = {
        transform: CSS.Transform.toString(transform),
        transition,
      };

      return (
        <div
          ref={setNodeRef}
          style={style}
          className={`flex items-center gap-2 p-2 rounded group transition-all duration-300 ${
            task.is_completed 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-gray-50 border border-gray-200'
          }`}
        >
          <div className="flex items-center gap-1">
            <div
              {...attributes}
              {...listeners}
              className="cursor-move p-1 hover:bg-gray-200 rounded"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9h8M8 15h8" />
              </svg>
            </div>
            <div className="flex flex-col">
              <button
                onClick={() => handleMoveTask(task.id, 'up')}
                className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                disabled={index === 0}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                onClick={() => handleMoveTask(task.id, 'down')}
                className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                disabled={index === dailyTasks.length - 1}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
          <span className="text-sm text-gray-400 w-6">{index + 1}</span>
          <div className="flex-1">
            {task.hierarchy_path && task.hierarchy_path.length > 0 && (
              <div className="text-xs text-gray-400 mb-0.5">
                {task.hierarchy_path.join(' > ')}
              </div>
            )}
            <div className={`text-sm transition-all duration-300 ${
              task.is_completed 
                ? 'line-through text-green-600' 
                : 'text-gray-600'
            }`}>
              {task.title}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={task.estimated_minutes || 30}
              onChange={(e) => onUpdateTime(task.id, parseInt(e.target.value))}
              className="w-16 text-sm border-gray-200 rounded"
              min="5"
              step="5"
            />
            <span className="text-sm text-gray-400">分</span>
            <button
              onClick={() => onRemove(task.id)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => onToggleComplete(task.id)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                task.is_completed
                  ? 'bg-green-100 text-green-600 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
              title={task.is_completed ? "完了を取り消す" : "完了にする"}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>
      );
    };

    return (
      <div className="bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-normal text-gray-700">本日のタスク</h3>
            <div className="text-sm text-gray-500 mt-1">
              合計: {totalHours}時間{remainingMinutes}分
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}
              className="p-1 rounded hover:bg-gray-100 text-gray-600"
              title="前日"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border-gray-200 rounded text-sm"
            />
            
            <button
              onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}
              className="p-1 rounded hover:bg-gray-100 text-gray-600"
              title="翌���"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* クイック追加ボタン */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {quickAddItems.map((item, index) => (
            <button
              key={index}
              onClick={() => handleQuickAdd(item)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-colors duration-150 whitespace-nowrap"
            >
              {item.icon}
              <span>{item.title}</span>
              <span className="text-gray-400">({item.estimatedMinutes}分)</span>
            </button>
          ))}
        </div>

        <div className="mb-4">
          <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out"
              style={{
                width: `${dailyTasks.length > 0
                  ? (dailyTasks.filter(task => task.is_completed).length / dailyTasks.length) * 100
                  : 0}%`
              }}
            />
          </div>
        </div>

        <div className="mb-4 flex justify-between items-center">
          <div className="text-right">
            <div className="text-2xl font-bold text-indigo-600 mb-1">
              {dailyTasks.filter(task => task.is_completed).length} / {dailyTasks.length}
            </div>
            <div className="text-sm text-indigo-500">完了タスク</div>
          </div>
        </div>

        <div className="space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={dailyTasks.map(t => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {dailyTasks.map((task, index) => (
                <SortableTaskItem
                  key={task.id}
                  task={task}
                  index={index}
                  onRemove={handleRemoveTask}
                  onUpdateTime={updateEstimatedTime}
                  onToggleComplete={onToggleComplete}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {dailyTasks.length > 0 && (
          <div className="mt-4 text-center">
            <p className="text-indigo-600 font-medium">
              {dailyTasks.every(task => task.is_completed)
                ? '🎉 素晴らしい！今日のタスクを全て完了しました！'
                : `💪 あと${dailyTasks.length - dailyTasks.filter(task => task.is_completed).length}個のタスクで目標達成！`}
            </p>
          </div>
        )}

        {dailyTasks.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg mb-2">今日のタスクを設定しよう！</p>
            <p className="text-sm">階層型タスクから追加できます</p>
          </div>
        )}

        <CompletionModal
          isOpen={isCompletionModalOpen}
          onClose={() => {
            setIsCompletionModalOpen(false);
            setCompletingTaskId(null);
          }}
          onSubmit={handleCompletionSubmit}
        />
      </div>
    );
  }
); 