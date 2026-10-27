import { ref } from 'vue'

const showAll = ref(false)
// "Hide" also applies to every form on the page. Each form handles it itself.
const hideRequests = ref(0)

export function useCustomDataForm() {
  return {
    showAll,
    hideRequests,
  }
}
