"use client";

import React, {
  useState,
  useEffect,
  KeyboardEvent,
  useRef,
  useMemo,
} from "react";
import { Task, SubTask, LeafTask, ActionItem } from "@/types/task";
import * as api from "@/lib/api";
import FormField from "@/components/common/FormField";
import type { IconComponent } from "@heroicons/react/24/outline";
import {
  PlusIcon as PlusIconHeroicon,
  TrashIcon as TrashIconHeroicon,
} from "@heroicons/react/24/outline";

const PlusIcon = PlusIconHeroicon as IconComponent;
const TrashIcon = TrashIconHeroicon as IconComponent;

// 進捗率計算用のヘルパー関数
const calculateProgress = (
  actionItems: ActionItem[] | undefined
): { completed: number; total: number; percentage: number } => {
  if (!actionItems || actionItems.length === 0) {
    return { completed: 0, total: 0, percentage: 0 };
  }
  const completed = actionItems.filter((item) => item.is_completed).length;
  return {
    completed,
    total: actionItems.length,
    percentage: Math.round((completed / actionItems.length) * 100),
  };
};

const calculateLeafTaskProgress = (
  leafTask: LeafTask
): { completed: number; total: number; percentage: number } => {
  return calculateProgress(leafTask.action_items);
};

const calculateSubTaskProgress = (
  subTask: SubTask
): { completed: number; total: number; percentage: number } => {
  const actionItems =
    subTask.leaf_tasks?.flatMap((lt) => lt.action_items || []) || [];
  return calculateProgress(actionItems);
};

const calculateTaskProgress = (
  subTasks: SubTask[]
): { completed: number; total: number; percentage: number } => {
  const actionItems = subTasks.flatMap(
    (st) => st.leaf_tasks?.flatMap((lt) => lt.action_items || []) || []
  );
  return calculateProgress(actionItems);
};

const ProgressBar = ({ percentage }: { percentage: number }) => (
  <div className="w-full bg-gray-200 rounded-full h-1.5">
    <div
      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-in-out"
      style={{ width: `${percentage}%` }}
    />
  </div>
);

const ProgressDisplay = ({
  progress,
}: {
  progress: { completed: number; total: number; percentage: number };
}) => (
  <div className="mt-2">
    <div className="flex justify-between text-sm text-gray-600 mb-1">
      <span>
        {progress.completed} / {progress.total} 完了
      </span>
      <span>{progress.percentage}%</span>
    </div>
    <ProgressBar percentage={progress.percentage} />
  </div>
);

interface ActionPlanProps {
  tasks: Task[];
  onTaskSelect: (taskId: number | null) => void;
  selectedTaskId: number | null;
}

// ステータスの優先順位を定義
const statusOrder = {
  進行中: 0,
  未着手: 1,
  casual: 2,
  backlog: 3,
  完了: 4,
};

