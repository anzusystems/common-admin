import { ref } from 'vue'

const OPEN_LEFT_COLS = 2
const CLOSED_LEFT_COLS = 0

const OPEN_RIGHT_COLS = 10
const CLOSED_RIGHT_COLS = 12

const sidebarLeft = ref(false)
const leftCols = ref(OPEN_LEFT_COLS)
const rightCols = ref(OPEN_RIGHT_COLS)

export function useSidebar() {
  const toggleSidebar = () => {
    sidebarLeft.value ? closeSidebar() : openSidebar()
  }

  const openSidebar = () => {
    leftCols.value = OPEN_LEFT_COLS
    rightCols.value = OPEN_RIGHT_COLS
    sidebarLeft.value = true
  }

  const closeSidebar = () => {
    leftCols.value = CLOSED_LEFT_COLS
    rightCols.value = CLOSED_RIGHT_COLS
    sidebarLeft.value = false
  }

  return {
    sidebarLeft,
    leftCols,
    rightCols,
    toggleSidebar,
    openSidebar,
  }
}
