import { type Ref, ref } from 'vue'

const isDraggingFile = ref(false)
const draggingTimer: Ref<ReturnType<typeof setTimeout> | undefined> = ref(undefined)

export function useDropzoneGlobalDragState() {
  const dragoverHandler = (event: DragEvent) => {
    event.preventDefault()
    checkReallyDraggingEnded(event, true)
  }
  const dragleaveHandler = (event: DragEvent) => {
    event.preventDefault()
    checkReallyDraggingEnded(event, false)
  }
  const dropHandler = (event: DragEvent) => {
    event.preventDefault()
    checkReallyDraggingEnded(event, false)
  }
  const checkReallyDraggingEnded = (event: DragEvent, dragging: boolean) => {
    if (!dragEventContainsFiles(event)) {
      return
    }
    if (dragging) {
      isDraggingFile.value = true
      clearTimeout(draggingTimer.value)
    } else {
      clearTimeout(draggingTimer.value)
      draggingTimer.value = setTimeout(() => {
        isDraggingFile.value = false
      }, 100)
    }
  }
  const dragEventContainsFiles = (event: DragEvent) => {
    if (event.dataTransfer?.types) {
      for (let i = 0; i < event.dataTransfer.types.length; i++) {
        if (event.dataTransfer.types[i] === 'Files') {
          return true
        }
      }
    }

    return false
  }

  const initGlobalDragState = () => {
    window.document.addEventListener('dragover', dragoverHandler)
    window.document.addEventListener('dragleave', dragleaveHandler)
    window.document.addEventListener('drop', dropHandler)
  }

  const destroyGlobalDragState = () => {
    window.document.removeEventListener('dragover', dragoverHandler)
    window.document.removeEventListener('dragleave', dragleaveHandler)
    window.document.removeEventListener('drop', dropHandler)
  }

  return {
    isDraggingFile,
    initGlobalDragState,
    destroyGlobalDragState,
  }
}
