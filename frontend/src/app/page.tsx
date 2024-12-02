'use client'

import { useState, useEffect } from 'react'
import { Tab } from '@headlessui/react'
import Tabs from '../components/Tabs'
import TaskList from '../components/TaskList'
import TaskForm from '../components/TaskForm'
import WorkLogModal from '@/components/WorkLogModal'
import { Task, WorkLog } from '@/types/task'
import { marked } from 'marked'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import MemoList from '../components/MemoList'

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [isWorkLogModalOpen, setIsWorkLogModalOpen] = useState(false)
  const [editingWorkLog, setEditingWorkLog] = useState<WorkLog | undefined>(undefined)

  const fetchTasks = async () => {
    try {
      const response = await fetch('http://localhost:8000/tasks/')
      const data = await response.json()
      setTasks(data)
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  const handleEditWorkLog = (taskId: number, log: WorkLog) => {
    setEditingWorkLog(log)
    setIsWorkLogModalOpen(true)
  }

  const handleDeleteWorkLog = async (taskId: number, logId: number) => {
    if (!confirm('この作業ログを削除してもよろしいですか？')) {
      return
    }

    try {
      const response = await fetch(`http://localhost:8000/tasks/${taskId}/work-logs/${logId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        fetchTasks()
      }
    } catch (error) {
      console.error('Error deleting work log:', error)
    }
  }

  const handleAddWorkLog = (taskId: number) => {
    setEditingWorkLog(undefined)
    setIsWorkLogModalOpen(true)
  }

  const handleSaveWorkLog = async (workLog: Omit<WorkLog, 'id'>) => {
    if (!selectedTaskId) return

    try {
      const url = editingWorkLog
        ? `http://localhost:8000/tasks/${selectedTaskId}/work-logs/${editingWorkLog.id}`
        : `http://localhost:8000/tasks/${selectedTaskId}/work-logs`
      
      const response = await fetch(url, {
        method: editingWorkLog ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workLog),
      })

      if (response.ok) {
        fetchTasks()
        setIsWorkLogModalOpen(false)
      }
    } catch (error) {
      console.error('Error saving work log:', error)
    }
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="py-10">
        <header>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
              BizBuddy
            </h1>
          </div>
        </header>
        <main>
          <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
            <Tabs>
              <Tab.Panel>
                <div className="px-4 py-8 sm:px-0">
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={() => setIsTaskFormOpen(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      新規タスク作成
                    </button>
                  </div>
                  <div className="flex gap-6">
                    <div className="w-3/5">
                      <h2 className="text-lg font-medium text-gray-900 mb-4">タスク一覧</h2>
                      <TaskList 
                        tasks={tasks} 
                        onUpdate={fetchTasks}
                        onTaskSelect={setSelectedTaskId}
                        selectedTaskId={selectedTaskId}
                      />
                    </div>
                    <div className="w-2/5">
                      <h2 className="text-lg font-medium text-gray-900 mb-4">作業ログ</h2>
                      <div className="bg-white shadow rounded-lg p-6">
                        {selectedTaskId ? (
                          <div>
                            {tasks.find(task => task.id === selectedTaskId)?.work_logs?.map(log => (
                              <div key={log.id} className="mb-6 last:mb-0 border-b border-gray-200 last:border-0 pb-4 last:pb-0">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="text-sm text-gray-500">
                                    {format(new Date(log.started_at), 'yyyy/MM/dd HH:mm', { locale: ja })}
                                    {log.ended_at && (
                                      <>
                                        <span className="mx-1">→</span>
                                        {format(new Date(log.ended_at), 'HH:mm', { locale: ja })}
                                      </>
                                    )}
                                  </div>
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => handleEditWorkLog(selectedTaskId, log)}
                                      className="text-xs text-indigo-600 hover:text-indigo-900"
                                    >
                                      編集
                                    </button>
                                    <button
                                      onClick={() => handleDeleteWorkLog(selectedTaskId, log.id)}
                                      className="text-xs text-red-600 hover:text-red-900"
                                    >
                                      削除
                                    </button>
                                  </div>
                                </div>
                                <div 
                                  className="prose prose-sm max-w-none"
                                  dangerouslySetInnerHTML={{ 
                                    __html: marked(log.description.replace(/\n/g, '  \n')) 
                                  }}
                                />
                              </div>
                            ))}
                            <button
                              onClick={() => handleAddWorkLog(selectedTaskId)}
                              className="mt-4 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              作業を記録
                            </button>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-center">タスクを選択してください</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Tab.Panel>
              <Tab.Panel>
                <div className="px-4 py-8 sm:px-0">
                  <MemoList tasks={tasks} onUpdate={fetchTasks} />
                </div>
              </Tab.Panel>
              <Tab.Panel>
                <div className="px-4 py-8 sm:px-0">
                  <div className="rounded-lg border-4 border-dashed border-gray-200 p-4">
                    <p className="text-center text-gray-500">時計機能（開発中）</p>
                  </div>
                </div>
              </Tab.Panel>
              <Tab.Panel>
                <div className="px-4 py-8 sm:px-0">
                  <div className="rounded-lg border-4 border-dashed border-gray-200 p-4">
                    <p className="text-center text-gray-500">マインドマップ機能（開発中）</p>
                  </div>
                </div>
              </Tab.Panel>
              <Tab.Panel>
                <div className="px-4 py-8 sm:px-0">
                  <div className="rounded-lg border-4 border-dashed border-gray-200 p-4">
                    <p className="text-center text-gray-500">プロトタイプ機能（開発中）</p>
                  </div>
                </div>
              </Tab.Panel>
            </Tabs>
          </div>
        </main>
      </div>

      {/* タスク作成モーダル */}
      <TaskForm 
        isOpen={isTaskFormOpen}
        onClose={() => setIsTaskFormOpen(false)}
        onTaskCreated={() => {
          fetchTasks()
          setIsTaskFormOpen(false)
        }}
      />

      {selectedTaskId && (
        <WorkLogModal
          isOpen={isWorkLogModalOpen}
          onClose={() => setIsWorkLogModalOpen(false)}
          onSave={handleSaveWorkLog}
          taskId={selectedTaskId}
          workLog={editingWorkLog}
        />
      )}
    </main>
  )
}
