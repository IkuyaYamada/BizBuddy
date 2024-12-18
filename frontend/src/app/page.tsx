'use client'

import { useState, useEffect, useRef } from 'react'
import { Tab } from '@headlessui/react'
import Tabs from '../components/Tabs'
import TaskList from '../components/TaskList'
import TaskForm from '../components/TaskForm'
import { Task, WorkLog } from '@/types/task'
import { marked } from 'marked'
import { format, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns'
import { ja } from 'date-fns/locale'
import MemoList from '../components/MemoList'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import Timer from '../components/Timer'
import WorkLogForm from '@/components/WorkLogForm'
import { ActionPlan } from '@/components/ActionPlan'
import { DailyLog } from '@/components/DailyLog'

// パネルサイズの保存と読み込み用の関数
const savePanelLayout = (sizes: number[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('panelLayout', JSON.stringify(sizes));
  }
};

const loadPanelLayout = (): number[] => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('panelLayout');
    if (saved) {
      return JSON.parse(saved);
    }
  }
  return [50, 50]; // デォルト値
};

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

// タブの定義
const tabItems = [
  { name: 'タスク', id: 'tasks' },
  { name: 'メモ', id: 'notes' },
  { name: 'アクションプラン', id: 'action-plan' },
  { name: 'マイリーログ', id: 'daily-log' },
  { name: 'マインドマップ', id: 'mindmap' },
  { name: 'プロトタイプ', id: 'prototype' },
]

