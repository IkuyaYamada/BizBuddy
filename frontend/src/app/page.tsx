'use client'

import { useState, useEffect } from 'react'
import { Tab } from '@headlessui/react'
import Tabs from '../components/Tabs'
import TaskList from '../components/TaskList'
import TaskForm from '../components/TaskForm'
import WorkLogModal from '@/components/WorkLogModal'
import { Task, WorkLog } from '@/types/task'
import { marked } from 'marked'
import { format, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns'
import { ja } from 'date-fns/locale'
import MemoList from '../components/MemoList'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import Timer from '../components/Timer'

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
  return [50, 50]; // デフォルト値
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
  { name: '時計', id: 'timer' },
  { name: 'マインドマップ', id: 'mindmap' },
  { name: 'プロトタイプ', id: 'prototype' },
]

// ユーティリティ関数
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

  const handleTaskSelect = (taskId: number) => {
    setSelectedTaskId(selectedTaskId === taskId ? null : taskId);
    setEditingWorkLog(undefined);
    
    if (selectedTaskId !== taskId) {
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
      // タスク選択のショートカット (Ctrl + 1-9)
      if (e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        const num = parseInt(e.key);
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
        }
      }
      // 新規タスク作成のショートカット (Windows: Ctrl + Alt + N, Mac: Ctrl + N)
      const isMac = typeof window !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
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

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
              BizBuddy
            </h1>
            <Timer />
          </div>
        </header>
        <main>
          <div className="mx-auto">
            <div className="w-full">
              <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
                <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1">
                  {tabItems.map((tab) => (
                    <Tab
                      key={tab.id}
                      className={({ selected }) =>
                        classNames(
                          'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                          'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                          selected
                            ? 'bg-white shadow text-blue-700'
                            : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
                        )
                      }
                    >
                      {tab.name}
                    </Tab>
                  ))}
                </Tab.List>
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
                                        <button
                                          onClick={() => handleEditWorkLog(selectedTaskId, log)}
                                          className="text-xs text-indigo-600 hover:text-indigo-900"
                                        >
                                          編集
                                        </button>
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
              </Tab.Group>
            </div>
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
