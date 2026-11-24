import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useDamAuthorFieldRouting } from '@/domains/dam/author/composables/authorFieldRouting'
import type { DamAuthor } from '@/domains/dam/author/types/DamAuthor'

const { showInfo, showRecordWas, showErrorsDefault } = vi.hoisted(() => ({
  showInfo: vi.fn(),
  showRecordWas: vi.fn(),
  showErrorsDefault: vi.fn(),
}))

vi.mock('@/domains/system/composables/alerts', () => ({
  useAlerts: () => ({ showInfo, showRecordWas, showErrorsDefault }),
}))

const useRouting = () => {
  let routing!: ReturnType<typeof useDamAuthorFieldRouting>
  mount(
    defineComponent({
      setup() {
        routing = useDamAuthorFieldRouting()
        return () => h('div')
      },
    })
  )
  return routing
}

const author = (id: string, source: boolean, currentAuthors: string[] = []) =>
  ({ id, name: id, flags: { source }, currentAuthors }) as unknown as DamAuthor

const route = async (created: DamAuthor, source: boolean | undefined, fetched: DamAuthor[] = []) => {
  const own: DamAuthor[] = []
  const other: DamAuthor[] = []
  const fetchByIds = vi.fn().mockResolvedValue(fetched)
  await useRouting().routeToFields(created, source, fetchByIds, {
    own: (item) => own.push(item),
    other: (item) => other.push(item),
  })
  return { own: own.map((item) => item.id), other: other.map((item) => item.id), fetchByIds }
}

describe('useDamAuthorFieldRouting', () => {
  it('keeps an author of the field kind in the field', async () => {
    expect(await route(author('a', true), true)).toMatchObject({ own: ['a'], other: [] })
  })

  it('sends an author of the other kind to the counterpart field', async () => {
    expect(await route(author('a', false), true)).toMatchObject({ own: [], other: ['a'] })
  })

  it('keeps every author in the field without a field kind', async () => {
    expect(await route(author('a', true), undefined)).toMatchObject({ own: ['a'], other: [] })
  })

  it('replaces a merged author with its current authors, each by its kind', async () => {
    const result = await route(author('m', false, ['s', 'p']), false, [author('s', true), author('p', false)])
    expect(result.fetchByIds).toHaveBeenCalledWith(['s', 'p'])
    expect(result).toMatchObject({ own: ['p'], other: ['s'] })
  })

  it('shows the API error when fetching current authors fails', async () => {
    const error = new Error('fail')
    const fetchByIds = vi.fn().mockRejectedValue(error)
    await useRouting().routeToFields(author('m', false, ['s']), false, fetchByIds, {
      own: vi.fn(),
      other: vi.fn(),
    })
    expect(showErrorsDefault).toHaveBeenCalledWith(error)
  })
})
