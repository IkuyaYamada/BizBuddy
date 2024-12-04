'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { marked } from 'marked'
import { Task } from '@/types/task'

interface Memo {
  id: number
  content: string
  created_at: string
  task_ids: number[]
}

interface MemoListProps {
  tasks: Task[]
  onUpdate: () => void
}

export default function MemoList({ tasks, onUpdate }: MemoListProps) {
  const [memos, setMemos] = useState<Memo[]>([])
  const [newMemo, setNewMemo] = useState('')
  const [selectedMemoId, setSelectedMemoId] = useState<number | null>(null)
  const [isTaskSelectOpen, setIsTaskSelectOpen] = useState(false)
  const [editingMemoId, setEditingMemoId] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [deletingMemoId, setDeletingMemoId] = useState<number | null>(null)

  const memoInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    memoInputRef.current?.focus()
  }, [])

  const fetchMemos = async () => {
    const response = await fetch('http://localhost:8000/memos/')
    const data = await response.json()
    const sortedMemos = data.sort((a: Memo, b: Memo) => {
      const aDate = new Date(a.created_at).getTime()
      const bDate = new Date(b.created_at).getTime()
      return bDate - aDate
    })
    setMemos(sortedMemos)
  }

  useEffect(() => {
    fetchMemos()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMemo.trim()) return

    try {
      const response = await fetch('http://localhost:8000/memos/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newMemo,
          task_ids: [],
        }),
      })

      if (response.ok) {
        setNewMemo('')
        fetchMemos()
        onUpdate()
      }
    } catch (error) {
      console.error('Error creating memo:', error)
    }
  }

  const startEdit = (memo: Memo) => {
    setEditingMemoId(memo.id)
    setEditingContent(memo.content)
  }

  const handleUpdate = async (memoId: number) => {
    if (!editingContent.trim()) return

    try {
      const memo = memos.find(m => m.id === memoId)
      if (!memo) return

      const response = await fetch(`http://localhost:8000/memos/${memoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editingContent,
          task_ids: memo.task_ids,
        }),
      })

      if (response.ok) {
        setEditingMemoId(null)
        setEditingContent('')
        fetchMemos()
        onUpdate()
      }
    } catch (error) {
      console.error('Error updating memo:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, memoId?: number) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (memoId) {
        handleUpdate(memoId)
      } else {
        handleSubmit(e)
      }
    } else if (e.key === 'Escape' && memoId) {
      setEditingMemoId(null)
      setEditingContent('')
    }
  }

  const handleDelete = async (memoId: number) => {
    try {
      const response = await fetch(`http://localhost:8000/memos/${memoId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchMemos()
        onUpdate()
        setDeletingMemoId(null)
      }
    } catch (error) {
      console.error('Error deleting memo:', error)
    }
  }

  const handleConvertToWorkLog = async (memoId: number, taskId: number) => {
    const memo = memos.find(m => m.id === memoId)
    if (!memo) return

    try {
      // 作業ログを作成
      const now = new Date()
      // JSTのオフセットを追加（UTC+9）
      now.setHours(now.getHours() + 9)
      
      const workLogResponse = await fetch(`http://localhost:8000/tasks/${taskId}/work-logs/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: `[メモより] ${memo.content}`,
          started_at: now.toISOString(),
        }),
      })

      if (workLogResponse.ok) {
        // メモにタスクを関連付ける
        const updatedTaskIds = [...new Set([...memo.task_ids || [], taskId])]
        console.log('Updating memo with task_ids:', updatedTaskIds) // デバッグ用
        const memoResponse = await fetch(`http://localhost:8000/memos/${memoId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: memo.content,
            task_ids: updatedTaskIds,
          }),
        })

        if (memoResponse.ok) {
          const updatedMemo = await memoResponse.json()
          console.log('Updated memo:', updatedMemo) // デバッグ用
          fetchMemos()
          onUpdate()
          setIsTaskSelectOpen(false)
        } else {
          console.error('Failed to update memo:', await memoResponse.text())
        }
      }
    } catch (error) {
      console.error('Error converting memo to work log:', error)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="mb-4">
          <textarea
            ref={memoInputRef}
            value={newMemo}
            onChange={(e) => setNewMemo(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e)}
            onInput={(e) => {
              const textarea = e.target as HTMLTextAreaElement;
              textarea.style.height = 'auto';
              textarea.style.height = textarea.scrollHeight + 'px';
            }}
            style={{
              minHeight: '4.5rem',
              maxHeight: '20rem'
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="メモを入力..."
          />
        </div>
        <button
          type="submit"
          className="w-full px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          メモを追加
        </button>
      </form>

      <div className="space-y-4">
        {memos.map((memo) => (
          <div key={memo.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm text-gray-500">
                {format(new Date(memo.created_at), 'yyyy/MM/dd HH:mm', { locale: ja })}
              </div>
              <div className="flex space-x-2">
                {editingMemoId === memo.id ? (
                  <>
                    <button
                      onClick={() => handleUpdate(memo.id)}
                      className="text-xs text-blue-600 hover:text-blue-900"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => {
                        setEditingMemoId(null)
                        setEditingContent('')
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      キャンセル
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(memo)}
                      className="text-xs text-blue-600 hover:text-blue-900"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMemoId(memo.id)
                        setIsTaskSelectOpen(true)
                      }}
                      className="text-xs text-blue-600 hover:text-blue-900"
                    >
                      タスクに追加
                    </button>
                    {deletingMemoId === memo.id ? (
                      <button
                        onClick={() => handleDelete(memo.id)}
                        className="text-xs text-red-600 hover:text-red-900 font-medium"
                      >
                        削除する
                      </button>
                    ) : (
                      <button
                        onClick={() => setDeletingMemoId(memo.id)}
                        className="text-xs text-red-600 hover:text-red-900"
                      >
                        削除
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            {editingMemoId === memo.id ? (
              <textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, memo.id)}
                onInput={(e) => {
                  const textarea = e.target as HTMLTextAreaElement;
                  textarea.style.height = 'auto';
                  textarea.style.height = textarea.scrollHeight + 'px';
                }}
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                style={{
                  minHeight: '4.5rem',
                  maxHeight: '20rem'
                }}
              />
            ) : (
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: marked(memo.content.replace(/\n/g, '  \n')) 
                }}
              />
            )}
            <div style={{ display: 'none' }}>
              Debug: {JSON.stringify({
                memo_id: memo.id,
                task_ids: memo.task_ids,
                available_tasks: tasks.map(t => ({ id: t.id, title: t.title }))
              })}
            </div>
            {memo.task_ids && memo.task_ids.length > 0 && (
              <div className="border-t border-gray-200 pt-3">
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm font-medium text-gray-700">関連タスク:</span>
                  {memo.task_ids.map(taskId => {
                    const task = tasks.find(t => t.id === taskId)
                    console.log('Rendering task:', { taskId, task }) // デバッグ用
                    return task ? (
                      <div key={taskId} className="flex items-center gap-1">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-blue-100 text-blue-800">
                          {task.title}
                        </span>
                        <button
                          onClick={() => {
                            if (confirm('このタスクとの関連付けを解除しますか？')) {
                              fetch(`http://localhost:8000/memos/${memo.id}`, {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  content: memo.content,
                                  task_ids: memo.task_ids.filter(id => id !== taskId),
                                }),
                              }).then(response => {
                                if (response.ok) {
                                  fetchMemos()
                                  onUpdate()
                                }
                              })
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                          aria-label="関連付けを解除"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : null
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* タスク選択モーダル */}
      {isTaskSelectOpen && selectedMemoId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium mb-4">タスクを選択</h3>
            <div className="max-h-96 overflow-y-auto">
              {tasks
                .filter(task => {
                  const memo = memos.find(m => m.id === selectedMemoId)
                  return memo && !memo.task_ids.includes(task.id)
                })
                .map((task) => (
                  <button
                    key={task.id}
                    onClick={() => handleConvertToWorkLog(selectedMemoId, task.id)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-lg mb-2"
                  >
                    {task.title}
                  </button>
                ))}
            </div>
            <button
              onClick={() => setIsTaskSelectOpen(false)}
              className="mt-4 w-full px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 