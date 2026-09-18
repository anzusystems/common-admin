import { ref } from 'vue'

// The page is remembered per table. A single global slot used to leak across entities: paging
// list B to page 5, closing any detail and then opening list A reopened A on page 5, because
// both the stored page and the preserve flag were shared. The flag stays global on purpose —
// it means "the next list I land on should restore its page" — but the page itself is keyed.
const storedPages = ref<Record<string, number>>({})
const preservePage = ref<boolean>(false)

const UNSCOPED_KEY = '__unscoped'

export const datatablePageKey = (system?: unknown, subject?: unknown): string =>
  typeof system === 'string' && typeof subject === 'string' ? `${system}_${subject}` : UNSCOPED_KEY

export function useDatatablePageStore() {
  const setStoredPage = (key: string, page: number) => {
    storedPages.value[key] = page
  }

  const setPreservePage = () => {
    preservePage.value = true
  }

  const consumeStoredPage = (key: string): number | null => {
    if (!preservePage.value) return null
    preservePage.value = false
    return storedPages.value[key] ?? null
  }

  return {
    setStoredPage,
    setPreservePage,
    consumeStoredPage,
  }
}
