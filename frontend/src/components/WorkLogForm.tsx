'use client'

import { useForm } from 'react-hook-form'
import { useEffect } from 'react'
import FormModal from './common/FormModal'
import FormField, { textareaStyles } from './common/FormField'
import FormActions from './common/FormActions'
import { WorkLog } from '@/types/task'

interface WorkLogFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: Omit<WorkLog, 'id'>) => Promise<void>
  taskId: number
  initialData?: WorkLog
}

interface WorkLogFormData {
  description: string
}

export default function WorkLogForm({ isOpen, onClose, onSubmit, taskId, initialData }: WorkLogFormProps) {
  const { register, handleSubmit, reset, setValue } = useForm<WorkLogFormData>({
    defaultValues: {
      description: initialData?.description || ''
    }
  })

  useEffect(() => {
    if (initialData) {
      setValue('description', initialData.description)
    } else {
      setValue('description', '')
    }
  }, [initialData, setValue])

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFormSubmit = async (data: WorkLogFormData) => {
    const now = new Date()
    // JSTのオフセットを考慮して日時を調整
    const jstOffset = 9 * 60 // JSTは+9時間
    now.setMinutes(now.getMinutes() + jstOffset)
    
    await onSubmit({
      description: data.description,
      started_at: initialData ? initialData.started_at : now.toISOString(),
      task_id: initialData ? initialData.task_id : taskId
    })
    handleClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit(handleFormSubmit)(e)
    }
  }

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      title={initialData ? '作業ログを編集' : '作業ログを記録'}
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} onKeyDown={handleKeyDown} className="space-y-4">
        <FormField label="作業内容">
          <textarea
            {...register('description', { required: '作業内容は必須です' })}
            className={textareaStyles}
            rows={8}
            autoFocus
          />
        </FormField>

        <FormActions
          onCancel={handleClose}
          submitText={initialData ? '更新' : '記録'}
        />
      </form>
    </FormModal>
  )
} 