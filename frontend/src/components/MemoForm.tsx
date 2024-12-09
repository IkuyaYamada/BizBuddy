'use client'

import { useForm } from 'react-hook-form'
import FormModal from './common/FormModal'
import FormField, { inputStyles, textareaStyles } from './common/FormField'
import FormActions from './common/FormActions'

interface MemoFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: MemoFormData) => Promise<void>
  initialData?: MemoFormData
}

interface MemoFormData {
  content: string
  task_ids: number[]
}

export default function MemoForm({ isOpen, onClose, onSubmit, initialData }: MemoFormProps) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<MemoFormData>({
    defaultValues: initialData || {
      content: '',
      task_ids: []
    }
  })

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
      title={initialData ? 'メモを編集' : 'メモを作成'}
    >
      <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="space-y-4">
        <FormField label="内容" error={errors.content?.message}>
          <textarea
            {...register('content', { required: '内容は必須です' })}
            className={textareaStyles}
            rows={4}
            autoFocus
          />
        </FormField>

        <FormActions
          onCancel={onClose}
          submitText={initialData ? '更新' : '作成'}
        />
      </form>
    </FormModal>
  )
} 