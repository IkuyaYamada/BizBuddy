'use client'

import { useForm } from 'react-hook-form'
import { addDays, format } from 'date-fns'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment, useEffect, useRef } from 'react'

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
      deadline: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      status: '未着手'
    },
    mode: 'onChange'
  });

  const titleRef = register('title', { 
    required: 'タイトルは必須です',
  });

  const motivationValue = watch('motivation')
  const priorityValue = watch('priority')

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const titleInput = document.querySelector('input[name="title"]');
        if (titleInput instanceof HTMLInputElement) {
          titleInput.focus();
        }
      }, 0);
    } else {
      reset();
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: TaskFormData) => {
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

  const wrappedSubmit = handleSubmit(
    (data) => {
      return onSubmit(data);
    },
    (errors) => {
      if (errors.title) {
        const titleInput = document.querySelector('input[name="title"]');
        if (titleInput instanceof HTMLInputElement) {
          titleInput.focus();
        }
      }
    }
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      wrappedSubmit(e);
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

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    wrappedSubmit(e);
                  }} 
                  className="space-y-4" 
                  onKeyDown={handleKeyDown}
                >
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                      タイトル
                    </label>
                    <input
                      type="text"
                      id="title"
                      name={titleRef.name}
                      onChange={titleRef.onChange}
                      onBlur={titleRef.onBlur}
                      ref={titleRef.ref}
                      className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                        errors.title ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                      }`}
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
                      defaultValue={format(addDays(new Date(), 7), 'yyyy-MM-dd')}
                      min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                      className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                        errors.deadline ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                      }`}
                    />
                    {errors.deadline && (
                      <p className="mt-1 text-sm text-red-600">{errors.deadline.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                      ステータス
                    </label>
                    <select
                      {...register('status')}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="未着手">todo</option>
                      <option value="進行中">in progress</option>
                      <option value="casual">casual</option>
                      <option value="backlog">backlog</option>
                      <option value="完了">done</option>
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