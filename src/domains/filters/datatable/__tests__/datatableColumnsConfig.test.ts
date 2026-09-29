import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { createDatatableColumnsConfig } from '@/domains/filters/datatable/composables/createDatatableColumnsConfig'

const KEY = 'table_cms_faq'
const wrappers: VueWrapper[] = []

beforeEach(() => localStorage.clear())
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  localStorage.clear()
})

type Args = Parameters<typeof createDatatableColumnsConfig>

/** Runs the composable inside a component, so its `onMounted` fires. */
const setup = (
  config: Args[0] = [{ key: 'id' }, { key: 'texts.title' }, { key: 'createdAt' }],
  hidden: string[] = [],
  moreOptions: Args[4] = {},
  system = 'cms',
  subject = 'faq'
) => {
  const columnsHidden = ref(hidden)
  let result!: ReturnType<typeof createDatatableColumnsConfig>
  const wrapper = mount(
    defineComponent({
      setup() {
        result = createDatatableColumnsConfig(config, columnsHidden, system, subject, moreOptions)
        return () => null
      },
    })
  )
  wrappers.push(wrapper)
  return { ...result, columnsHidden }
}

const keys = (columns: { key: string }[]) => columns.map((c) => c.key)

describe('createDatatableColumnsConfig', () => {
  const customI18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        cms: { faq: { model: { id: 'Id', texts: { title: 'Title' } } } },
        common: { model: { tracking: { createdAt: 'Created at', modifiedAt: 'Modified at' } } },
      },
    },
  })

  it('titles columns from the system, the subject and the tracking fields', () => {
    const { columnsAll } = setup(
      [{ key: 'id' }, { key: 'texts.title' }, { key: 'createdAt' }, { key: 'modifiedAt' }, { key: 'x', title: 'Own' }],
      [],
      { customI18n }
    )
    expect(columnsAll.map((c) => c.title)).toEqual(['Id', 'Title', 'Created at', 'Modified at', 'Own'])
  })

  it('keeps an empty explicit title', () => {
    const { columnsAll } = setup([{ key: 'id', title: '' }], [], { customI18n })
    expect(columnsAll[0].title).toBe('')
  })

  it('answers an empty title without a system', () => {
    const { columnsAll } = setup([{ key: 'id' }], [], {}, '', '')
    expect(columnsAll[0].title).toBe('')
  })

  it('fills the column defaults', () => {
    const { columnsAll } = setup([{ key: 'id', sortable: true }])
    expect(columnsAll[0]).toMatchObject({ key: 'id', sortable: true, fixed: false })
  })

  it('shows every column plus actions, last and fixed', () => {
    const { columnsVisible } = setup()
    expect(keys(columnsVisible.value)).toEqual(['id', 'texts.title', 'createdAt', 'actions'])
    expect(columnsVisible.value.at(-1)).toEqual({ key: 'actions', sortable: false, fixed: 'end' })
  })

  it('leaves out hidden columns and follows changes', async () => {
    const { columnsVisible, columnsHidden } = setup(undefined, ['createdAt'])
    expect(keys(columnsVisible.value)).toEqual(['id', 'texts.title', 'actions'])
    columnsHidden.value = ['id']
    await nextTick()
    expect(keys(columnsVisible.value)).toEqual(['texts.title', 'createdAt', 'actions'])
  })

  it('puts the expand column first and can drop actions', () => {
    const { columnsVisible } = setup(undefined, [], { showExpand: true, disableActions: true })
    expect(keys(columnsVisible.value)).toEqual(['data-table-expand', 'id', 'texts.title', 'createdAt'])
  })

  it('restores hidden columns from storage on mount', () => {
    localStorage.setItem(KEY, JSON.stringify({ hidden: ['id'] }))
    const { columnsHidden, columnsVisible } = setup()
    expect(columnsHidden.value).toEqual(['id'])
    expect(keys(columnsVisible.value)).not.toContain('id')
  })

  it('stores a new set of hidden columns', async () => {
    const { columnsHidden } = setup()
    columnsHidden.value = ['texts.title']
    await nextTick()
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ hidden: ['texts.title'] })
  })

  it('stores under an overridden key, or not at all', async () => {
    const custom = setup(undefined, [], { storeColumnsLocalStorage: 'table_cms_faq_dashboard' })
    custom.columnsHidden.value = ['id']
    await nextTick()
    expect(localStorage.getItem('table_cms_faq_dashboard')).not.toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()

    localStorage.setItem(KEY, JSON.stringify({ hidden: ['id'] }))
    const off = setup(undefined, [], { storeColumnsLocalStorage: false })
    expect(off.columnsHidden.value).toEqual([])
    off.columnsHidden.value = ['createdAt']
    await nextTick()
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ hidden: ['id'] })
  })

  it('drops a corrupted entry instead of breaking the table', () => {
    localStorage.setItem(KEY, '{not json')
    const { columnsHidden } = setup(undefined, ['createdAt'])
    expect(columnsHidden.value).toEqual(['createdAt'])
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('ignores an entry of the wrong shape', () => {
    for (const stored of ['[]', '"x"', '{"hidden":"id"}', 'null', '{}']) {
      localStorage.setItem(KEY, stored)
      const { columnsHidden } = setup(undefined, ['createdAt'])
      expect(columnsHidden.value, stored).toEqual(['createdAt'])
    }
  })

  // Documented: the watch is shallow, so an in-place `push` (admin-cms UserArticleDatatable hides
  // `price` that way) changes the visible columns but is not stored.
  it('shows but does not store an in-place change', async () => {
    const { columnsHidden, columnsVisible } = setup()
    columnsHidden.value.push('id')
    await nextTick()
    expect(keys(columnsVisible.value)).not.toContain('id')
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
