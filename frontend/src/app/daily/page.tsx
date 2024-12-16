"use client";

import React, { useState, useEffect } from "react";
import { Task } from "@/types/task";
import { DailyTaskScheduler } from "@/components/DailyTaskScheduler";
import { useHierarchicalTasks } from "@/lib/hooks/useHierarchicalTasks";

export default function DailyPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null);

  // タスクの取得
  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("http://localhost:8000/tasks/");
      if (!response.ok) {
        throw new Error("タスクの取得に失敗しました");
      }
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error("タスクの取得中にエラーが発生しました:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 階層型タスクの管理
  const {
    hierarchicalTasks,
    isLoading: isHierarchicalLoading,
    fetchTasks: fetchHierarchicalTasks,
  } = useHierarchicalTasks(tasks);

  useEffect(() => {
    const initialFetch = async () => {
      await fetchTasks();
    };
    initialFetch();
  }, []);

  // 通常のタスクが更新されたら階層型タスクも更新
  useEffect(() => {
    if (tasks.length > 0) {
      fetchHierarchicalTasks();
    }
  }, [tasks]);

  // フォーカスモードのキーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      
      // Ctrl + (Alt) + F でフォーカスモードを切り替え
      if (e.ctrlKey && (isMac ? !e.altKey : e.altKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        e.stopPropagation();
        
        const dailyTasks = hierarchicalTasks.filter(task => task.scheduled_for_today);
        if (dailyTasks.length > 0) {
          setFocusedTaskId(focusedTaskId ? null : dailyTasks[0].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [hierarchicalTasks, focusedTaskId]);

  if (isLoading || isHierarchicalLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <DailyTaskScheduler
          tasks={hierarchicalTasks.map(task => ({
            ...task,
            status: task.is_completed ? "完了" : "未着手",
            motivation: 0,
            priority: task.priority || 0,
            priority_score: 0,
            motivation_score: 0,
            last_updated: new Date().toISOString(),
            description: task.description || ""
          }))}
          onUpdate={async () => {
            await fetchTasks();
            await fetchHierarchicalTasks();
          }}
          focusedTaskId={focusedTaskId}
          setFocusedTaskId={setFocusedTaskId}
        />
      </div>
    </div>
  );
} 