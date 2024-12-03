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
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import Timer from '../components/Timer'

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

  const handleTaskSelect = (taskId: number) => {
    setSelectedTaskId(selectedTaskId === taskId ? null : taskId);
  };

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="py-10 px-4">
        <header>
          <div className="mx-auto">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
                BizBuddy
              </h1>
              <Timer />
            </div>
          </div>
        </header>
        <main>
          <div className="mx-auto">
            <Tabs>
              <Tab.Panel>
                <div className="py-6">
                  <PanelGroup direction="horizontal">
                    <Panel defaultSize={40} minSize={30}>
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h2 className="text-lg font-medium text-gray-900">タスク一覧</h2>
                          <button
                            onClick={() => setIsTaskFormOpen(true)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            新規タスク作成
                          </button>
                        </div>
                        <TaskList 
                          tasks={tasks} 
                          onUpdate={fetchTasks}
                          onTaskSelect={handleTaskSelect}
                          selectedTaskId={selectedTaskId}
                        />
                      </div>
                    </Panel>

                    <PanelResizeHandle className="w-2 hover:bg-gray-200 transition-colors duration-200" />

                    <Panel defaultSize={60} minSize={30}>
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h2 className="text-lg font-medium text-gray-900">作業ログ</h2>
                        </div>
                        <div className="bg-white shadow rounded-lg p-6">
                          {selectedTaskId ? (
                            <div>
                              <div className="mb-6 border-b border-gray-200 pb-6">
                                <form onSubmit={(e) => {
                                  e.preventDefault();
                                  const form = e.target as HTMLFormElement;
                                  const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value;
                                  if (description.trim()) {
                                    handleSaveWorkLog({
                                      description,
                                      started_at: new Date().toISOString()
                                    });
                                    form.reset();
                                    const textarea = form.elements.namedItem('description') as HTMLTextAreaElement;
                                    textarea.style.height = 'auto';
                                    textarea.style.height = textarea.scrollHeight + 'px';
                                  }
                                }}>
                                  <textarea
                                    name="description"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm resize-none mb-3"
                                    placeholder="作業内容を入力..."
                                    onKeyDown={(e) => {
                                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                        e.preventDefault();
                                        const form = e.currentTarget.form;
                                        if (form && e.currentTarget.value.trim()) {
                                          handleSaveWorkLog({
                                            description: e.currentTarget.value,
                                            started_at: new Date().toISOString()
                                          });
                                          form.reset();
                                          e.currentTarget.style.height = 'auto';
                                          e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                                        }
                                      }
                                    }}
                                    onInput={(e) => {
                                      const textarea = e.target as HTMLTextAreaElement;
                                      textarea.style.height = 'auto';
                                      textarea.style.height = textarea.scrollHeight + 'px';
                                    }}
                                    style={{
                                      minHeight: '4.5rem',
                                      maxHeight: '20rem'
                                    }}
                                  />
                                  <div className="flex justify-end">
                                    <button
                                      type="submit"
                                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                      記録
                                    </button>
                                  </div>
                                </form>
                              </div>
                              {tasks.find(task => task.id === selectedTaskId)?.work_logs
                                ?.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
                                ?.map(log => (
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
                            </div>
                          ) : (
                            <p className="text-gray-500 text-center">タスクを選択してください</p>
                          )}
                        </div>
                      </div>
                    </Panel>
                  </PanelGroup>
                </div>
              </Tab.Panel>
              <Tab.Panel>
                <div className="py-8">
                  <MemoList tasks={tasks} onUpdate={fetchTasks} />
                </div>
              </Tab.Panel>
              <Tab.Panel>
                <div className="py-8">
                  <div className="rounded-lg border-4 border-dashed border-gray-200 p-4">
                    <p className="text-center text-gray-500">時計機能（開発中）</p>
                  </div>
                </div>
              </Tab.Panel>
              <Tab.Panel>
                <div className="py-8">
                  <div className="rounded-lg border-4 border-dashed border-gray-200 p-4">
                    <p className="text-center text-gray-500">マインドマップ機能（開発中）</p>
                  </div>
                </div>
              </Tab.Panel>
              <Tab.Panel>
                <div className="py-8">
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
