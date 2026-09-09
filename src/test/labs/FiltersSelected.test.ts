import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import FiltersSelected from '@/labs/filters/FiltersSelected.vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
} from '@/labs/filters/filterInjectionKeys'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import type { ValueObjectOption } from '@/types/ValueObject'

// Clearing a filter puts it back to its default. On a field that already holds its default that
// is a no-op, so the close button dropped the chip, wrote the same value back, and the chip
// returned on the next submit - meanwhile the list stayed filtered by a window the user believed
// they had just removed. Forum's post list defaults to a 365 day window and reaches this.

const FROM = '2025-09-08T22:00:00.000000Z'
const UNTIL = '2026-09-09T21:59:59.000000Z'
const OTHER = '2026-01-01T00:00:00.000000Z'

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const field = (name: string, defaultValue: unknown, extra: Record<string, unknown> = {}) => ({
  name,
  type: 'custom',
  variant: 'eq',
  titleT: name,
  default: defaultValue,
  apiName: name,
  clearable: true,
  mandatory: false,
  multiple: Array.isArray(defaultValue),
  advanced: false,
  exclude: false,
  related: undefined,
  render: { skip: false, selected: true },
  ...extra,
})

function mountChips(value: unknown, defaultValue: unknown) {
  const filterData = reactive({ f: value }) as FilterData
  const filterConfig = reactive({
    general: { system: 'test', subject: 'test', elastic: false },
    touched: false,
    fields: { f: field('f', defaultValue) },
  }) as unknown as FilterConfig
  const filterSelected = ref(
    new Map<string, ValueObjectOption<string | number>[]>([
      ['f', [{ title: 'shown', value: 'shown' }]],
    ]),
  )
  mounted = mount(FiltersSelected, {
    global: {
      provide: {
        [FilterSelectedKey as symbol]: filterSelected,
        [FilterConfigKey as symbol]: filterConfig,
        [FilterDataKey as symbol]: filterData,
      },
    },
  })
  return { filterData, filterSelected }
}

const closeButtons = () => mounted!.findAll('.mdi-close-circle')

describe('labs FiltersSelected', () => {
  it('offers no close button on a value that already is the default', async () => {
    mountChips(FROM, FROM)
    await flushPromises()

    expect(closeButtons()).toHaveLength(0)
  })

  it('offers one on a value that differs from the default', async () => {
    mountChips(OTHER, FROM)
    await flushPromises()

    expect(closeButtons()).toHaveLength(1)
  })

  it('offers one when the default is empty, which is the ordinary case', async () => {
    mountChips('typed', null)
    await flushPromises()

    expect(closeButtons()).toHaveLength(1)
  })

  it('offers one on an array at its default, where closing removes a single option', async () => {
    mountChips(['a'], ['a'])
    await flushPromises()

    expect(closeButtons()).toHaveLength(1)
  })
})

// A time interval is a pair behind one chip and clearing writes the default into both, so looking
// only at `from` was not enough. The custom dialog opens prefilled with the current range, so
// shortening just the upper bound leaves `from` at its default while `until` moved - and the
// button still has work to do. The state survives a reload: `from` equals its default and is left
// out of what gets stored, so it comes back from the default on load and the pair repeats.
function mountPair(from: string, until: string, defaultFrom: string, defaultUntil: string) {
  const filterData = reactive({ from, until }) as FilterData
  const filterConfig = reactive({
    general: { system: 'test', subject: 'test', elastic: false },
    touched: false,
    fields: {
      from: field('from', defaultFrom, { type: 'timeInterval', related: 'until' }),
      until: field('until', defaultUntil, { type: 'timeInterval' }),
    },
  }) as unknown as FilterConfig
  const filterSelected = ref(
    new Map<string, ValueObjectOption<string | number>[]>([
      ['from', [{ title: 'range', value: from }]],
    ]),
  )
  mounted = mount(FiltersSelected, {
    global: {
      provide: {
        [FilterSelectedKey as symbol]: filterSelected,
        [FilterConfigKey as symbol]: filterConfig,
        [FilterDataKey as symbol]: filterData,
      },
    },
  })
  return { filterData, filterSelected }
}

describe('labs FiltersSelected - a time interval pair', () => {
  it('offers no close button when both halves are at their default', async () => {
    mountPair(FROM, UNTIL, FROM, UNTIL)
    await flushPromises()

    expect(closeButtons()).toHaveLength(0)
  })

  it('offers one when only the upper bound was moved', async () => {
    mountPair(FROM, OTHER, FROM, UNTIL)
    await flushPromises()

    expect(closeButtons()).toHaveLength(1)
  })

  it('offers one when only the lower bound was moved', async () => {
    mountPair(OTHER, UNTIL, FROM, UNTIL)
    await flushPromises()

    expect(closeButtons()).toHaveLength(1)
  })
})
