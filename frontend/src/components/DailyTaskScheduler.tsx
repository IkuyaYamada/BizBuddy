"use client";

import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import { Task } from "@/types/task";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import * as api from "@/lib/api";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { CSS } from "@dnd-kit/utilities";
import { addDays, subDays } from "date-fns";

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

// ローカルストレージ��成
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
const CompletionModal: React.FC<CompletionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [description, setDescription] = useState("");
  const [outcome, setOutcome] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      description: description.trim(),
      outcome: outcome.trim(),
    });
    setDescription("");
    setOutcome("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
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
                      感想返り
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      rows={3}
                      placeholder="任意"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      成果物・結果
                    </label>
                    <textarea
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      rows={3}
                      placeholder="任意"
                    />
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
    title: "タスクのスケジュール",
    estimatedMinutes: 15,
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    title: "ミーティング",
    estimatedMinutes: 30,
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
  },
  {
    title: "休憩",
    estimatedMinutes: 15,
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
];

export const DailyTaskScheduler = forwardRef<
  DailyTaskSchedulerRef,
  DailyTaskSchedulerProps
>(({ tasks, onUpdate }, ref) => {
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [tomatoCount, setTomatoCount] = useState(0);
  const TOMATO_TIME = 25 * 60; // 25分
  const timerRef = useRef<NodeJS.Timeout>();
  const [focusMemo, setFocusMemo] = useState("");
  const memoRef = useRef<HTMLTextAreaElement>(null);
  const [rootTaskWorkLogs, setRootTaskWorkLogs] = useState<any[]>([]);
  const [editingContent, setEditingContent] = useState("");
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);
  const [memoHeight, setMemoHeight] = useState(70); // 初期値70%

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
        const validTasks = parsedTasks.filter((storedTask) =>
          tasks.some((task) => task.id === storedTask.id)
        );
        setDailyTasks(validTasks);
      } else {
        setDailyTasks([]);
      }
    } catch (error) {
      console.error("Failed to load daily tasks:", error);
      setDailyTasks([]);
    }
  };

  // ローカストレージにタスクを保存
  const saveDailyTasks = (tasks: DailyTask[]) => {
    try {
      localStorage.setItem(getStorageKey(selectedDate), JSON.stringify(tasks));
    } catch (error) {
      console.error("Failed to save daily tasks:", error);
    }
  };

  useEffect(() => {
    loadDailyTasks();
  }, [selectedDate, tasks]);

  const handleAddTask = (task: Task) => {
    const hierarchyPath: string[] = [];
    let currentTask = task as DailyTask;

    while (currentTask) {
      const parentTask = tasks.find((t) => t.id === currentTask.parent_id);
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
      is_completed: task.status === "完了",
      parent_id: currentTask.parent_id,
    };

    const updatedTasks = [...dailyTasks, newDailyTask];
    setDailyTasks(updatedTasks);
    saveDailyTasks(updatedTasks);
  };

  const handleRemoveTask = (taskId: number) => {
    const updatedTasks = dailyTasks.filter((task) => task.id !== taskId);
    setDailyTasks(updatedTasks);
    saveDailyTasks(updatedTasks);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setDailyTasks((prevTasks) => {
      const oldIndex = prevTasks.findIndex((t) => t.id === active.id);
      const newIndex = prevTasks.findIndex((t) => t.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return prevTasks;

      const newTasks = arrayMove(prevTasks, oldIndex, newIndex).map(
        (task, index) => ({
          ...task,
          order: index,
        })
      );

      // localStorage の更新を非同期で行う
      requestAnimationFrame(() => {
        saveDailyTasks(newTasks);
      });

      return newTasks;
    });
  };

  const updateEstimatedTime = (taskId: number, minutes: number) => {
    const updatedTasks = dailyTasks.map((task) =>
      task.id === taskId ? { ...task, estimated_minutes: minutes } : task
    );
    setDailyTasks(updatedTasks);
    saveDailyTasks(updatedTasks);
  };

  // タスクの完了状態を切りえを
  const onToggleComplete = async (taskId: number) => {
    try {
      const dailyTask = dailyTasks.find((t) => t.id === taskId);
      if (!dailyTask) return;

      // タスクが未完了から完了に変更される場合のみモーダルを表示
      if (!dailyTask.is_completed) {
        setCompletingTaskId(taskId);
        setIsCompletionModalOpen(true);
        return;
      }

      // 完了から未了への変更は直接処理
      await updateTaskStatus(taskId, false);
    } catch (error) {
      console.error("Failed to update task status:", error);
    }
  };

  // タスクのステータスを更新する関数
  const updateTaskStatus = async (taskId: number, isCompleted: boolean) => {
    const originalTask = tasks.find((t) => t.id === taskId);
    if (!originalTask) return;

    await api.updateHierarchicalTask(taskId, {
      title: originalTask.title,
      description: originalTask.description,
      is_completed: isCompleted,
      parent_id: originalTask.parent_id,
      level: 0,
      priority: originalTask.priority,
    });

    const updatedTasks = dailyTasks.map((t) =>
      t.id === taskId ? { ...t, is_completed: isCompleted } : t
    );
    setDailyTasks(updatedTasks);
    saveDailyTasks(updatedTasks);

    onUpdate();
  };

  // 完了モーダルの送信処理を修正
  const handleCompletionSubmit = async (data: {
    description: string;
    outcome: string;
  }) => {
    if (!completingTaskId) return;

    try {
      // タスクを完了態に更新
      await updateTaskStatus(completingTaskId, true);

      // 感想が入力されている場合のみワークログを作成
      if (data.description.trim()) {
        // 完了するタスクを取
        const completingTask = dailyTasks.find((t) => t.id === completingTaskId);
        if (!completingTask) {
          console.error("Completing task not found");
          return;
        }

        // 階層を辿って根のタスクを見つける
        const findRootTask = (
          taskId: number,
          visited = new Set<number>()
        ): number => {
          if (visited.has(taskId)) {
            return taskId;
          }
          visited.add(taskId);

          const task = tasks.find((t) => t.id === taskId);
          if (task) {
            if (!task.parent_id) {
              return task.id;
            }
            return findRootTask(task.parent_id, visited);
          }

          const currentTask = dailyTasks.find((t) => t.id === taskId);
          if (!currentTask || !currentTask.parent_id) {
            return taskId;
          }

          return findRootTask(currentTask.parent_id, visited);
        };

        // 根のタスクIDを取得
        const mainTaskId = findRootTask(completingTaskId);

        // APIコールの前にタスクの存在確認
        const rootTask =
          tasks.find((t) => t.id === mainTaskId) ||
          dailyTasks.find((t) => t.id === mainTaskId);
        if (!rootTask) {
          console.error("Root task not found:", mainTaskId);
          throw new Error("Root task not found");
        }

        // 階層情報を取得
        const hierarchyInfo = completingTask.hierarchy_path
          ? `${completingTask.hierarchy_path.join(" > ")} > ${
              completingTask.title
            }`
          : `\n\n【タスク】\n${completingTask.title}`;

        // 現在時刻をJSTで取得
        const now = new Date();
        const jstOffset = 9 * 60; // JSTは+9時
        now.setMinutes(now.getMinutes() + jstOffset);

        // ワークログを作成
        const response = await fetch(
          `http://localhost:8000/tasks/${mainTaskId}/work-logs/`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              description: `【完了報告】\n${hierarchyInfo}\n\n感想・振り返り:\n${data.description}\n\n成果物・結果:\n${data.outcome}`,
              started_at: now.toISOString(),
              task_id: mainTaskId,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("API Error:", errorText);
          throw new Error(
            `Failed to create work log: ${response.status} ${response.statusText}\nDetails: ${errorText}`
          );
        }
      }

      setIsCompletionModalOpen(false);
      setCompletingTaskId(null);
    } catch (error) {
      console.error("Failed to complete task:", error);
    }
  };

  // タスクを移動する関数を追加
  const handleMoveTask = (taskId: number, direction: "up" | "down") => {
    const currentIndex = dailyTasks.findIndex((t) => t.id === taskId);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= dailyTasks.length) return;

    const newTasks = arrayMove(dailyTasks, currentIndex, newIndex).map(
      (task, index) => ({
        ...task,
        order: index,
      })
    );
    setDailyTasks(newTasks);
    saveDailyTasks(newTasks);
  };

  // クイックアイテム追加関数
  const handleQuickAdd = (item: QuickAddItemType) => {
    const newTask: DailyTask = {
      id: Date.now(), // 一時的なID
      title: item.title,
      description: "",
      status: "未着手",
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
      if (!dailyTasks.some((dt) => dt.id === task.id)) {
        handleAddTask(task);
      }
    },
    isTaskInDaily: (taskId: number) => {
      return dailyTasks.some((task) => task.id === taskId);
    },
  }));

  // 合計見積時間を計算
  const totalEstimatedMinutes = dailyTasks.reduce(
    (sum, task) => sum + (task.estimated_minutes || 0),
    0
  );
  const totalHours = Math.floor(totalEstimatedMinutes / 60);
  const remainingMinutes = totalEstimatedMinutes % 60;

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
          const newTime = prev + 1;
          // 25分経過ごとにトマトカウントを増やす
          if (newTime % TOMATO_TIME === 0) {
            setTomatoCount((current) => current + 1);
          }
          return newTime;
        });
      }, 1000);
      setIsTimerRunning(true);
    }
  };

  // フォーカスが除されたらタイマーをリセット
  useEffect(() => {
    if (!focusedTaskId) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setIsTimerRunning(false);
      setTimeElapsed(0);
      setTomatoCount(0);
    }
  }, [focusedTaskId]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // 時間のフォーマット
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}時間${minutes}分`;
    }
    return `${minutes}分`;
  };

  // メモの保存
  const saveMemo = async () => {
    if (focusMemo.trim() && focusedTaskId) {
      try {
        // 階層辿って根のタスクを見つける
        const findRootTask = (taskId: number, visited = new Set<number>()): number => {
          if (visited.has(taskId)) {
            return taskId;
          }
          visited.add(taskId);

          const task = tasks.find((t) => t.id === taskId);
          if (task) {
            if (!task.parent_id) {
              return task.id;
            }
            return findRootTask(task.parent_id, visited);
          }

          const currentTask = dailyTasks.find((t) => t.id === taskId);
          if (!currentTask || !currentTask.parent_id) {
            return taskId;
          }

          return findRootTask(currentTask.parent_id, visited);
        };

        // ルートタスクIDを取得
        const rootTaskId = findRootTask(focusedTaskId);

        // 階層情報を取得
        const focusedTask = dailyTasks.find((t) => t.id === focusedTaskId);
        const hierarchyInfo = focusedTask?.hierarchy_path
          ? `${focusedTask.hierarchy_path.join(" > ")} > ${focusedTask.title}`
          : focusedTask?.title || "";

        const response = await fetch(`http://localhost:8000/tasks/${rootTaskId}/work-logs/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description: `【フォーカスモモ】\n${hierarchyInfo}\n\n${focusMemo}`,
            started_at: new Date().toISOString(),
            task_id: rootTaskId,
          }),
        });

        if (response.ok) {
          setFocusMemo(""); // メモをクリア
        }
      } catch (error) {
        console.error('Error saving work log:', error);
      }
    }
  };

  // ルートタスクの���ークログを取得る関数
  const fetchRootTaskWorkLogs = async (taskId: number) => {
    try {
      const findRootTask = (taskId: number, visited = new Set<number>()): number => {
        if (visited.has(taskId)) {
          return taskId;
        }
        visited.add(taskId);

        const task = tasks.find((t) => t.id === taskId);
        if (task) {
          if (!task.parent_id) {
            return task.id;
          }
          return findRootTask(task.parent_id, visited);
        }

        const currentTask = dailyTasks.find((t) => t.id === taskId);
        if (!currentTask || !currentTask.parent_id) {
          return taskId;
        }

        return findRootTask(currentTask.parent_id, visited);
      };

      const rootTaskId = findRootTask(taskId);
      const response = await fetch(`http://localhost:8000/tasks/${rootTaskId}/work-logs/`);
      if (response.ok) {
        const logs = await response.json();
        setRootTaskWorkLogs(logs);
      }
    } catch (error) {
      console.error('Error fetching work logs:', error);
      setRootTaskWorkLogs([]);
    }
  };

  // フォーカスモードの切り替え時にワークログを取得
  const handleFocusToggle = async (taskId: number) => {
    if (focusedTaskId === taskId) {
      await saveMemo();
      setFocusedTaskId(null);
      setTimeElapsed(0);
      setTomatoCount(0);
      setRootTaskWorkLogs([]);
    } else {
      setFocusedTaskId(taskId);
      setTimeElapsed(0);
      setTomatoCount(0);
      setIsTimerRunning(false);
      setFocusMemo("");
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      await fetchRootTaskWorkLogs(taskId);
    }
  };

  // フォーカスモードでタスクを移動する関数
  const handleMoveTaskOnFocusedView = (direction: "up" | "down") => {
    const currentIndex = dailyTasks.findIndex((t) => t.id === focusedTaskId);
    console.log("Current index:", currentIndex);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= dailyTasks.length) return;

    setFocusedTaskId(dailyTasks[newIndex].id);
    console.log("New index:", newIndex);
  };

  // キーボードイベントの処理
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!focusedTaskId) return;

      if (e.key === "Escape") {
        e.preventDefault();
        setFocusedTaskId(null);
        setTimeElapsed(0);
        setTomatoCount(0);
        await saveMemo();
      } else if (e.ctrlKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        // 必��preventDefaultを先に呼び出す
        e.preventDefault();
        
        const currentIndex = dailyTasks.findIndex(
          (task) => task.id === focusedTaskId
        );
        if (currentIndex === -1) return;

        let newIndex;
        if (e.key === "ArrowLeft") {
          newIndex =
            currentIndex > 0 ? currentIndex - 1 : dailyTasks.length - 1;
        } else {
          newIndex =
            currentIndex < dailyTasks.length - 1 ? currentIndex + 1 : 0;
        }

        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        setIsTimerRunning(false);
        setTimeElapsed(0);
        setTomatoCount(0);

        const newTaskId = dailyTasks[newIndex].id;
        setFocusedTaskId(newTaskId);
        // 新しいタスクの作業ログを取得
        await fetchRootTaskWorkLogs(newTaskId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedTaskId, dailyTasks, focusMemo]);

  // タイマーの更新間隔を1分に設定
  useEffect(() => {
    if (isTimerRunning && focusedTaskId) {
      timerRef.current = setInterval(() => {
        setTimeElapsed((prev) => {
          const newTime = prev + 60; // 1分ずつ増加
          if (newTime % TOMATO_TIME === 0) {
            setTomatoCount(Math.floor(newTime / TOMATO_TIME));
          }
          return newTime;
        });
      }, 60000); // 1分 = 60000ミリ秒
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerRunning, focusedTaskId]);

  // 階層パスを取得する関数
  const getTaskHierarchyPath = (taskId: number): string[] => {
    const task = dailyTasks.find((t) => t.id === taskId);
    if (!task) return [];

    // ローカストレージから階層情報を取得
    const storageKey = `daily_tasks_${selectedDate}`;
    const storedTasks = localStorage.getItem(storageKey);
    if (storedTasks) {
      try {
        const tasks = JSON.parse(storedTasks) as DailyTask[];
        const targetTask = tasks.find((t) => t.id === taskId);
        return targetTask?.hierarchy_path || [];
      } catch (e) {
        console.error("Failed to parse stored tasks:", e);
      }
    }
    return [];
  };

  // SortableTaskItemコンポーネントを再実装
  const SortableTaskItem = ({
    task,
    index,
    onRemove,
    onUpdateTime,
    onToggleComplete,
  }: {
    task: DailyTask;
    index: number;
    onRemove: (id: number) => void;
    onUpdateTime: (id: number, minutes: number) => void;
    onToggleComplete: (taskId: number) => void;
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: task.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const isFocused = focusedTaskId === task.id;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`relative flex items-center gap-3 p-4 rounded-xl transition-all duration-300 bg-white border shadow-sm ${
          task.is_completed
            ? "border-green-200 bg-green-50/50"
            : "border-gray-200 hover:border-gray-300 hover:shadow-md"
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-move p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 9h8M8 15h8"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => handleMoveTask(task.id, "up")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 text-gray-400 hover:text-gray-600"
              disabled={index === 0}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l7-7 7 7"
                />
              </svg>
            </button>
            <button
              onClick={() => handleMoveTask(task.id, "down")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 text-gray-400 hover:text-gray-600"
              disabled={index === dailyTasks.length - 1}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        </div>
        <span className="text-sm font-mono text-gray-400 w-6">{index + 1}</span>
        <div className="flex-1">
          {task.hierarchy_path && task.hierarchy_path.length > 0 && (
            <div className="text-xs text-gray-400 mb-1 font-mono">
              {task.hierarchy_path.join(" > ")}
            </div>
          )}
          <div
            className={`text-sm transition-all duration-300 ${
              task.is_completed
                ? "line-through text-green-600"
                : "text-gray-700"
            }`}
          >
            {task.title}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg">
            <input
              type="number"
              value={task.estimated_minutes || 30}
              onChange={(e) => onUpdateTime(task.id, parseInt(e.target.value))}
              className="w-16 text-sm bg-transparent border-0 focus:ring-0 text-gray-700"
              min="5"
              step="5"
            />
            <span className="text-sm text-gray-500">分</span>
          </div>
          <button
            onClick={() => handleFocusToggle(task.id)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
              isFocused
                ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
            }`}
            title={isFocused ? "フォーカスモードを解除" : "フォーカスモードを開始"}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  isFocused
                    ? "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    : "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                }
              />
            </svg>
          </button>
          <button
            onClick={() => onRemove(task.id)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => onToggleComplete(task.id)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
              task.is_completed
                ? "bg-green-100 text-green-600 hover:bg-green-200"
                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
            }`}
            title={task.is_completed ? "完了を取り消す" : "完了にする"}
          >
            <svg
              className="w-5 h-5"
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
        </div>
      </div>
    );
  };

  const MemoizedSortableTaskItem = React.memo(SortableTaskItem);

  // タブ切り替え時のデータ保持
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && focusedTaskId !== null) {
        // フォーカスモードのメモ入力欄のカーソル位置を保存
        if (memoRef.current) {
          const position = memoRef.current.selectionStart;
          setCursorPosition(position);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [focusedTaskId]);

  // カーソル位置の復元
  useEffect(() => {
    if (focusedTaskId !== null && memoRef.current && cursorPosition !== null) {
      requestAnimationFrame(() => {
        if (memoRef.current) {
          memoRef.current.focus();
          memoRef.current.setSelectionRange(cursorPosition, cursorPosition);
        }
      });
    }
  }, [focusedTaskId, cursorPosition]);

  // リサイザーのスタイルを変更
  const resizeBarStyle = {
    height: '4px',  // 操作しやすいように少し太く
    backgroundColor: '#e5e7eb',
    cursor: 'row-resize',
    margin: '0',
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: '#d1d5db',
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-8 min-h-screen">
      {/* フォーカスモード */}
      {focusedTaskId && (
        <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-md z-40 flex items-center justify-center transition-all duration-500">
          <div 
            className="w-full h-screen max-w-5xl mx-auto px-4 py-8 flex flex-col opacity-0 animate-fade-in"
            style={{
              animation: 'fadeIn 0.5s ease-out forwards',
            }}
          >
            <div className="w-full mb-6">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden border border-white/10 shadow-2xl transition-all duration-300 hover:bg-white/15">
                <div className="p-8">
                  {/* 階層パス */}
                  <div className="text-sm text-gray-400/80 mb-4 font-mono">
                    {(() => {
                      const hierarchyPath = getTaskHierarchyPath(focusedTaskId);
                      return hierarchyPath.length > 0
                        ? hierarchyPath.join(" > ")
                        : null;
                    })()}
                  </div>

                  {/* タスク番号 */}
                  <div className="text-sm text-gray-400/80 mb-2 font-mono tracking-wider">
                    Task {dailyTasks.findIndex((t) => t.id === focusedTaskId) + 1} / {dailyTasks.length}
                  </div>

                  {/* タスクタイトル */}
                  <div className="text-3xl font-medium text-white mb-6 tracking-wide">
                    {dailyTasks.find((task) => task.id === focusedTaskId)?.title}
                  </div>

                  {/* タイマーセクション */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-6">
                      <button
                        onClick={toggleTimer}
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 ${
                          isTimerRunning
                            ? "bg-white/10 text-white hover:bg-white/20 scale-95"
                            : "bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:scale-105"
                        }`}
                        title={isTimerRunning ? "一時停止" : "開始"}
                      >
                        {isTimerRunning ? (
                          <svg
                            className="w-8 h-8"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        ) : (
                          <span className="text-3xl transform transition-transform">
                            🍅
                          </span>
                        )}
                      </button>
                      <div className="text-4xl font-bold text-white font-mono tracking-wider">
                        {formatTime(timeElapsed)}
                      </div>
                      <div className="flex items-center gap-2 text-2xl">
                        {tomatoCount > 0 && "🍅".repeat(tomatoCount)}
                      </div>
                    </div>

                    {/* タスク操作ボタン */}
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleMoveTaskOnFocusedView("up")}
                        className="text-gray-400/80 hover:text-white transition-colors duration-300 px-4 py-2 rounded-lg hover:bg-white/10"
                        disabled={dailyTasks.findIndex((t) => t.id === focusedTaskId) === 0}
                      >
                        前のタスク
                      </button>
                      <button
                        onClick={() => handleMoveTaskOnFocusedView("down")}
                        className="text-gray-400/80 hover:text-white transition-colors duration-300 px-4 py-2 rounded-lg hover:bg-white/10"
                        disabled={dailyTasks.findIndex((t) => t.id === focusedTaskId) === dailyTasks.length - 1}
                      >
                        次のタスク
                      </button>
                      <button
                        onClick={() => onToggleComplete(focusedTaskId)}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${
                          dailyTasks.find((t) => t.id === focusedTaskId)?.is_completed
                            ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                            : "bg-white/10 text-gray-400 hover:bg-white/20"
                        }`}
                      >
                        <svg
                          className="w-6 h-6"
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
                    </div>
                  </div>

                  {/* プログレスバー */}
                  <div className="w-full bg-white/5 rounded-full h-1.5 mb-6 overflow-hidden">
                    <div
                      className="bg-red-400 h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${((timeElapsed % TOMATO_TIME) / TOMATO_TIME) * 100}%`,
                        boxShadow: '0 0 10px rgba(248, 113, 113, 0.5)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* メモエリアとリサイザー */}
            <div className="flex-1 bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden border border-white/10 shadow-2xl transition-all duration-300 hover:bg-white/15">
              <div className="p-8">
                <textarea
                  ref={memoRef}
                  value={focusMemo}
                  onChange={(e) => setFocusMemo(e.target.value)}
                  onKeyDown={async (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      // ... existing code ...
                    }
                  }}
                  className="w-full resize-none bg-white/5 border-0 rounded-xl focus:ring-2 focus:ring-white/20 text-white placeholder-gray-400/60 text-lg"
                  placeholder="メモを入力... (Ctrl+Enter で保存)"
                  style={{ 
                    height: `calc(${memoHeight}vh - 300px)`,
                    caretColor: 'white',
                  }}
                />
              </div>

              {/* リサイザー */}
              <div
                onMouseDown={(e) => {
                  // ... existing code ...
                }}
                style={{
                  ...resizeBarStyle,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }}
                className="hover:bg-white/20 cursor-row-resize"
              />

              {/* 作業ログ表示エリア */}
              <div className="p-8">
                <h3 className="text-lg font-medium text-white/90 mb-6">作業ログ</h3>
                <div 
                  className="space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent" 
                  style={{ maxHeight: `calc(${100 - memoHeight}vh - 100px)` }}
                >
                  {rootTaskWorkLogs.sort((a, b) => 
                    new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
                  ).map((log) => (
                    <div key={log.id} className="border-b border-white/10 pb-4">
                      <div className="text-sm text-gray-400/80 mb-2 font-mono">
                        {format(new Date(log.started_at), "yyyy/MM/dd HH:mm", { locale: ja })}
                      </div>
                      <div className="text-base text-gray-300/90 whitespace-pre-wrap">
                        {log.description}
                      </div>
                    </div>
                  ))}
                  {rootTaskWorkLogs.length === 0 && (
                    <div className="text-center text-gray-400/60">
                      作業ログはありません
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* キーボードショートカットヘルプ */}
          <div className="fixed bottom-4 right-4 text-sm text-gray-400/60">
            <div>ESC: フォーカスモード終了</div>
            <div>Ctrl + ←/→: タスク切り替え</div>
            <div>Ctrl + Enter: メモ保存</div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        {/* ヘッダー部分 */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-medium text-gray-800 mb-2">本日のタスク</h3>
            <div className="text-base text-gray-500 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                合計: {totalHours}時間{remainingMinutes}分
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedDate(format(subDays(new Date(selectedDate), 1), "yyyy-MM-dd"))}
              className="p-2 rounded-lg hover:bg-white hover:shadow-md transition-all duration-200 text-gray-600"
              title="昨日"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />

            <button
              onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), "yyyy-MM-dd"))}
              className="p-2 rounded-lg hover:bg-white hover:shadow-md transition-all duration-200 text-gray-600"
              title="翌日"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* クイック追加ボタン */}
        <div className="mb-6 flex gap-3 overflow-x-auto pb-2">
          {quickAddItems.map((item, index) => (
            <button
              key={index}
              onClick={() => handleQuickAdd(item)}
              className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-gray-300 transition-all duration-200 whitespace-nowrap group"
            >
              <span className="text-gray-400 group-hover:text-blue-500 transition-colors duration-200">
                {item.icon}
              </span>
              <span>{item.title}</span>
              <span className="text-gray-400">({item.estimatedMinutes}分)</span>
            </button>
          ))}
        </div>

        {/* プログレスバー */}
        <div className="mb-6 bg-white p-6 rounded-2xl shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <div className="text-3xl font-bold text-blue-600">
                {dailyTasks.filter((task) => task.is_completed).length}
                <span className="text-gray-400 font-normal"> / {dailyTasks.length}</span>
              </div>
              <div className="text-sm font-medium text-gray-500">完了タスク</div>
            </div>
            {dailyTasks.length > 0 && (
              <p className="text-gray-600 font-medium">
                {dailyTasks.every((task) => task.is_completed)
                  ? "🎉 素晴らしい！今日のタスクを全て完了しました！"
                  : `💪 あと${
                      dailyTasks.length -
                      dailyTasks.filter((task) => task.is_completed).length
                    }個のタスク目標！`}
              </p>
            )}
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out"
              style={{
                width: `${
                  dailyTasks.length > 0
                    ? (dailyTasks.filter((task) => task.is_completed).length /
                        dailyTasks.length) *
                      100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        {/* タスクリスト */}
        <div className="space-y-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={dailyTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {dailyTasks.map((task, index) => (
                <MemoizedSortableTaskItem
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

        {dailyTasks.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm">
            <div className="mb-4 text-gray-400">
              <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-700 mb-2">今日のタスクを設定しよう！</p>
            <p className="text-sm text-gray-500">階層型タスクから追加できます</p>
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
    </div>
  );
});
