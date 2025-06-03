import { ref } from 'vue'

export function useSystemBar() {
  const newVersion = ref(false)

  return {
    newVersion,
  }
}
