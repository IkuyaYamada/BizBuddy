'use client'

import { Task } from '@/types/task'
import { useState } from 'react'

interface ActionPlanProps {
  tasks: Task[]
  onTaskSelect: (taskId: number) => void
  selectedTaskId: number | null
}

interface SubTask {
  id: string
  title: string
  leafTasks: LeafTask[]
}

interface LeafTask {
  id: string
  title: string
  actionItems: string[]
}

export default function ActionPlan({ tasks, onTaskSelect, selectedTaskId }: ActionPlanProps) {
  const [subTasks, setSubTasks] = useState<SubTask[]>([])
  const selectedTask = tasks.find(task => task.id === selectedTaskId)

  const addSubTask = () => {
    if (subTasks.length >= 3) return
    const newSubTask: SubTask = {
      id: `sub-${Date.now()}`,
      title: '新しいサブタスク',
      leafTasks: []
    }
    setSubTasks([...subTasks, newSubTask])
  }

  const addLeafTask = (subTaskId: string) => {
    setSubTasks(subTasks.map(subTask => {
      if (subTask.id === subTaskId && subTask.leafTasks.length < 3) {
        return {
          ...subTask,
          leafTasks: [
            ...subTask.leafTasks,
            {
              id: `leaf-${Date.now()}`,
              title: '新しいリーフタスク',
              actionItems: []
            }
          ]
        }
      }
      return subTask
    }))
  }

  const addActionItem = (subTaskId: string, leafTaskId: string) => {
    setSubTasks(subTasks.map(subTask => {
      if (subTask.id === subTaskId) {
        return {
          ...subTask,
          leafTasks: subTask.leafTasks.map(leafTask => {
            if (leafTask.id === leafTaskId) {
              return {
                ...leafTask,
                actionItems: [...leafTask.actionItems, '新しいアクションアイテム']
              }
            }
            return leafTask
          })
        }
      }
      return subTask
    }))
  }

  return (
    <div className="p-4">
      {/* タスク選択セクション */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">アクションプラン</h2>
        </div>
        {!selectedTask ? (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="mb-4 text-gray-600">
              タスクを選択してアクションプランを作成しましょう
            </div>
            <select
              value={selectedTaskId || ''}
              onChange={(e) => onTaskSelect(Number(e.target.value))}
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
            >
              <option value="">タスクを選択</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title} - {task.status}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center space-x-4 mb-4">
            <select
              value={selectedTaskId || ''}
              onChange={(e) => onTaskSelect(Number(e.target.value))}
              className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
            >
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title} - {task.status}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* メインタスク */}
      {selectedTask && (
        <div className="relative">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white mb-8">
            <h2 className="text-xl font-bold mb-2">{selectedTask.title}</h2>
            <p className="text-blue-50 whitespace-pre-wrap">{selectedTask.description}</p>
            <div className="mt-4 text-sm text-blue-100">
              ステータス: {selectedTask.status}
            </div>
          </div>

          {/* 接続線 */}
          {subTasks.length > 0 && (
            <div className="absolute left-1/2 -translate-x-1/2 h-8 w-0.5 bg-gray-300" style={{ top: '100%' }} />
          )}
        </div>
      )}

      {/* サブタスク */}
      <div className="space-y-12">
        {subTasks.map((subTask) => (
          <div key={subTask.id} className="relative">
            {/* 垂直の接続線 */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-8 h-8 w-0.5 bg-gray-300" />

            {/* サブタスク */}
            <div className="relative">
              <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg shadow-lg p-4 mb-8 mx-auto max-w-2xl">
                <input
                  type="text"
                  value={subTask.title}
                  onChange={(e) => {
                    setSubTasks(subTasks.map(st => 
                      st.id === subTask.id ? { ...st, title: e.target.value } : st
                    ))
                  }}
                  className="text-lg font-semibold mb-2 w-full bg-transparent text-white placeholder-indigo-200 border-none focus:ring-2 focus:ring-white rounded"
                  placeholder="サブタスクのタイトル"
                />
                <button
                  onClick={() => addLeafTask(subTask.id)}
                  className="text-sm text-indigo-100 hover:text-white transition-colors"
                  disabled={subTask.leafTasks.length >= 3}
                >
                  + リーフタスクを追加
                </button>
              </div>

              {/* リーフタスクへの接続線 */}
              {subTask.leafTasks.length > 0 && (
                <div className="absolute left-1/2 -translate-x-1/2 h-8 w-0.5 bg-gray-300" style={{ top: '100%' }} />
              )}
            </div>

            {/* リーフタスク */}
            <div className="grid grid-cols-3 gap-6 ml-8 relative">
              {subTask.leafTasks.map((leafTask) => (
                <div key={leafTask.id} className="relative">
                  {/* 水平の接続線 */}
                  <div className="absolute left-1/2 -translate-x-1/2 -top-8 h-8 w-0.5 bg-gray-300" />

                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-lg p-4">
                    <input
                      type="text"
                      value={leafTask.title}
                      onChange={(e) => {
                        setSubTasks(subTasks.map(st => 
                          st.id === subTask.id ? {
                            ...st,
                            leafTasks: st.leafTasks.map(lt =>
                              lt.id === leafTask.id ? { ...lt, title: e.target.value } : lt
                            )
                          } : st
                        ))
                      }}
                      className="text-md font-medium mb-2 w-full bg-transparent text-white placeholder-purple-200 border-none focus:ring-2 focus:ring-white rounded"
                      placeholder="リーフタスクのタイトル"
                    />
                    <div className="space-y-2">
                      {leafTask.actionItems.map((item, index) => (
                        <input
                          key={index}
                          type="text"
                          value={item}
                          onChange={(e) => {
                            setSubTasks(subTasks.map(st =>
                              st.id === subTask.id ? {
                                ...st,
                                leafTasks: st.leafTasks.map(lt =>
                                  lt.id === leafTask.id ? {
                                    ...lt,
                                    actionItems: lt.actionItems.map((ai, i) =>
                                      i === index ? e.target.value : ai
                                    )
                                  } : lt
                                )
                              } : st
                            ))
                          }}
                          className="text-sm w-full bg-white/10 text-white placeholder-purple-200 border-none focus:ring-2 focus:ring-white rounded"
                          placeholder="アクションアイテム"
                        />
                      ))}
                      <button
                        onClick={() => addActionItem(subTask.id, leafTask.id)}
                        className="text-sm text-purple-100 hover:text-white transition-colors"
                      >
                        + アクションアイテムを追加
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* サブタスク追加ボタン */}
      {selectedTask && subTasks.length < 3 && (
        <button
          onClick={addSubTask}
          className="mt-12 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 mx-auto block"
        >
          + サブタスクを追加
        </button>
      )}
    </div>
  )
} 