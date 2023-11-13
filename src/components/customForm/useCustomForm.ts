import { ref } from 'vue'

const showAll = ref(false)

export function useCustomForm() {
  const toggleForm = () => {
    showAll.value = !showAll.value
  }

  return {
    showAll,
    toggleForm,
  }
}
