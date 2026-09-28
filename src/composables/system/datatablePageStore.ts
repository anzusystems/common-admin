import { ref } from 'vue'

const storedPage = ref<number>(1)
const preservePage = ref<boolean>(false)

export function useDatatablePageStore() {
  const setStoredPage = (page: number) => {
    storedPage.value = page
  }

  const setPreservePage = () => {
    preservePage.value = true
  }

  const consumeStoredPage = (): number | null => {
    if (preservePage.value) {
      preservePage.value = false
      return storedPage.value
    }
    return null
  }

  return {
    setStoredPage,
    setPreservePage,
    consumeStoredPage,
  }
}