// ユーザリティ関数
function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [isWorkLogModalOpen, setIsWorkLogModalOpen] = useState(false)
  const [editingWorkLog, setEditingWorkLog] = useState<WorkLog | undefined>(undefined)
  const [deletingWorkLogId, setDeletingWorkLogId] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState(0)
  const [panelSizes, setPanelSizes] = useState(loadPanelLayout())
  const [editingWorkLogId, setEditingWorkLogId] = useState<number | null>(null)
  const [editingWorkLogContent, setEditingWorkLogContent] = useState('')
  const workLogTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false)

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

  const handleTaskSelect = (taskId: number | null) => {
    setSelectedTaskId(taskId === selectedTaskId ? null : taskId);
    setEditingWorkLog(undefined);
    
    if (taskId !== null && selectedTaskId !== taskId) {
      setTimeout(() => {
        const textarea = document.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
        if (textarea) {
          textarea.focus();
        }
      }, 0);
    }
  };

  useEffect(() => {
    fetchTasks()
  }, [])

  // キーボードショートカットの処理を追加
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof window !== 'undefined' && navigator.platform.toLowerCase().includes('mac');

      // タスク選択のショートカット (Ctrl + 1-9)
      if (e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        const num = parseInt(e.key)
        if (!isNaN(num) && num >= 1 && num <= 9) {
          e.preventDefault();
          // ステータスと優先度でソートされた順序を使用
          const sortedTasks = [...tasks].sort((a, b) => {
            const statusOrder = {
              '進行中': 0,
              '未着手': 1,
              'casual': 2,
              'backlog': 3,
              '完了': 4
            };
            const statusDiff = statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder];
            if (statusDiff !== 0) return statusDiff;
            return b.priority - a.priority;
          });

          const task = sortedTasks[num - 1];
          if (task) {
            handleTaskSelect(task.id);
          }
        } else if (e.key === 'm') {
          e.preventDefault();
          setSelectedTab(1); // メモタブのインデックス
          // メモタブに切り替わった後、少し遅延してフォーカスを当てる
          setTimeout(() => {
            const memoTextarea = document.querySelector('textarea[placeholder="メモを入力..."]') as HTMLTextAreaElement;
            if (memoTextarea) {
              memoTextarea.focus();
            }
          }, 0);
        } else if (e.key.toLowerCase() === 'j') {
          e.preventDefault();
          setSelectedTab(0); // タスクタブのインデックス
        } else if (isMac && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          setSelectedTab(2); // アクションプランタブのインデックス
        } else if (isMac && e.key.toLowerCase() === 'l') {
          e.preventDefault();
          setSelectedTab(3); // デイリーログタブのインデックス
        }
      }

      // アクションプランタブへの移動 (Windows: Ctrl + Alt + K, Mac: Ctrl + K)
      if (!isMac && e.ctrlKey && e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSelectedTab(2); // アクションプランタブのインデックス
      }

      // デイリーログタブへの移動 (Windows: Ctrl + Alt + L, Mac: Ctrl + L)
      if (!isMac && e.ctrlKey && e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setSelectedTab(3); // デイリーログタブのインデックス
      }

      // 新規タスク作成のショートカット (Windows: Ctrl + Alt + N, Mac: Ctrl + N)
      if ((e.ctrlKey && !isMac && e.altKey && e.key.toLowerCase() === 'n') || 
          (isMac && e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        setSelectedTab(0); // タスクタブに切り替え
        setIsTaskFormOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tasks, handleTaskSelect]);

  const handleEditWorkLog = (taskId: number, log: WorkLog) => {
    setEditingWorkLog(log)
    setIsWorkLogModalOpen(true)
  }

  const handleDeleteWorkLog = async (taskId: number, workLogId: number) => {
    try {
      const response = await fetch(`http://localhost:8000/tasks/${taskId}/work-logs/${workLogId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchTasks()
        setDeletingWorkLogId(null)
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
    if (!selectedTaskId && !workLog.task_id) return

    try {
      const taskId = workLog.task_id || selectedTaskId;
      const url = editingWorkLog
        ? `http://localhost:8000/tasks/${taskId}/work-logs/${editingWorkLog.id}`
        : `http://localhost:8000/tasks/${taskId}/work-logs`
      
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
        setEditingWorkLog(undefined)
      }
    } catch (error) {
      console.error('Error saving work log:', error)
    }
  }

  // タブ切り替えのキーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        if (e.key === 'm') {
          e.preventDefault();
          setSelectedTab(1); // メモタブのインデックス
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (editingWorkLogId && workLogTextareaRef.current) {
      workLogTextareaRef.current.focus()
      workLogTextareaRef.current.style.height = 'auto'
      workLogTextareaRef.current.style.height = workLogTextareaRef.current.scrollHeight + 'px'
      // カーソルを文末に移動
      const length = workLogTextareaRef.current.value.length
      workLogTextareaRef.current.setSelectionRange(length, length)
    }
  }, [editingWorkLogId])

  const handleWorkLogEdit = (log: WorkLog) => {
    setEditingWorkLogId(log.id)
    setEditingWorkLogContent(log.description)
    // のレンダングサイクルテキストエリアにフォーカスを当てるため、
    // useEffectでフォーカス処理を行う
  }

  const handleWorkLogUpdate = async (log: WorkLog, newDescription: string) => {
    if (newDescription.trim() === '') return
    
    try {
      const response = await fetch(`http://localhost:8000/tasks/${log.task_id}/work-logs/${log.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...log,
          description: newDescription
        }),
      })

      if (response.ok) {
        fetchTasks()
        setEditingWorkLogId(null)
        setEditingWorkLogContent('')
      }
    } catch (error) {
      console.error('Error updating work log:', error)
    }
  }

  const handleWorkLogKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, log: WorkLog) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleWorkLogUpdate(log, editingWorkLogContent)
    } else if (e.key === 'Escape') {
      setEditingWorkLogId(null)
      setEditingWorkLogContent('')
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        {/* コンパクトヘッダー */}
        <header className="relative">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsHeaderExpanded(!isHeaderExpanded)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                title={isHeaderExpanded ? "メニューを閉じる" : "メニューを開く"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d={isHeaderExpanded ? "M6 18L18 6M6 6l12 12" : "M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"} />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                BizBuddy
              </h1>
            </div>
            <Timer />
          </div>
        </header>

        <main className={`transition-all duration-300 ${isHeaderExpanded ? 'mt-[200px]' : 'mt-4'}`}>
          <div className="mx-auto">
            <div className="w-full">
              <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
                {/* 展開可能なタブメニュー */}
                <div className={`fixed top-[60px] left-0 right-0 bg-white shadow-lg rounded-b-xl transform transition-all duration-300 origin-top z-50 ${
                  isHeaderExpanded ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-0 pointer-events-none'
                }`}>
                  <Tab.List className="flex space-x-1 p-2 max-w-7xl mx-auto">
                    {[
                      { id: 'tasks', name: 'タスク' },
                      { id: 'memos', name: 'メモ' },
                      { id: 'action-plan', name: 'アクションプラン' },
                      { id: 'daily-log', name: 'デイリーログ' },
                      { id: 'mindmap', name: 'マインドマップ' },
                      { id: 'prototype', name: 'プロトタイプ' }
                    ].map((tab) => (
                      <Tab
                        key={tab.id}
                        className={({ selected }) =>
                          classNames(
                            'w-full rounded-lg py-2 text-sm font-medium leading-5',
                            'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                            selected
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          )
                        }
                        onClick={() => {
                          setTimeout(() => setIsHeaderExpanded(false), 200);
                        }}
                      >
                        {tab.name}
                      </Tab>
                    ))}
                  </Tab.List>
                </div>

                <Tab.Panels>
                  <Tab.Panel>
                    <div className="py-6">
                      <PanelGroup 
                        direction="horizontal"
                        onLayout={(sizes) => {
                          savePanelLayout(sizes);
                          setPanelSizes(sizes);
                        }}
                      >
                        <Panel defaultSize={panelSizes[0]} minSize={30}>
                          <div>
                            <div className="flex justify-between items-center mb-4">
                              <h2 className="text-lg font-medium text-gray-900">タスク一覧</h2>
                              <button
                                onClick={() => setIsTaskFormOpen(true)}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                新規タス作成
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

                        <Panel defaultSize={panelSizes[1]} minSize={30}>
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
                                        const now = new Date();
                                        // JSTのオフセットを考慮して日時を調整
                                        const jstOffset = 9 * 60;
                                        now.setMinutes(now.getMinutes() + jstOffset);
                                        
                                        handleSaveWorkLog({
                                          description,
                                          started_at: now.toISOString(),
                                          task_id: selectedTaskId!
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
                                              const now = new Date();
                                              // JSTのオフセットを考慮して日時を調整
                                              const jstOffset = 9 * 60;
                                              now.setMinutes(now.getMinutes() + jstOffset);

                                              handleSaveWorkLog({
                                                description: e.currentTarget.value,
                                                started_at: now.toISOString(),
                                                task_id: selectedTaskId!
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
                                          {editingWorkLogId === log.id ? (
                                            <>
                                              <button
                                                onClick={() => handleWorkLogUpdate(log, editingWorkLogContent)}
                                                className="text-xs text-blue-600 hover:text-blue-900 font-medium"
                                              >
                                                保存
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setEditingWorkLogId(null)
                                                  setEditingWorkLogContent('')
                                                }}
                                                className="text-xs text-gray-600 hover:text-gray-900"
                                              >
                                                キャンセル
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              {deletingWorkLogId === log.id ? (
                                                <button
                                                  onClick={() => handleDeleteWorkLog(selectedTaskId, log.id)}
                                                  className="text-xs text-red-600 hover:text-red-900 font-medium"
                                                >
                                                  削除する
                                                </button>
                                              ) : (
                                                <button
                                                  onClick={() => setDeletingWorkLogId(log.id)}
                                                  className="text-xs text-red-600 hover:text-red-900"
                                                >
                                                  削除
                                                </button>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      {editingWorkLogId === log.id ? (
                                        <textarea
                                          ref={workLogTextareaRef}
                                          value={editingWorkLogContent}
                                          onChange={(e) => {
                                            setEditingWorkLogContent(e.target.value)
                                            e.target.style.height = 'auto'
                                            e.target.style.height = e.target.scrollHeight + 'px'
                                          }}
                                          onKeyDown={(e) => handleWorkLogKeyDown(e, log)}
                                          onBlur={() => {
                                            if (editingWorkLogContent.trim() !== log.description.trim()) {
                                              handleWorkLogUpdate(log, editingWorkLogContent)
                                            } else {
                                              setEditingWorkLogId(null)
                                              setEditingWorkLogContent('')
                                            }
                                          }}
                                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm resize-none"
                                          style={{
                                            minHeight: '4.5rem',
                                            maxHeight: '20rem'
                                          }}
                                        />
                                      ) : (
                                        <div
                                          onClick={() => handleWorkLogEdit(log)}
                                          className="prose prose-sm max-w-none cursor-text hover:bg-gray-50 rounded-md p-2 transition-colors duration-200"
                                          dangerouslySetInnerHTML={{
                                            __html: marked(log.description, { breaks: true })
                                          }}
                                        />
                                      )}
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
                    <div className="py-6">
                      <ActionPlan
                        tasks={tasks}
                        onTaskSelect={handleTaskSelect}
                        selectedTaskId={selectedTaskId}
                      />
                    </div>
                  </Tab.Panel>
                  <Tab.Panel>
                    <div className="py-8">
                      <DailyLog tasks={tasks} />
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
                </Tab.Panels>
              </Tab.Group>
            </div>
          </div>
        </main>
      </div>

      {/* タスク作成モーダル */}
      <TaskForm
        isOpen={isTaskFormOpen}
        onClose={() => setIsTaskFormOpen(false)}
        onSubmit={async (data) => {
          try {
            const formattedData = {
              ...data,
              deadline: data.deadline ? `${data.deadline}T00:00:00Z` : null,
              created_at: new Date().toISOString(),
              last_updated: new Date().toISOString()
            };
            
            const response = await fetch('http://localhost:8000/tasks/', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(formattedData),
            })

            if (response.ok) {
              fetchTasks()
              setIsTaskFormOpen(false)
            } else {
              const errorData = await response.json()
              console.error('Error creating task:', errorData)
            }
          } catch (error) {
            console.error('Error creating task:', error)
          }
        }}
      />

      {/* 作業ログモーダル */}
      <WorkLogForm
        isOpen={isWorkLogModalOpen}
        onClose={() => {
          setIsWorkLogModalOpen(false)
          setEditingWorkLog(undefined)
        }}
        onSubmit={handleSaveWorkLog}
        taskId={selectedTaskId!}
        initialData={editingWorkLog}
      />
    </main>
  )
}
