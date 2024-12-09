import { ReactNode } from 'react'

interface FormActionsProps {
  onCancel: () => void
  submitText?: string
  cancelText?: string
  children?: ReactNode
}

export default function FormActions({ 
  onCancel, 
  submitText = '保存', 
  cancelText = 'キャンセル',
  children 
}: FormActionsProps) {
  return (
    <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
      <button
        type="submit"
        className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
      >
        {submitText}
      </button>
      <button
        type="button"
        className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
        onClick={onCancel}
      >
        {cancelText}
      </button>
      {children}
    </div>
  )
} 