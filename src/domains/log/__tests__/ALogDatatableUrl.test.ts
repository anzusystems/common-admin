import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, provide, ref } from 'vue'
import type { AxiosInstance } from 'axios'
import ALogDatatable from '@/domains/log/components/ALogDatatable.vue'
import { DEFAULT_LOG_PATHS, type LogTypeType } from '@/domains/log/composables/logType'
import { resetLogFilterRegistry, useLogFilter, type LogFilter } from '@/domains/log/filter/logFilter'
import { FilterConfigKey, FilterDataKey } from '@/domains/filters/utils/filterInjectionKeys'

vi.mock('@/domains/system/composables/alertsQueue', () => ({ pushAlert: vi.fn() }))

// The log list kept its filter in memory only, so a reload, a shared link or Back lost it.
// It now keeps it in the url hash and local storage like the other lists, per system and type.

const urls: string[] = []
let totalCount = 0
const get = vi.fn((url: string) => {
  urls.push(url)
  return Promise.resolve({ status: 200, data: { data: [], totalCount }, config: {} })
})
const client = () => ({ get }) as unknown as AxiosInstance
const debounced = () => new Promise((resolve) => setTimeout(resolve, 260))

let wrapper: VueWrapper | undefined
beforeEach(() => {
  resetLogFilterRegistry()
  localStorage.clear()
  window.location.hash = ''
  urls.length = 0
  totalCount = 0
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  window.location.hash = ''
})

const mountList = async (system = 'cms', type: LogTypeType = 'app') => {
  let filter: LogFilter | undefined
  const table = ref<InstanceType<typeof ALogDatatable>>()
  wrapper = mount(
    defineComponent(() => {
      filter = useLogFilter(system, undefined)
      provide(FilterConfigKey, filter.filterConfig)
      provide(FilterDataKey, filter.filterData)
      return () =>
        h(ALogDatatable, {
          ref: table,
          client,
          system,
          type,
          logPaths: DEFAULT_LOG_PATHS,
          detailRoute: () => '/',
        })
    })
  )
  await flushPromises()
  await debounced()
  return { filter: filter!, table }
}

describe('ALogDatatable filter in the address', () => {
  it('opens a link with its filter', async () => {
    window.location.hash = '#levelName=error&contextId=abc-1~'
    const { filter } = await mountList()

    expect(filter.filterData.levelName).toEqual(['error'])
    expect(filter.filterData.contextId).toBe('abc-1')
    expect(urls.at(-1)).toContain('filter_in[levelName]=error')
    expect(urls.at(-1)).toContain('filter_eq[context.contextId]=abc-1')
  })

  it('writes a submitted filter into the hash and local storage of its system', async () => {
    const { filter, table } = await mountList()

    filter.filterData.message = 'Kernel'
    table.value!.submitFilter()
    await debounced()

    expect(window.location.hash).toBe('#message=Kernel&_sort=id,desc~')
    expect(localStorage.getItem('tableFilter_common_log_cms_app')).toBe('message=Kernel&_sort=id,desc~')
  })

  it('does not take the filter another system stored', async () => {
    localStorage.setItem('tableFilter_common_log_dam_app', 'message=Other~')
    const { filter } = await mountList('cms')

    expect(filter.filterData.message).toBeNull()
  })

  // A list opened without a hash (the menu, a typed address) restores the view of local storage. With one key for
  // both types, the audit list restored the page the pager had stored for app logs, and a shorter audit showed nothing.
  // The type switch itself: ALogListViewTypeSwitch.test.ts.
  it('keeps the page of app logs out of the audit logs, and back in app logs', async () => {
    totalCount = 500
    await mountList('cms', 'app')
    await wrapper!.find('.anzu-data-footer__icons-after button').trigger('click')
    await debounced()
    expect(urls.at(-1)).toContain('offset=25')
    expect(localStorage.getItem('tableFilter_common_log_cms_app')).toBe('_sort=id,desc&_page=2&_limit=25~')

    wrapper!.unmount()
    window.location.hash = ''
    await mountList('cms', 'audit')
    expect(urls.at(-1)).toContain(DEFAULT_LOG_PATHS.audit)
    expect(urls.at(-1)).toContain('offset=0')
    expect(localStorage.getItem('tableFilter_common_log_cms_audit')).toBeNull()

    wrapper!.unmount()
    window.location.hash = ''
    await mountList('cms', 'app')
    expect(urls.at(-1)).toContain(DEFAULT_LOG_PATHS.app)
    expect(urls.at(-1)).toContain('offset=25')
  })
})
