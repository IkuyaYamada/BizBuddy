'use client'

import React, { useState } from 'react'
import { format, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns'
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

function formatRemainingTime(deadline: string): string {
  const now = new Date()
  const deadlineDate = new Date(deadline)
  
  if (deadlineDate < now) {
    return '期限切れ'
  }

  const days = differenceInDays(deadlineDate, now)
  const hours = differenceInHours(deadlineDate, now) % 24
  const minutes = differenceInMinutes(deadlineDate, now) % 60

  const parts = []
  if (days > 0) parts.push(`${days}日`)
  if (hours > 0) parts.push(`${hours}時間`)
  if (minutes > 0) parts.push(`${minutes}分`)
  
  return parts.length > 0 ? parts.join(' ') : '1分未満'
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
    '完了': 2
  }

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

  const handleOpenWorkLogModal = (taskId: number) => {
    const now = new Date()
    setCurrentTaskId(taskId)
    setEditingWorkLog({
      description: '',
      started_at: now.toISOString(),
      id: 0
    })
    setIsWorkLogModalOpen(true)
  }

  return (
    <div>
      <div className="mt-4">
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="py-3.5 pl-2 pr-2 text-left text-sm font-semibold text-gray-900">
                  タイトル
                </th>
                <th scope="col" className="px-2 py-3.5 text-left text-sm font-semibold text-gray-900">
                  優先度
                </th>
                <th scope="col" className="px-2 py-3.5 text-left text-sm font-semibold text-gray-900">
                  🎖 
                </th>
                <th scope="col" className="px-2 py-3.5 text-left text-sm font-semibold text-gray-900">
                  作成日
                </th>
                <th scope="col" className="px-2 py-3.5 text-left text-sm font-semibold text-gray-900">
                  残り時間
                </th>
                <th scope="col" className="px-2 py-3.5 text-left text-sm font-semibold text-gray-900">
                  ステータス
                </th>
                <th scope="col" className="px-2 py-3.5 text-left text-sm font-semibold text-gray-900">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {sortedTasks.map((task) => (
                <React.Fragment key={task.id}>
                  <tr
                    onClick={() => onTaskSelect(task.id)}
                    className={`hover:bg-gray-50 ${selectedTaskId === task.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="whitespace-normal py-2 pl-2 pr-2 text-sm font-medium text-gray-900">
                      {task.title}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-sm text-gray-500">
                      {task.priority}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-sm text-gray-500">
                      {task.motivation}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-sm text-gray-500">
                      {task.created_at ? format(new Date(task.created_at), 'yyyy/MM/dd HH:mm', { locale: ja }) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-sm text-gray-500">
                      {task.deadline ? formatRemainingTime(task.deadline) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-sm text-gray-500">
                      {task.status}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-sm text-gray-500">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(task);
                        }}
                        className="text-indigo-600 hover:text-indigo-900 mr-2"
                      >
                        編集
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(task.id);
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                  {selectedTaskId === task.id && (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 bg-gray-50">
                        <div 
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ 
                            __html: marked(task.description.replace(/\n/g, '  \n')) 
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TaskEditModal
        task={editingTask}
        isOpen={isEditModalOpen}
        onClose={handleCloseModal}
        onUpdate={onUpdate}
      />

      {currentTaskId && (
        <WorkLogModal
          isOpen={isWorkLogModalOpen}
          onClose={() => setIsWorkLogModalOpen(false)}
          onSave={handleSaveWorkLog}
          taskId={currentTaskId}
          workLog={editingWorkLog}
        />
      )}
    </div>
  )
} 
