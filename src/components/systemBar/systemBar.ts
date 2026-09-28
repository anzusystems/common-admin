import { ref } from 'vue'

const newVersion = ref(false)

export function useSystemBar() {
  return {
    newVersion,
  }
}
