'use client'

import { useForm } from 'react-hook-form'
import { addDays, format } from 'date-fns'
import FormModal from './common/FormModal'
import FormField, { inputStyles, textareaStyles } from './common/FormField'
import FormActions from './common/FormActions'

interface TaskFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: TaskFormData) => Promise<void>
  initialData?: TaskFormData
}

interface TaskFormData {
  title: string
  description: string
  motivation: number
  priority: number
  deadline?: string
  status: string
}

export default function TaskForm({ isOpen, onClose, onSubmit, initialData }: TaskFormProps) {
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<TaskFormData>({
    defaultValues: initialData || {
      title: '',
      description: '## 目的\n\n## 手順\n\n## その他\n',
      motivation: 50,
      priority: 50,
      deadline: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      status: '未着手'
    }
  })

  const motivationValue = watch('motivation')
  const priorityValue = watch('priority')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit(onSubmit)(e)
    }
  }

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'タスクを編集' : '新規タスク作成'}
    >
      <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="space-y-4">
        <FormField label="タイトル" error={errors.title?.message}>
          <input
            type="text"
            {...register('title', { required: 'タイトルは必須です' })}
            className={inputStyles}
            autoFocus
          />
        </FormField>

        <FormField label="説明" error={errors.description?.message}>
          <textarea
            {...register('description')}
            className={textareaStyles}
            rows={10}
          />
        </FormField>

        <FormField label={`モチベーション: ${motivationValue}`}>
          <input
            type="range"
            min="1"
            max="100"
            {...register('motivation', { required: true })}
            className="mt-1 block w-full"
          />
        </FormField>

        <FormField label={`優先度: ${priorityValue}`}>
          <input
            type="range"
            min="1"
            max="100"
            {...register('priority', { required: true })}
            className="mt-1 block w-full"
          />
        </FormField>

        <FormField label="期限（任意）">
          <input
            type="date"
            {...register('deadline')}
            defaultValue={format(addDays(new Date(), 7), 'yyyy-MM-dd')}
            min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
            className={inputStyles}
          />
        </FormField>

        <FormField label="ステータス">
          <select
            {...register('status')}
            className={inputStyles}
          >
            <option value="未着手">todo</option>
            <option value="進行中">in progress</option>
            <option value="casual">casual</option>
            <option value="backlog">backlog</option>
            <option value="完了">done</option>
          </select>
        </FormField>

        <FormActions
          onCancel={onClose}
          submitText={initialData ? '更新' : '作成'}
        />
      </form>
    </FormModal>
  )
} 