export const isSubmitKeyCombo = (e: KeyboardEvent): boolean => {
  // Windows/Linux: Ctrl + Enter, Mac: Command + Enter
  return (e.ctrlKey || e.metaKey) && e.key === 'Enter'
}

export const handleSubmitKeyCombo = (e: KeyboardEvent, callback: () => void) => {
  if (isSubmitKeyCombo(e)) {
    e.preventDefault()
    callback()
  }
} 