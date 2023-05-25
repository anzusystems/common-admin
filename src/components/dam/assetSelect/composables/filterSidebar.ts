import { ref } from 'vue'

const sidebarLeft = ref(false)
const leftCols = ref(0)
const rightCols = ref(12)

export function useSidebar() {
  const toggleSidebar = () => {
    sidebarLeft.value ? closeSidebar() : openSidebar()
  }

  const openSidebar = () => {
    leftCols.value = 2
    rightCols.value = 10
    sidebarLeft.value = true
  }

  const closeSidebar = () => {
    leftCols.value = 0
    rightCols.value = 12
    sidebarLeft.value = false
  }

  return {
    sidebarLeft,
    leftCols,
    rightCols,
    toggleSidebar,
    closeSidebar,
  }
}
