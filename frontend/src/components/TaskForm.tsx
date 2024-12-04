'use client'

import { useForm } from 'react-hook-form'
import { addDays, format } from 'date-fns'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'

interface TaskFormProps {
  isOpen: boolean
  onClose: () => void
  onTaskCreated: () => void
}

interface TaskFormData {
  title: string
  description: string
  motivation: number
  priority: number
  deadline?: string
  status: string
}

export default function TaskForm({ isOpen, onClose, onTaskCreated }: TaskFormProps) {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<TaskFormData>({
    defaultValues: {
      title: '',
      description: '## 目的\n\n## 手順\n\n## その他\n',
      motivation: 50,
      priority: 50,
      deadline: format(addDays(new Date(), 7), "yyyy-MM-dd'T'HH:mm"),
      status: '未着手'
    }
  })

  const motivationValue = watch('motivation')
  const priorityValue = watch('priority')

  const onSubmit = async (data: TaskFormData) => {
    try {
      const response = await fetch('http://localhost:8000/tasks/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString()
        }),
      })

      if (response.ok) {
        reset()
        onTaskCreated()
      } else {
        const errorData = await response.json()
        console.error('Error response:', errorData)
      }
    } catch (error) {
      console.error('Error creating task:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit(onSubmit)(e)
    }
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="mb-4">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    新規タスク作成
                  </Dialog.Title>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" onKeyDown={handleKeyDown}>
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                      タイトル
                    </label>
                    <input
                      type="text"
                      {...register('title', { required: 'タイトルは必須です' })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                    {errors.title && (
                      <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      説明
                    </label>
                    <div className="mt-1">
                      <textarea
                        {...register('description')}
                        rows={10}
                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                    {errors.description && (
                      <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="motivation" className="block text-sm font-medium text-gray-700">
                      モチベーション: {motivationValue}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      {...register('motivation', { required: true })}
                      className="mt-1 block w-full"
                    />
                  </div>

                  <div>
                    <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                      優先度: {priorityValue}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      {...register('priority', { required: true })}
                      className="mt-1 block w-full"
                    />
                  </div>

                  <div>
                    <label htmlFor="deadline" className="block text-sm font-medium text-gray-700">
                      期限（任意）
                    </label>
                    <input
                      type="date"
                      {...register('deadline')}
                      min={addDays(new Date(), 1).toISOString().split('T')[0]}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                      ステータス
                    </label>
                    <select
                      {...register('status')}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="未着手">未着手</option>
                      <option value="進行中">進行中</option>
                      <option value="casual">casual</option>
                      <option value="backlog">backlog</option>
                      <option value="完了">完了</option>
                    </select>
                  </div>

                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="submit"
                      className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
                    >
                      作成
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
                      onClick={onClose}
                    >
                      キャンセル
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
} 