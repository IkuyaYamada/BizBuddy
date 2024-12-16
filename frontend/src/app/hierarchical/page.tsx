"use client";

import React, { useState, useEffect } from "react";
import { Task } from "@/types/task";
import { HierarchicalTaskView } from "@/components/HierarchicalTaskView";

export default function HierarchicalPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    fetchTasks();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <HierarchicalTaskView tasks={tasks} onUpdate={fetchTasks} />
      </div>
    </div>
  );
} 