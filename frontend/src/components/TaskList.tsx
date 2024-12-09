'use client'

import React, { useState } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Task, WorkLog } from '@/types/task'
import TaskEditModal from './TaskEditModal'
import WorkLogModal from './WorkLogModal'
import { marked } from 'marked'

interface TaskListProps {
  tasks: Task[]
  onUpdate: () => void
  onTaskSelect: (taskId: number) => void
  selectedTaskId: number | null
}

export default function TaskList({ tasks, onUpdate, onTaskSelect, selectedTaskId }: TaskListProps) {
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isWorkLogModalOpen, setIsWorkLogModalOpen] = useState(false)
  const [editingWorkLog, setEditingWorkLog] = useState<WorkLog | undefined>(undefined)
  const [currentTaskId, setCurrentTaskId] = useState<number | null>(null)

  if (!tasks) {
    return <div>Loading...</div>
  }

  // ステータスの優先順位を定義
  const statusOrder = {
    '進行中': 0,
    '未着手': 1,
    'casual': 2,
    'backlog': 3,
    '完了': 4
  }

  // ステータスの��示名マッピング
  const statusDisplay: { [key: string]: string } = {
    '進行中': '進行中',
    'casual': 'casual',
    '未着手': '未着手',
    'backlog': 'backlog',
    '完了': '完了'
  };

  // タスクを並び替え
  const sortedTasks = [...tasks].sort((a, b) => {
    // まずステータスで並び替え
    const statusDiff = statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder]
    if (statusDiff !== 0) return statusDiff

    // 同じステータス内では優先度の降順で並び替え
    return b.priority - a.priority
  })

  const handleDelete = async (taskId: number) => {
    if (!confirm('このタスクを削除してもよろしいですか？')) {
      return
    }

    try {
      const response = await fetch(`http://localhost:8000/tasks/${taskId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        onUpdate()
      }
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const handleEdit = (task: Task) => {
    setEditingTask(task)
    setIsEditModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsEditModalOpen(false)
    setEditingTask(null)
  }

  const handleSaveWorkLog = async (workLog: Omit<WorkLog, 'id'>) => {
    if (!currentTaskId) return

    try {
      const url = editingWorkLog
        ? `http://localhost:8000/tasks/${currentTaskId}/work-logs/${editingWorkLog.id}`
        : `http://localhost:8000/tasks/${currentTaskId}/work-logs`
      
      const response = await fetch(url, {
        method: editingWorkLog ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workLog),
      })

      if (response.ok) {
        onUpdate()
      }
    } catch (error) {
      console.error('Error saving work log:', error)
    }
  }

  const handleEditWorkLog = (taskId: number, workLog: WorkLog) => {
    setCurrentTaskId(taskId)
    setEditingWorkLog(workLog)
    setIsWorkLogModalOpen(true)
  }

  const handleDeleteWorkLog = async (taskId: number, workLogId: number) => {
    if (!confirm('この作業ログを削除してもよろしいですか？')) {
      return
    }

    try {
      const response = await fetch(`http://localhost:8000/tasks/${taskId}/work-logs/${workLogId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        onUpdate()
      }
    } catch (error) {
      console.error('Error deleting work log:', error)
    }
  }

  const handleAddWorkLog = (taskId: number) => {
    setCurrentTaskId(taskId)
    setEditingWorkLog(undefined)
    setIsWorkLogModalOpen(true)
  }

  const handleUpdateTask = async (taskId: number, updates: Partial<Task>) => {
    try {
      const response = await fetch(`http://localhost:8000/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...tasks.find(t => t.id === taskId),
          ...updates,
          last_updated: new Date().toISOString()
        }),
      })
      if (response.ok) {
        onUpdate()
      }
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }

  return (
    <div>
      <div>
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <div className="overflow-auto max-h-[calc(100vh-12rem)]">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th scope="col" className="py-2 pl-2 pr-2 text-left text-sm font-semibold text-gray-900">
                    タイトル
                  </th>
                  <th scope="col" className="px-2 py-2 text-left text-sm font-semibold text-gray-900">
                    優先度
                  </th>
                  <th scope="col" className="px-2 py-2 text-left text-sm font-semibold text-gray-900">
                    🎖 
                  </th>
                  <th scope="col" className="px-2 py-2 text-left text-sm font-semibold text-gray-900">
                    ステータス
                  </th>
                  <th scope="col" className="w-16 px-2 py-2 text-center text-sm font-semibold text-gray-900">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {sortedTasks.map((task, index) => (
                  <React.Fragment key={task.id}>
                    <tr
                      onClick={() => onTaskSelect(task.id)}
                      className={`
                        ${selectedTaskId === task.id 
                          ? task.status === '進行中'
                              ? 'bg-amber-100'
                              : task.status === '完了'
                                ? 'bg-emerald-100'
                                : 'bg-gray-50'
                          : task.status === '進行中'
                            ? 'bg-amber-50 hover:bg-amber-100'
                            : task.status === '完了'
                              ? 'bg-emerald-50 hover:bg-emerald-100'
                              : 'bg-white hover:bg-gray-50'
                        }
                        cursor-pointer
                      `}
                    >
                      <td className="whitespace-normal py-2 pl-2 pr-2 text-sm font-medium text-gray-900">
                        {index < 9 && (
                          <span className="inline-flex items-center justify-center w-4 mr-2 text-xs font-medium text-gray-400">
                            {index + 1}
                          </span>
                        )}
                        {task.title}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-sm text-gray-500">
                        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                          <span className="w-8 text-center">{task.priority}</span>
                          <div className="flex flex-col ml-1">
                            <button
                              onClick={() => handleUpdateTask(task.id, { priority: Math.min(100, task.priority + 5) })}
                              className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-t px-1 text-xs"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => handleUpdateTask(task.id, { priority: Math.max(1, task.priority - 5) })}
                              className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-b px-1 text-xs"
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-sm text-gray-500">
                        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                          <span className="w-8 text-center">{task.motivation}</span>
                          <div className="flex flex-col ml-1">
                            <button
                              onClick={() => handleUpdateTask(task.id, { motivation: Math.min(100, task.motivation + 5) })}
                              className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-t px-1 text-xs"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => handleUpdateTask(task.id, { motivation: Math.max(1, task.motivation - 5) })}
                              className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-b px-1 text-xs"
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-sm text-gray-500">
                        <select
                          value={task.status}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleUpdateTask(task.id, { status: e.target.value });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="border-0 bg-transparent"
                        >
                          <option value="未着手">todo</option>
                          <option value="進行中">in progress</option>
                          <option value="casual">casual</option>
                          <option value="backlog">backlog</option>
                          <option value="完了">done</option>
                        </select>
                      </td>
                      <td className="relative whitespace-nowrap py-2 pl-2 pr-2 text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(task);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(task.id);
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                    {selectedTaskId === task.id && (
                      <tr>
                        <td colSpan={5} className="px-2 py-4 bg-gray-50">
                          <div className="text-sm text-gray-500 mb-2">
                            <div className="flex space-x-4 mb-2">
                              <div>
                                <span className="font-medium">作成日:</span>{' '}
                                {task.created_at ? format(new Date(task.created_at), 'yyyy/MM/dd HH:mm', { locale: ja }) : '-'}
                              </div>
                              <div>
                                <span className="font-medium">期限:</span>{' '}
                                {task.deadline ? format(new Date(task.deadline), 'yyyy/MM/dd', { locale: ja }) : '-'}
                              </div>
                            </div>
                          </div>
                          {task.description && (
                            <div 
                              className="prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ 
                                __html: marked.parse(task.description, { breaks: true }) 
                              }} 
                            />
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          isOpen={isEditModalOpen}
          onClose={handleCloseModal}
          onUpdate={onUpdate}
        />
      )}

      {currentTaskId && (
        <WorkLogModal
          taskId={currentTaskId}
          isOpen={isWorkLogModalOpen}
          onClose={() => setIsWorkLogModalOpen(false)}
          onSave={handleSaveWorkLog}
          workLog={editingWorkLog}
        />
      )}
    </div>
  )
} 
