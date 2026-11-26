import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, provide, ref } from 'vue'
import type { AxiosInstance } from 'axios'
import ALogDatatable from '@/domains/log/components/ALogDatatable.vue'
import { DEFAULT_LOG_PATHS } from '@/domains/log/composables/logType'
import { resetLogFilterRegistry, useLogFilter, type LogFilter } from '@/domains/log/filter/logFilter'
import { FilterConfigKey, FilterDataKey } from '@/domains/filters/utils/filterInjectionKeys'

vi.mock('@/domains/system/composables/alertsQueue', () => ({ pushAlert: vi.fn() }))

// The log list kept its filter in memory only, so a reload, a shared link or Back lost it.
// It now keeps it in the url hash and local storage like the other lists, per system.

const urls: string[] = []
const get = vi.fn((url: string) => {
  urls.push(url)
  return Promise.resolve({ status: 200, data: { data: [], totalCount: 0 }, config: {} })
})
const client = () => ({ get }) as unknown as AxiosInstance
const debounced = () => new Promise((resolve) => setTimeout(resolve, 260))

let wrapper: VueWrapper | undefined
beforeEach(() => {
  resetLogFilterRegistry()
  localStorage.clear()
  window.location.hash = ''
  urls.length = 0
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  window.location.hash = ''
})

const mountList = async (system = 'cms') => {
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
          type: 'app',
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
    expect(localStorage.getItem('tableFilter_common_log_cms')).toBe('message=Kernel&_sort=id,desc~')
  })

  it('does not take the filter another system stored', async () => {
    localStorage.setItem('tableFilter_common_log_dam', 'message=Other~')
    const { filter } = await mountList('cms')

    expect(filter.filterData.message).toBeNull()
  })
})