export const ActionPlan = ({
  tasks,
  onTaskSelect,
  selectedTaskId,
}: ActionPlanProps) => {
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [editingSubTaskTitle, setEditingSubTaskTitle] = useState<{
    [key: number]: string;
  }>({});
  const [editingLeafTaskTitle, setEditingLeafTaskTitle] = useState<{
    [key: number]: string;
  }>({});
  const [unsavedChanges, setUnsavedChanges] = useState<{
    [key: number]: { content: string; is_completed: boolean };
  }>({});
  const [deletingSubTaskId, setDeletingSubTaskId] = useState<number | null>(
    null
  );
  const [deletingLeafTaskId, setDeletingLeafTaskId] = useState<number | null>(
    null
  );

  // タスクを並び替え
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const statusDiff =
        statusOrder[a.status as keyof typeof statusOrder] -
        statusOrder[b.status as keyof typeof statusOrder];
      if (statusDiff !== 0) return statusDiff;
      return b.priority - a.priority;
    });
  }, [tasks]);

  useEffect(() => {
    if (selectedTaskId) {
      fetchSubTasks();
    }
  }, [selectedTaskId]);

  const fetchSubTasks = async () => {
    if (!selectedTaskId) return;
    try {
      const data = await api.getSubTasks(selectedTaskId);
      setSubTasks(data);
    } catch (error) {
      console.error("Failed to fetch sub tasks:", error);
    }
  };

  const handleAddSubTask = async () => {
    if (!selectedTaskId) return;
    try {
      const response = await api.createSubTask(selectedTaskId, {
        title: "新しいサブタスク",
        description: "",
      });
      setSubTasks([...subTasks, response]);
    } catch (error) {
      console.error("Failed to add sub task:", error);
    }
  };

  const handleAddLeafTask = async (subTaskId: number) => {
    try {
      const response = await api.createLeafTask(subTaskId, {
        title: "新しいリーフタスク",
        description: "",
      });
      const updatedSubTasks = subTasks.map((st) =>
        st.id === subTaskId
          ? { ...st, leaf_tasks: [...(st.leaf_tasks || []), response] }
          : st
      );
      setSubTasks(updatedSubTasks);
    } catch (error) {
      console.error("Failed to add leaf task:", error);
    }
  };

  const handleAddActionItem = async (leafTaskId: number) => {
    try {
      const response = await api.createActionItem(leafTaskId, {
        content: "",
        is_completed: false,
      });
      const updatedSubTasks = subTasks.map((st) => ({
        ...st,
        leaf_tasks: st.leaf_tasks?.map((lt) =>
          lt.id === leafTaskId
            ? { ...lt, action_items: [...(lt.action_items || []), response] }
            : lt
        ),
      }));
      setSubTasks(updatedSubTasks);
      setUnsavedChanges((prev) => ({
        ...prev,
        [response.id]: {
          content: response.content,
          is_completed: response.is_completed,
        },
      }));
    } catch (error) {
      console.error("Failed to add action item:", error);
    }
  };

  const handleActionItemChange = async (
    actionItem: ActionItem,
    content: string,
    is_completed: boolean
  ) => {
    if (content !== actionItem.content) {
      setUnsavedChanges((prev) => ({
        ...prev,
        [actionItem.id]: {
          content,
          is_completed: actionItem.is_completed,
        },
      }));
    }

    if (is_completed !== actionItem.is_completed) {
      try {
        const response = await api.updateActionItem(actionItem.id, {
          content: content,
          is_completed: is_completed,
        });

        const updatedSubTasks = subTasks.map((st) => ({
          ...st,
          leaf_tasks: st.leaf_tasks?.map((lt) => ({
            ...lt,
            action_items: lt.action_items?.map((ai) =>
              ai.id === actionItem.id ? { ...ai, ...response } : ai
            ),
          })),
        }));
        setSubTasks(updatedSubTasks);
      } catch (error) {
        console.error("Failed to update action item completion status:", error);
        const updatedSubTasks = subTasks.map((st) => ({
          ...st,
          leaf_tasks: st.leaf_tasks?.map((lt) => ({
            ...lt,
            action_items: lt.action_items?.map((ai) =>
              ai.id === actionItem.id
                ? { ...ai, is_completed: !is_completed }
                : ai
            ),
          })),
        }));
        setSubTasks(updatedSubTasks);
      }
    }
  };

  const handleSaveActionItem = async (actionItem: ActionItem) => {
    try {
      const changes = unsavedChanges[actionItem.id];
      if (!changes) return;

      const response = await api.updateActionItem(actionItem.id, changes);

      const updatedSubTasks = subTasks.map((st) => ({
        ...st,
        leaf_tasks: st.leaf_tasks?.map((lt) => ({
          ...lt,
          action_items: lt.action_items?.map((ai) =>
            ai.id === actionItem.id ? { ...ai, ...response } : ai
          ),
        })),
      }));
      setSubTasks(updatedSubTasks);

      const { [actionItem.id]: _, ...remainingChanges } = unsavedChanges;
      setUnsavedChanges(remainingChanges);
    } catch (error) {
      console.error("Failed to update action item:", error);
    }
  };

  const handleKeyDown = (
    e: KeyboardEvent<HTMLTextAreaElement>,
    actionItem: ActionItem
  ) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSaveActionItem(actionItem);
    }
  };

  const adjustTextAreaHeight = (textarea: HTMLTextAreaElement) => {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const handleTextAreaInput = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
    actionItem: ActionItem
  ) => {
    const textarea = e.target;
    adjustTextAreaHeight(textarea);
    handleActionItemChange(
      actionItem,
      textarea.value,
      unsavedChanges[actionItem.id]?.is_completed ?? actionItem.is_completed
    );
    setUnsavedChanges((prev) => ({
      ...prev,
      [actionItem.id]: {
        content: textarea.value,
        is_completed:
          unsavedChanges[actionItem.id]?.is_completed ??
          actionItem.is_completed,
      },
    }));
  };

  const handleSubTaskTitleChange = async (
    subTaskId: number,
    newTitle: string
  ) => {
    try {
      const response = await api.updateSubTask(subTaskId, {
        title: newTitle,
      });
      setSubTasks(
        subTasks.map((st) =>
          st.id === subTaskId ? { ...st, title: response.title } : st
        )
      );
      setEditingSubTaskTitle((prev) => {
        const { [subTaskId]: _, ...rest } = prev;
        return rest;
      });
    } catch (error) {
      console.error("Failed to update sub task title:", error);
    }
  };

  const handleLeafTaskTitleChange = async (
    subTaskId: number,
    leafTaskId: number,
    newTitle: string
  ) => {
    try {
      const response = await api.updateLeafTask(leafTaskId, {
        title: newTitle,
      });
      setSubTasks(
        subTasks.map((st) =>
          st.id === subTaskId
            ? {
                ...st,
                leaf_tasks: st.leaf_tasks?.map((lt) =>
                  lt.id === leafTaskId ? { ...lt, title: response.title } : lt
                ),
              }
            : st
        )
      );
      setEditingLeafTaskTitle((prev) => {
        const { [leafTaskId]: _, ...rest } = prev;
        return rest;
      });
    } catch (error) {
      console.error("Failed to update leaf task title:", error);
    }
  };

  const handleSubTaskKeyDown = (
    e: KeyboardEvent<HTMLDivElement>,
    subTaskId: number,
    title: string
  ) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubTaskTitleChange(subTaskId, title);
    }
  };

  const handleLeafTaskKeyDown = (
    e: KeyboardEvent<HTMLDivElement>,
    subTaskId: number,
    leafTaskId: number,
    title: string
  ) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleLeafTaskTitleChange(subTaskId, leafTaskId, title);
    }
  };

  const handleDeleteActionItem = async (
    leafTaskId: number,
    actionItemId: number
  ) => {
    try {
      await api.deleteActionItem(actionItemId);
      const updatedSubTasks = subTasks.map((st) => ({
        ...st,
        leaf_tasks: st.leaf_tasks?.map((lt) =>
          lt.id === leafTaskId
            ? {
                ...lt,
                action_items: lt.action_items?.filter(
                  (ai) => ai.id !== actionItemId
                ),
              }
            : lt
        ),
      }));
      setSubTasks(updatedSubTasks);

      // 未保存の変更があれば削除
      if (unsavedChanges[actionItemId]) {
        const { [actionItemId]: _, ...remainingChanges } = unsavedChanges;
        setUnsavedChanges(remainingChanges);
      }
    } catch (error) {
      console.error("Failed to delete action item:", error);
    }
  };

  const handleDeleteLeafTask = async (
    subTaskId: number,
    leafTaskId: number
  ) => {
    if (deletingLeafTaskId === leafTaskId) {
      try {
        await api.deleteLeafTask(leafTaskId);
        const updatedSubTasks = subTasks.map((st) =>
          st.id === subTaskId
            ? {
                ...st,
                leaf_tasks: st.leaf_tasks?.filter((lt) => lt.id !== leafTaskId),
              }
            : st
        );
        setSubTasks(updatedSubTasks);
      } catch (error) {
        console.error("Failed to delete leaf task:", error);
      }
      setDeletingLeafTaskId(null);
    } else {
      setDeletingLeafTaskId(leafTaskId);
      // 3秒後に確認状態をリセット
      setTimeout(() => setDeletingLeafTaskId(null), 3000);
    }
  };

  const handleDeleteSubTask = async (subTaskId: number) => {
    if (deletingSubTaskId === subTaskId) {
      try {
        await api.deleteSubTask(subTaskId);
        setSubTasks(subTasks.filter((st) => st.id !== subTaskId));
      } catch (error) {
        console.error("Failed to delete sub task:", error);
      }
      setDeletingSubTaskId(null);
    } else {
      setDeletingSubTaskId(subTaskId);
      // 3秒後に確認状態をリセット
      setTimeout(() => setDeletingSubTaskId(null), 3000);
    }
  };

  const handleAddToDailyPlan = async (
    actionItem: ActionItem,
    subTask: SubTask,
    leafTask: LeafTask
  ) => {
    try {
      // ローカルストレージから既存のアイテムを取得
      const storageKey = "daily-plan-items";
      const savedData = localStorage.getItem(storageKey);
      let storedItems: {
        id: number;
        order: number;
        taskTitle: string;
        subTaskTitle: string;
        leafTaskTitle: string;
      }[] = [];

      if (savedData) {
        storedItems = JSON.parse(savedData);
      }

      // 既に追加済みの場合は追加しない
      if (storedItems.some((item) => item.id === actionItem.id)) {
        alert("このアイテムは既に今日のプランに追加されています。");
        return;
      }

      // 新しいアイテムを作成
      const newItem = {
        id: actionItem.id,
        order: storedItems.length,
        taskTitle: tasks.find((t) => t.id === selectedTaskId)?.title || "",
        subTaskTitle: subTask.title,
        leafTaskTitle: leafTask.title,
      };

      // 配列に追加
      storedItems.push(newItem);

      // ローカルストレージに保存
      localStorage.setItem(storageKey, JSON.stringify(storedItems));
      alert("アクションアイテムが今日のプランに追加されました。");
    } catch (error) {
      console.error("Failed to add to daily plan:", error);
      alert("アクションアイテムの追加に失敗しました。");
    }
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <select
          value={selectedTaskId || ""}
          onChange={(e) =>
            onTaskSelect(e.target.value ? Number(e.target.value) : null)
          }
          className="w-full rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white"
        >
          <option value="">タスクを選択してください</option>
          {sortedTasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title} ({task.status})
            </option>
          ))}
        </select>
      </div>

      {selectedTaskId && (
        <div>
          <div className="flex justify-between items-start mb-8">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                アクションプラン
              </h2>
              {subTasks.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="text-lg font-semibold text-indigo-600">
                    {calculateTaskProgress(subTasks).completed} /{" "}
                    {calculateTaskProgress(subTasks).total}
                  </div>
                  <div className="flex-1">
                    <ProgressDisplay
                      progress={calculateTaskProgress(subTasks)}
                    />
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleAddSubTask}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm transition-all duration-200"
            >
              <PlusIcon className="h-5 w-5 mr-1.5" aria-hidden="true" />
              サブタスクを追加
            </button>
          </div>

          <div
            className={`grid grid-cols-1 ${
              subTasks.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"
            } gap-6`}
          >
            {subTasks.map((subTask) => (
              <div
                key={subTask.id}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-100 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    {editingSubTaskTitle[subTask.id] !== undefined ? (
                      <FormField label="">
                        <input
                          type="text"
                          value={editingSubTaskTitle[subTask.id]}
                          onChange={(e) =>
                            setEditingSubTaskTitle((prev) => ({
                              ...prev,
                              [subTask.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) =>
                            handleSubTaskKeyDown(
                              e,
                              subTask.id,
                              editingSubTaskTitle[subTask.id]
                            )
                          }
                          onBlur={() =>
                            handleSubTaskTitleChange(
                              subTask.id,
                              editingSubTaskTitle[subTask.id]
                            )
                          }
                          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          autoFocus
                        />
                      </FormField>
                    ) : (
                      <div className="w-full">
                        <div className="flex items-center justify-between w-full mb-3">
                          <h3
                            className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-indigo-600 transition-colors flex-1"
                            onClick={() =>
                              setEditingSubTaskTitle((prev) => ({
                                ...prev,
                                [subTask.id]: subTask.title,
                              }))
                            }
                          >
                            {subTask.title}
                          </h3>
                          <button
                            onClick={() => handleDeleteSubTask(subTask.id)}
                            className={`ml-3 p-1.5 rounded-lg transition-all duration-200 ${
                              deletingSubTaskId === subTask.id
                                ? "bg-red-100 text-red-700 hover:bg-red-200"
                                : "text-gray-400 hover:text-red-600 hover:bg-gray-100"
                            }`}
                          >
                            {deletingSubTaskId === subTask.id ? (
                              <span className="flex items-center gap-1 text-sm px-1">
                                <TrashIcon
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                削除する
                              </span>
                            ) : (
                              <TrashIcon
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        </div>
                        <ProgressDisplay
                          progress={calculateSubTaskProgress(subTask)}
                        />
                      </div>
                    )}
                  </div>

                  {subTask.leaf_tasks?.map((leafTask, index) => (
                    <div
                      key={leafTask.id}
                      className="mb-4 rounded-lg bg-gradient-to-br from-emerald-50/50 to-teal-50/50 last:mb-0"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          {editingLeafTaskTitle[leafTask.id] !== undefined ? (
                            <FormField label="">
                              <input
                                type="text"
                                value={editingLeafTaskTitle[leafTask.id]}
                                onChange={(e) =>
                                  setEditingLeafTaskTitle((prev) => ({
                                    ...prev,
                                    [leafTask.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) =>
                                  handleLeafTaskKeyDown(
                                    e,
                                    subTask.id,
                                    leafTask.id,
                                    editingLeafTaskTitle[leafTask.id]
                                  )
                                }
                                onBlur={() =>
                                  handleLeafTaskTitleChange(
                                    subTask.id,
                                    leafTask.id,
                                    editingLeafTaskTitle[leafTask.id]
                                  )
                                }
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                                autoFocus
                              />
                            </FormField>
                          ) : (
                            <div className="w-full">
                              <div className="flex items-center justify-between w-full mb-2">
                                <h4
                                  className="text-sm font-medium text-emerald-800 cursor-pointer hover:text-emerald-600 transition-colors flex-1"
                                  onClick={() =>
                                    setEditingLeafTaskTitle((prev) => ({
                                      ...prev,
                                      [leafTask.id]: leafTask.title,
                                    }))
                                  }
                                >
                                  {leafTask.title}
                                </h4>
                                <button
                                  onClick={() =>
                                    handleDeleteLeafTask(
                                      subTask.id,
                                      leafTask.id
                                    )
                                  }
                                  className={`ml-2 p-1 rounded-lg transition-all duration-200 ${
                                    deletingLeafTaskId === leafTask.id
                                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                                      : "text-gray-400 hover:text-red-600 hover:bg-gray-100"
                                  }`}
                                >
                                  {deletingLeafTaskId === leafTask.id ? (
                                    <span className="flex items-center gap-1 text-xs px-1">
                                      <TrashIcon
                                        className="h-3 w-3"
                                        aria-hidden="true"
                                      />
                                      削除する
                                    </span>
                                  ) : (
                                    <TrashIcon
                                      className="h-3 w-3"
                                      aria-hidden="true"
                                    />
                                  )}
                                </button>
                              </div>
                              <ProgressDisplay
                                progress={calculateLeafTaskProgress(leafTask)}
                              />
                            </div>
                          )}
                        </div>

                        {leafTask.action_items?.map((actionItem) => (
                          <div
                            key={actionItem.id}
                            className="flex items-start gap-3 mb-2 w-full group"
                          >
                            <input
                              type="checkbox"
                              checked={
                                unsavedChanges[actionItem.id]?.is_completed ??
                                actionItem.is_completed
                              }
                              onChange={(e) =>
                                handleActionItemChange(
                                  actionItem,
                                  unsavedChanges[actionItem.id]?.content ??
                                    actionItem.content,
                                  e.target.checked
                                )
                              }
                              className="mt-1.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div className="flex-1">
                              <FormField label="">
                                <textarea
                                  value={
                                    unsavedChanges[actionItem.id]?.content ??
                                    actionItem.content
                                  }
                                  onChange={(e) =>
                                    handleTextAreaInput(e, actionItem)
                                  }
                                  onKeyDown={(e) =>
                                    handleKeyDown(e, actionItem)
                                  }
                                  rows={1}
                                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm resize-none overflow-hidden bg-white/80"
                                  style={{ minHeight: "28px" }}
                                  ref={(el) => {
                                    if (el) {
                                      adjustTextAreaHeight(el);
                                    }
                                  }}
                                />
                                {unsavedChanges[actionItem.id] && (
                                  <p className="mt-1 text-xs text-gray-500">
                                    Ctrl + Enter で保存
                                  </p>
                                )}
                              </FormField>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() =>
                                  handleDeleteActionItem(
                                    leafTask.id,
                                    actionItem.id
                                  )
                                }
                                className="mt-1.5 text-gray-400 hover:text-red-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                                title="削除"
                              >
                                <TrashIcon
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              </button>
                            </div>
                          </div>
                        ))}

                        <button
                          onClick={() => handleAddActionItem(leafTask.id)}
                          className="inline-flex items-center text-sm text-emerald-600 hover:text-emerald-700 mt-2 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          <PlusIcon
                            className="h-4 w-4 mr-1"
                            aria-hidden="true"
                          />
                          アクションアイテムを追加
                        </button>
                      </div>
                    </div>
                  ))}

                  {(!subTask.leaf_tasks || subTask.leaf_tasks.length < 3) && (
                    <button
                      onClick={() => handleAddLeafTask(subTask.id)}
                      className="inline-flex items-center text-sm text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                    >
                      <PlusIcon className="h-4 w-4 mr-1" aria-hidden="true" />
                      リーフタスクを追加
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
