import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import AFilterTimeInterval from '@/labs/filters/AFilterTimeInterval.vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/labs/filters/filterInjectionKeys'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import type { ValueObjectOption } from '@/types/ValueObject'

// Clearing a filter means "back to the default", and for this pair the default is not always
// "everything" - forum's post list defaults to a 365 day window. `onClear` used to set the display
// to "everything" and then write the default back; the value never changed, so no watcher ran and
// the control kept claiming the list was unfiltered while the query still carried the window.

const FROM = '2025-09-08T22:00:00.000000Z'
const UNTIL = '2026-09-09T21:59:59.000000Z'

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const field = (name: string, defaultValue: string | null, related?: string) => ({
  name,
  type: 'timeInterval',
  variant: 'default',
  titleT: 'Created',
  default: defaultValue,
  apiName: 'createdAt',
  clearable: true,
  mandatory: false,
  multiple: false,
  advanced: false,
  exclude: false,
  related,
  render: { skip: true, selected: true },
})

function mountFilter(defaultFrom: string | null, defaultUntil: string | null) {
  const filterData = reactive({ from: defaultFrom, until: defaultUntil }) as FilterData
  const filterConfig = reactive({
    general: { system: 'test', subject: 'test', elastic: false },
    touched: false,
    fields: { from: field('from', defaultFrom, 'until'), until: field('until', defaultUntil) },
  }) as unknown as FilterConfig
  const filterSelected = ref(new Map<string, ValueObjectOption<string | number>[]>())
  const submitResetCounter = ref(0)
  mounted = mount(AFilterTimeInterval, {
    props: { nameFrom: 'from', nameUntil: 'until' },
    attachTo: document.body,
    global: {
      provide: {
        [FilterSubmitResetCounterKey as symbol]: submitResetCounter,
        [FilterSelectedKey as symbol]: filterSelected,
        [FilterConfigKey as symbol]: filterConfig,
        [FilterDataKey as symbol]: filterData,
      },
    },
  })
  return { filterData, filterSelected, submitResetCounter }
}

describe('labs AFilterTimeInterval', () => {
  it('shows an absolute default as a range, not as "everything"', async () => {
    const { filterSelected } = mountFilter(FROM, UNTIL)
    await flushPromises()

    expect(filterSelected.value.get('from')?.[0].title).toContain('-')
  })

  it('keeps showing the window after clearing, because clearing restores the default', async () => {
    const { filterData, filterSelected } = mountFilter(FROM, UNTIL)
    await flushPromises()

    await (mounted!.vm as unknown as { onClear: () => void }).onClear()
    await flushPromises()

    // The query still carries the window, so the control has to keep saying so.
    expect(filterData.from).toBe(FROM)
    expect(filterData.until).toBe(UNTIL)
    expect(filterSelected.value.has('from')).toBe(true)
  })

  it('clears to "everything" when that is what the default is', async () => {
    const { filterData, filterSelected } = mountFilter(null, null)
    await flushPromises()
    filterData.from = FROM
    filterData.until = UNTIL
    await flushPromises()

    await (mounted!.vm as unknown as { onClear: () => void }).onClear()
    await flushPromises()

    expect(filterData.from).toBeNull()
    expect(filterSelected.value.has('from')).toBe(false)
  })

  it('restores the chip after a reset that left an absolute default in place', async () => {
    const { filterSelected, submitResetCounter } = mountFilter(FROM, UNTIL)
    await flushPromises()

    // What `AFilterWrapper.resetFilter` does: clear to defaults, wipe the chips, bump the counter.
    filterSelected.value.delete('from')
    submitResetCounter.value += 1
    await flushPromises()

    expect(filterSelected.value.has('from')).toBe(true)
  })
})
