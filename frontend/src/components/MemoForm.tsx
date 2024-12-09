'use client'

import { useForm } from 'react-hook-form'

interface MemoFormData {
  title: string
  content: string
  task_id?: number
}

export default function MemoForm() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<MemoFormData>()

  const onSubmit = async (data: MemoFormData) => {
    try {
      const response = await fetch('http://localhost:8000/memos/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        reset()
        // TODO: メモ作成後の処理（リスト更新など）
      }
    } catch (error) {
      console.error('Error creating memo:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
        <label htmlFor="content" className="block text-sm font-medium text-gray-700">
          内容
        </label>
        <textarea
          {...register('content', { required: '内容は必須です' })}
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
        {errors.content && (
          <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="task_id" className="block text-sm font-medium text-gray-700">
          関連タスクID（任意）
        </label>
        <input
          type="number"
          {...register('task_id')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
      </div>

      <div className="pt-4">
        <button
          type="submit"
          className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          メモを作成
        </button>
      </div>
    </form>
  )
} 