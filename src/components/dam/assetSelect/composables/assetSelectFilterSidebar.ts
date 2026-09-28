import { ref } from 'vue'

const sidebarLeft = ref(false)
const sidebarRight = ref(false)

export function useSidebar() {
  const toggleSidebarLeft = () => {
    sidebarLeft.value ? closeSidebarLeft() : openSidebarLeft()
  }

  const openSidebarLeft = () => {
    sidebarLeft.value = true
  }

  const closeSidebarLeft = () => {
    sidebarLeft.value = false
  }

  const toggleSidebarRight = () => {
    sidebarRight.value ? closeSidebarRight() : openSidebarRight()
  }

  const openSidebarRight = () => {
    sidebarRight.value = true
  }

  const closeSidebarRight = () => {
    sidebarRight.value = false
  }

  return {
    sidebarLeft,
    sidebarRight,
    toggleSidebarLeft,
    openSidebarLeft,
    closeSidebarLeft,
    toggleSidebarRight,
    openSidebarRight,
    closeSidebarRight,
  }
}
