import { beforeEach, describe, expect, it } from 'vitest'
import { datatablePageKey, useDatatablePageStore } from '@/domains/system/store/datatablePageStore'

// The remembered page used to live in a single global ref shared by every datatable, so it leaked
// across entities: paging list B to page 5, closing any detail (which sets the preserve flag) and
// then opening list A reopened A on page 5 — a page the user had never been on there. The page is
// now keyed per table; the preserve flag stays global because it means "the next list I land on
// should restore its page", which is exactly what the close button expresses.

const listA = datatablePageKey('cms', 'article')
const listB = datatablePageKey('cms', 'faq')

const { setStoredPage, setPreservePage, consumeStoredPage } = useDatatablePageStore()

beforeEach(() => {
  // Drain a flag left over from a previous case; the store is a module singleton.
  consumeStoredPage(listA)
  setStoredPage(listA, 1)
  setStoredPage(listB, 1)
})

describe('datatablePageKey', () => {
  it('keys by system and subject', () => {
    expect(datatablePageKey('cms', 'article')).toBe('cms_article')
  })

  it('falls back to a shared bucket when either part is missing', () => {
    expect(datatablePageKey('cms', undefined)).toBe('__unscoped')
    expect(datatablePageKey(undefined, 'article')).toBe('__unscoped')
    expect(datatablePageKey(1, 2)).toBe('__unscoped')
  })
})

describe('useDatatablePageStore', () => {
  it('returns null without the preserve flag', () => {
    setStoredPage(listA, 3)

    expect(consumeStoredPage(listA)).toBeNull()
  })

  it('restores the page of the list that stored it', () => {
    setStoredPage(listA, 3)
    setPreservePage()

    expect(consumeStoredPage(listA)).toBe(3)
  })

  it('does not hand one list the page of another', () => {
    setStoredPage(listB, 5)
    setPreservePage()

    // Used to return 5: both lists read the same global slot.
    expect(consumeStoredPage(listA)).toBe(1)
  })

  it('consumes the flag once', () => {
    setStoredPage(listA, 4)
    setPreservePage()

    expect(consumeStoredPage(listA)).toBe(4)
    expect(consumeStoredPage(listA)).toBeNull()
  })

  it('returns null for a list that never stored a page', () => {
    setPreservePage()

    expect(consumeStoredPage(datatablePageKey('cms', 'never-visited'))).toBeNull()
  })
})

describe('preservePageForLanding', () => {
  // A router that only takes the listeners and resolves what it is given.
  const fakeRouter = () =>
    ({
      afterEach: () => () => undefined,
      onError: () => () => undefined,
      resolve: (to: string) => ({ fullPath: to }),
    }) as never

  const deferred = () => {
    let reject!: (error: unknown) => void
    const promise = new Promise<undefined>((_, rej) => (reject = rej))
    return { promise, reject }
  }

  it('leaves the page to a second click when the navigation of the first fails after it', async () => {
    const { preservePageForLanding } = useDatatablePageStore()
    const router = fakeRouter()
    setStoredPage(listA, 3)
    const first = deferred()
    preservePageForLanding(router, { to: '/a', navigation: first.promise })
    preservePageForLanding(router, { to: '/a', navigation: new Promise(() => undefined) })

    first.reject(new Error('first'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(consumeStoredPage(listA)).toBe(3)
  })

  it('drops the page when the navigation of the Close fails', async () => {
    const { preservePageForLanding } = useDatatablePageStore()
    setStoredPage(listA, 3)
    const close = deferred()
    preservePageForLanding(fakeRouter(), { to: '/a', navigation: close.promise })

    close.reject(new Error('close'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(consumeStoredPage(listA)).toBeNull()
  })
})
