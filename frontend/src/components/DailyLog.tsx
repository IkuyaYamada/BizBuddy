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
    <div className="flex gap-3 items-start group">
      {/* ドラッグ可能な本体部分 */}
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`flex-1 bg-white rounded-xl border transition-all duration-300 cursor-move
          ${item.is_completed 
            ? 'border-green-200 shadow-sm hover:shadow-md hover:shadow-green-100' 
            : 'border-blue-200 shadow-md hover:shadow-lg hover:shadow-blue-100'}`}
      >
        <div className="p-4">
          {/* パンくずリスト風の階層表示 */}
          <div className="flex items-center gap-2 text-sm text-indigo-500 mb-3">
            <span className="font-medium">{item.taskTitle}</span>
            <svg className="w-3 h-3 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-medium">{item.subTaskTitle}</span>
            <svg className="w-3 h-3 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-medium">{item.leafTaskTitle}</span>
          </div>
          {/* タスク内容 */}
          <div className={`text-base transition-all duration-300 ${
            item.is_completed 
              ? 'line-through text-green-600 font-medium' 
              : 'text-gray-900'
          }`}>
            {item.content}
          </div>
        </div>
      </div>

      {/* 操作ボタン領域（ドラッグ不可） */}
      <div className="flex flex-col items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
        <button
          onClick={() => {
            onToggleComplete(id, item.is_completed);
          }}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
            item.is_completed
              ? 'bg-green-100 text-green-600 hover:bg-green-200'
              : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
          }`}
          title={item.is_completed ? "完了を取り消す" : "完了にする"}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <button
          onClick={() => {
            onDelete(id);
          }}
          className="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-all duration-300"
          title="削除"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
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
  const [isSelectionOpen, setIsSelectionOpen] = useState(false);

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
    if (!initialLoadDone) {
      const savedData = localStorage.getItem(storageKey);
      if (!savedData) {
        setInitialLoadDone(true);
        return;
      }

      setIsLoading(true);
      try {
        const storedItems: StorageItem[] = JSON.parse(savedData);
        
        // 各アイテムの最新情報をAPIから取得（重複を防ぐため、一度だけ実行）
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
        setInitialLoadDone(true);
      } catch (error) {
        console.error('Failed to restore items:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [initialLoadDone]);

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

      // APIをび出してステータスを更新
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
      {/* タスク選択ドロワー */}
      <div className="fixed bottom-4 right-4 z-[100]">
        <button
          onClick={() => setIsSelectionOpen(!isSelectionOpen)}
          className="bg-white rounded-full w-12 h-12 shadow-lg flex items-center justify-center text-indigo-600 hover:bg-indigo-50 transition-colors"
          title={isSelectionOpen ? "選択パネルを閉じる" : "タスクを追加"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 transition-transform duration-300 ${isSelectionOpen ? 'rotate-45' : ''}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
      </div>

      <div className={`fixed right-4 bottom-20 bg-white rounded-lg shadow-xl transition-all duration-300 transform origin-bottom-right z-[100] ${
        isSelectionOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
      }`} style={{ width: '420px', maxHeight: 'calc(100vh - 180px)' }}>
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          <div className="space-y-6">
            {/* タスク選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">タスク</label>
              <select
                value={selectedTaskId || ''}
                onChange={(e) => handleTaskSelect(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">タスクを選択</option>
                {sortedTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title} ({task.status})
                  </option>
                ))}
              </select>
            </div>

            {/* サブタスク選択 */}
            {selectedTaskId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">サブタスク</label>
                <div className="space-y-1 max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-gray-50">
                  {isLoading ? (
                    <p className="text-sm text-gray-500 p-3">読み込み中...</p>
                  ) : (
                    <>
                      {selectedSubTasks.map(subTask => (
                        <button
                          key={subTask.id}
                          onClick={() => handleSubTaskSelect(subTask.id)}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                            selectedSubTaskId === subTask.id
                              ? 'bg-indigo-100 text-indigo-800 font-medium'
                              : 'hover:bg-white'
                          }`}
                        >
                          {subTask.title}
                        </button>
                      ))}
                      {selectedTaskId && selectedSubTasks.length === 0 && (
                        <p className="text-sm text-gray-500 p-3">サブタスクがありません</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* アクションアイテム選択 */}
            {selectedSubTaskId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">アクションアイテム</label>
                <div className="space-y-4 max-h-[280px] overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-3">
                  {selectedSubTasks
                    .find(st => st.id === selectedSubTaskId)
                    ?.leaf_tasks?.map(leafTask => (
                      <div key={leafTask.id} className="space-y-2">
                        {/* リーフタスク名 */}
                        <div className="text-xs font-medium text-emerald-600 px-2 flex items-center gap-2 bg-emerald-50 py-1.5 rounded-md">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                          </svg>
                          {leafTask.title}
                        </div>
                        {/* そのリーフタスクに属するアクションアイテム */}
                        <div className="space-y-1 pl-4 border-l-2 border-emerald-100">
                          {leafTask.action_items?.map(actionItem => (
                            <div
                              key={actionItem.id}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-white rounded-md transition-colors"
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
                                className="h-4 w-4 text-emerald-600 rounded border-gray-300"
                              />
                              <span className={`text-sm flex-1 ${actionItem.is_completed ? 'line-through text-gray-500' : ''}`}>
                                {actionItem.content}
                              </span>
                              <button
                                onClick={() => handleAddToPlan(actionItem)}
                                className="text-sm text-emerald-600 hover:text-emerald-800 bg-white hover:bg-emerald-50 px-3 py-1 rounded-md transition-colors"
                              >
                                追加
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  {selectedSubTaskId && (!selectedSubTasks.find(st => st.id === selectedSubTaskId)?.leaf_tasks?.length || 
                    !selectedSubTasks.find(st => st.id === selectedSubTaskId)?.leaf_tasks?.some(lt => lt.action_items?.length)) && (
                    <p className="text-sm text-gray-500 text-center py-4">アクションアイテムがありません</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg p-6 border border-blue-100">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="text-2xl font-bold text-indigo-900 mb-2">
              今日のチャレンジ
            </h3>
            <p className="text-indigo-600">
              {format(selectedDate, 'yyyy年M月d日 (E)', { locale: ja })}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-indigo-600 mb-1">
              {dailyPlanItems.filter(item => item.is_completed).length} / {dailyPlanItems.length}
            </div>
            <div className="text-sm text-indigo-500">完了タスク</div>
          </div>
        </div>

        {/* プログレスバー */}
        <div className="mb-8">
          <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out"
              style={{
                width: `${dailyPlanItems.length > 0
                  ? (dailyPlanItems.filter(item => item.is_completed).length / dailyPlanItems.length) * 100
                  : 0}%`
              }}
            />
          </div>
        </div>

        <div className="relative">
          {/* 時系列を示す縦線（グラデーション） */}
          <div className="absolute left-2 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-full" />
          
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={dailyPlanItems.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-6">
                {dailyPlanItems.map((item, index) => (
                  <div key={item.id} className="relative animate-fadeIn">
                    {/* 時間マーカー */}
                    <div className={`absolute left-0 -translate-x-1/2 w-5 h-5 rounded-full border-2 z-10 transition-all duration-300
                      ${item.is_completed 
                        ? 'bg-gradient-to-r from-green-400 to-green-500 border-green-400 shadow-lg shadow-green-200' 
                        : 'bg-white border-blue-400'}`}
                    />
                    {/* 時間表示 */}
                    <div className="absolute left-8 top-0 text-sm font-medium text-indigo-600">
                      {format(new Date(), 'HH:mm')}
                    </div>
                    {/* アイテム本体 */}
                    <div className="ml-16">
                      <SortableItem
                        id={item.id}
                        item={item}
                        onToggleComplete={handleToggleComplete}
                        onDelete={handleDeleteItem}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {dailyPlanItems.length === 0 && (
            <div className="relative py-12">
              <div className="absolute left-0 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 border-gray-300" />
              <div className="ml-16 text-center">
                <p className="text-lg text-indigo-900 font-medium mb-2">今日のチャレンジを設定しよう！</p>
                <p className="text-indigo-600">
                  右下の＋ボタンからタスクを選んでください
                </p>
              </div>
            </div>
          )}
        </div>

        {/* モチベーショナルメッセージ */}
        {dailyPlanItems.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-indigo-600 font-medium">
              {dailyPlanItems.every(item => item.is_completed)
                ? '🎉 素晴らしい！今日のチャレンジを全て達成しました！'
                : `💪 あと${dailyPlanItems.length - dailyPlanItems.filter(item => item.is_completed).length}個のタスクで目標達成！`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}; 