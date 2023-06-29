import { ref } from 'vue'

const sidebarLeft = ref(false)

export function useSidebar() {
  const toggleSidebar = () => {
    sidebarLeft.value ? closeSidebar() : openSidebar()
  }

  const openSidebar = () => {
    sidebarLeft.value = true
  }

  const closeSidebar = () => {
    sidebarLeft.value = false
  }

  return {
    sidebarLeft,
    toggleSidebar,
    openSidebar,
  }
}
