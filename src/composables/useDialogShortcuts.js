import { onBeforeUnmount, onMounted } from 'vue'

export function useDialogShortcuts(visible, { confirm, cancel, confirmOnInput = false }) {
  function handleKeydown(event) {
    if (!visible.value || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancel()
      return
    }
    if (event.key === 'Enter' && (confirmOnInput || !event.target?.closest?.('input, textarea, [contenteditable="true"]'))) {
      event.preventDefault()
      event.stopPropagation()
      confirm()
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown, true))
  onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown, true))
}
