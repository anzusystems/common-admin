import { ref } from 'vue'

const showAll = ref(false)

export function useCustomDataForm() {
  const toggleForm = () => {
    showAll.value = !showAll.value
  }

  return {
    showAll,
    toggleForm,
  }
}
