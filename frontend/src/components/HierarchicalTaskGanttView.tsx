"use client";

import React, { useState, useEffect } from "react";
import { Task } from "@/types/task";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { HierarchicalTaskView } from "./HierarchicalTaskView";
import { TaskCalendarView } from "./TaskCalendarView";

export const HierarchicalTaskGanttView: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [isLoading, setIsLoading] = useState(true);

  // タスクの取得
  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("http://localhost:8000/tasks/");
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
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
    <div className="h-full">
      <PanelGroup direction="horizontal">
        <Panel defaultSize={40} minSize={30}>
          <div className="h-full overflow-auto">
            <HierarchicalTaskView 
              tasks={tasks} 
              onUpdate={fetchTasks}
            />
          </div>
        </Panel>
        <PanelResizeHandle className="w-2 hover:bg-gray-200 transition-colors duration-200" />
        <Panel defaultSize={60} minSize={30}>
          <div className="h-full overflow-auto">
            <TaskCalendarView 
              tasks={tasks} 
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}; 