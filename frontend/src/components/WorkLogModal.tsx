'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { WorkLog } from '@/types/task'
import { format } from 'date-fns'
import { useForm } from 'react-hook-form'

interface WorkLogFormData {
  description: string
}

interface WorkLogModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (workLog: Omit<WorkLog, 'id'>) => Promise<void>
  taskId: number
  workLog?: WorkLog
}

export default function WorkLogModal({ isOpen, onClose, onSave, taskId, workLog }: WorkLogModalProps) {
  const { register, handleSubmit, reset, setValue } = useForm<WorkLogFormData>({
    defaultValues: {
      description: workLog?.description || ''
    }
  })

  useEffect(() => {
    if (workLog) {
      setValue('description', workLog.description)
    } else {
      setValue('description', '')
    }
  }, [workLog, setValue])

  const handleClose = () => {
    reset()
    onClose()
  }

  const onSubmit = async (data: WorkLogFormData) => {
    const now = new Date();
    // JSTのオフセットを考慮して日時を調整
    const jstOffset = 9 * 60; // JSTは+9時間
    now.setMinutes(now.getMinutes() + jstOffset);
    
    await onSave({
      description: data.description,
      started_at: workLog ? workLog.started_at : now.toISOString(),
      task_id: workLog ? workLog.task_id : taskId
    })
    handleClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit(onSubmit)(e)
    }
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={handleClose}>
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-6 pb-6 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <div className="mb-4">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    作業ログの{workLog ? '編集' : '記録'}
                  </Dialog.Title>
                </div>
                <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleKeyDown}>
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                        作業内容
                      </label>
                      <textarea
                        id="description"
                        {...register('description')}
                        rows={8}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="submit"
                      className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
                    >
                      {workLog ? '更新' : '記録'}
                    </button>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
                      onClick={handleClose}
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