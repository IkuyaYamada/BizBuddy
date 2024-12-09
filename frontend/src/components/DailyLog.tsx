'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Task, SubTask, LeafTask, ActionItem } from '@/types/task';
import * as api from '@/lib/api';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DailyLogProps {
  tasks: Task[];
  selectedDate?: Date;
}

// ステータスの優先順位を定義
const statusOrder = {
  '進行中': 0,
  '未着手': 1,
  'casual': 2,
  'backlog': 3,
  '完了': 4
};

interface DailyPlanItem extends ActionItem {
  taskTitle: string;
  subTaskTitle: string;
  leafTaskTitle: string;
}

function SortableItem({
  id,
  item,
  onToggleComplete,
  onDelete
}: {
  id: number;
  item: DailyPlanItem;
  onToggleComplete: (id: number, currentStatus: boolean) => Promise<void>;
  onDelete: (id: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div className="flex gap-2 items-center">
      {/* ドラッグ可能な本体部分 */}
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="flex-1 flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-move"
      >
        <div className="flex-1">
          <div className="text-sm text-gray-500">
            {item.taskTitle} / {item.subTaskTitle} / {item.leafTaskTitle}
          </div>
          <div className={item.is_completed ? 'line-through text-gray-500' : ''}>
            {item.content}
          </div>
        </div>
      </div>

      {/* 操作ボタン領域（ドラッグ不可） */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={item.is_completed}
          onChange={() => {
            console.log('Toggle complete for item:', id, 'current status:', item.is_completed);
            onToggleComplete(id, item.is_completed);
          }}
          className="h-4 w-4 text-blue-600 rounded border-gray-300"
        />
        <button
          onClick={() => {
            console.log('Delete clicked for item:', id);
            onDelete(id);
          }}
          className="text-sm text-red-600 hover:text-red-800 px-3 py-2 rounded hover:bg-red-50"
        >
          削除
        </button>
      </div>
    </div>
  );
}

interface StorageItem {
  id: number;
  order: number;
  taskTitle: string;
  subTaskTitle: string;
  leafTaskTitle: string;
}

export const DailyLog = ({ tasks, selectedDate = new Date() }: DailyLogProps) => {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedSubTasks, setSelectedSubTasks] = useState<SubTask[]>([]);
  const [selectedSubTaskId, setSelectedSubTaskId] = useState<number | null>(null);
  const [selectedActionItems, setSelectedActionItems] = useState<ActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dailyPlanItems, setDailyPlanItems] = useState<DailyPlanItem[]>([]);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // タスクを並び替え
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const statusDiff = statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder];
      if (statusDiff !== 0) return statusDiff;
      return b.priority - a.priority;
    });
  }, [tasks]);

  // タスク選択時の処理
  const handleTaskSelect = useCallback(async (taskId: number | null) => {
    if (selectedTaskId === taskId) return;
    
    setSelectedTaskId(taskId);
    setSelectedSubTaskId(null);
    setSelectedActionItems([]);

    if (!taskId) {
      setSelectedSubTasks([]);
      return;
    }

    setIsLoading(true);
    try {
      const subTasks = await api.getSubTasks(taskId);
      setSelectedSubTasks(subTasks);
    } catch (error) {
      console.error('Failed to fetch sub tasks:', error);
      setSelectedSubTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTaskId]);

  // サブタスク選択時の処理
  const handleSubTaskSelect = useCallback((subTaskId: number) => {
    setSelectedSubTaskId(subTaskId);
    const subTask = selectedSubTasks.find(st => st.id === subTaskId);
    const actionItems = subTask?.leaf_tasks?.flatMap(lt => lt.action_items || []) || [];
    setSelectedActionItems(actionItems);
  }, [selectedSubTasks]);

  // アクションアイテムをデイリープランに追加
  const handleAddToPlan = async (actionItem: ActionItem) => {
    const task = tasks.find(t => t.id === selectedTaskId);
    const subTask = selectedSubTasks.find(st => st.id === selectedSubTaskId);
    const leafTask = subTask?.leaf_tasks?.find(lt => 
      lt.action_items?.some(ai => ai.id === actionItem.id)
    );

    if (!task || !subTask || !leafTask) return;

    // 既に追加済みの場合は追加しない
    if (dailyPlanItems.some(item => item.id === actionItem.id)) return;

    // 新しいアイテムを作成
    const newItem: DailyPlanItem = {
      ...actionItem,
      taskTitle: task.title,
      subTaskTitle: subTask.title,
      leafTaskTitle: leafTask.title
    };

    // 状態を更新
    const updatedItems = [...dailyPlanItems, newItem];
    setDailyPlanItems(updatedItems);

    // ローカルストレージに保存
    const itemsToSave = updatedItems.map((item, index) => ({
      id: item.id,
      order: index,
      taskTitle: item.taskTitle,
      subTaskTitle: item.subTaskTitle,
      leafTaskTitle: item.leafTaskTitle,
    }));
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(itemsToSave));
      console.log('Saved to storage:', itemsToSave);
    } catch (error) {
      console.error('Failed to save to storage:', error);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const storageKey = 'daily-plan-items';

  // 保存された情報を復元
  const restoreItems = useCallback(async () => {
    const savedData = localStorage.getItem(storageKey);
    if (!savedData) return;

    setIsLoading(true);
    try {
      const storedItems: StorageItem[] = JSON.parse(savedData);
      
      // 各アイテムの最新情報をAPIから取得
      const results = await Promise.allSettled(
        storedItems.map(item => api.getActionPlan(item.id))
      );
      
      // 成功したアイテムのみを抽出し、ストレージの情報と結合
      const successfulItems = results
        .map((result, index) => {
          if (result.status === 'fulfilled') {
            const apiData = result.value;
            const storedData = storedItems[index];
            return {
              ...apiData,
              taskTitle: storedData.taskTitle,
              subTaskTitle: storedData.subTaskTitle,
              leafTaskTitle: storedData.leafTaskTitle,
            };
          }
          return null;
        })
        .filter((item): item is DailyPlanItem => item !== null);

      // 404エラーのアイテムをストレージから削除
      const newStoredItems = storedItems.filter((_, index) => 
        results[index].status === 'fulfilled'
      );
      localStorage.setItem(storageKey, JSON.stringify(newStoredItems));

      // 保存された順序でソート
      const sortedItems = successfulItems.sort((a, b) => {
        const orderA = storedItems.find(item => item.id === a.id)?.order ?? Number.MAX_SAFE_INTEGER;
        const orderB = storedItems.find(item => item.id === b.id)?.order ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });

      setDailyPlanItems(sortedItems);
    } catch (error) {
      console.error('Failed to restore items:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreItems();
  }, [restoreItems]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id && over?.id && active.id !== over.id) {
      setDailyPlanItems((items) => {
        const oldIndex = items.findIndex(item => String(item.id) === String(active.id));
        const newIndex = items.findIndex(item => String(item.id) === String(over.id));
        
        if (oldIndex === -1 || newIndex === -1) {
          return items;
        }

        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // 順序と階層名のみをローカルストレージに保存
        const itemsToSave = newItems.map((item, index) => ({
          id: item.id,
          order: index,
          taskTitle: item.taskTitle,
          subTaskTitle: item.subTaskTitle,
          leafTaskTitle: item.leafTaskTitle,
        }));
        
        try {
          localStorage.setItem(storageKey, JSON.stringify(itemsToSave));
        } catch (error) {
          console.error('Failed to save items:', error);
        }
        
        return newItems;
      });
    }
  };

  // アイテムを削除（ローカルストレージからのみ）
  const handleDeleteItem = (itemId: number) => {
    console.log('Deleting item:', itemId);
    try {
      // ローカルストレージから現在の保存データを取得
      const savedData = localStorage.getItem(storageKey);
      console.log('Current storage data:', savedData);
      
      if (savedData) {
        const items = JSON.parse(savedData);
        console.log('Parsed items:', items);
        
        // 指定されたIDのアイテムを削除
        const updatedItems = items.filter((item: StorageItem) => {
          console.log('Checking item:', item.id, 'against:', itemId);
          return item.id !== itemId;
        });
        console.log('Updated items:', updatedItems);
        
        localStorage.setItem(storageKey, JSON.stringify(updatedItems));
        console.log('Saved to storage');
      }

      // 表示も更新
      setDailyPlanItems(prev => {
        console.log('Updating display items, current:', prev);
        return prev.filter(item => item.id !== itemId);
      });
    } catch (error) {
      console.error('Failed to delete item from storage:', error);
    }
  };

  // アイテムの完了状態を切り替え
  const handleToggleComplete = async (itemId: number, currentStatus: boolean) => {
    try {
      const targetItem = dailyPlanItems.find(item => item.id === itemId);
      if (!targetItem) return;

      // APIを呼び出してステータスを更新
      const updatedItem = await api.updateActionItem(itemId, {
        content: targetItem.content,
        is_completed: !currentStatus
      });

      // ローカルの状態を更新
      const updatedItems = dailyPlanItems.map(item =>
        item.id === itemId
          ? {
              ...item,
              is_completed: updatedItem.is_completed
            }
          : item
      );

      setDailyPlanItems(updatedItems);
    } catch (error) {
      console.error('Failed to update action item status:', error);
    }
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          {format(selectedDate, 'yyyy年M月d日 (E)', { locale: ja })}のプラン
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {/* タスク選択 */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-4">タスク</h3>
          <select
            value={selectedTaskId || ''}
            onChange={(e) => handleTaskSelect(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="">タスクを選択してください</option>
            {sortedTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title} ({task.status})
              </option>
            ))}
          </select>
        </div>

        {/* サブタスク一覧 */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-4">サブタスク</h3>
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-gray-500 text-sm">読み込み中...</p>
            ) : (
              <>
                {selectedSubTasks.map(subTask => (
                  <button
                    key={subTask.id}
                    onClick={() => handleSubTaskSelect(subTask.id)}
                    className={`w-full text-left px-3 py-2 rounded ${
                      selectedSubTaskId === subTask.id
                        ? 'bg-blue-100 text-blue-800'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {subTask.title}
                  </button>
                ))}
                {selectedTaskId && selectedSubTasks.length === 0 && (
                  <p className="text-gray-500 text-sm">サブタスクがありません</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* アクションアイテム一覧 */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-medium mb-4">アクションアイテム</h3>
          <div className="space-y-2">
            {selectedActionItems.map(actionItem => (
              <div
                key={actionItem.id}
                className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100"
              >
                <input
                  type="checkbox"
                  checked={actionItem.is_completed}
                  onChange={async () => {
                    try {
                      await api.updateActionItem(actionItem.id, {
                        content: actionItem.content,
                        is_completed: !actionItem.is_completed
                      });
                      setSelectedActionItems(prev =>
                        prev.map(item =>
                          item.id === actionItem.id
                            ? { ...item, is_completed: !item.is_completed }
                            : item
                        )
                      );
                    } catch (error) {
                      console.error('Failed to update action item:', error);
                    }
                  }}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300"
                />
                <span className={actionItem.is_completed ? 'line-through text-gray-500' : ''}>
                  {actionItem.content}
                </span>
                <button
                  onClick={() => handleAddToPlan(actionItem)}
                  className="ml-auto text-sm text-blue-600 hover:text-blue-800"
                >
                  追加
                </button>
              </div>
            ))}
            {selectedSubTaskId && selectedActionItems.length === 0 && (
              <p className="text-gray-500 text-sm">アクションアイテムがありません</p>
            )}
          </div>
        </div>
      </div>

      {/* デイリープラン */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium mb-4">今日のプラン</h3>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={dailyPlanItems.map(item => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {dailyPlanItems.map((item) => (
                <SortableItem
                  key={item.id}
                  id={item.id}
                  item={item}
                  onToggleComplete={handleToggleComplete}
                  onDelete={handleDeleteItem}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {dailyPlanItems.length === 0 && (
          <p className="text-gray-500 text-sm text-center">プランが空です</p>
        )}
      </div>
    </div>
  );
}; 