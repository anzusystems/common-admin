import { ref } from 'vue'

const sidebarLeft = ref(false)

export function useSidebar() {
  return {
    sidebarLeft,
  }
}
