import { ref } from 'vue'

const showAll = ref(false)
// "Hide" is for every form on the page as well, and each one answers it for itself.
const hideRequests = ref(0)

export function useCustomDataForm() {
  return {
    showAll,
    hideRequests,
  }
}
