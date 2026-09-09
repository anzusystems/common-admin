import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import AFilterDatetimePicker from '@/labs/filters/AFilterDatetimePicker.vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/labs/filters/filterInjectionKeys'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import type { ValueObjectOption } from '@/types/ValueObject'

const FEBRUARY_2023 = '2023-02-08T08:17:29.000000Z'
const DEFAULT_DAY = '2020-01-01T09:15:00.000000Z'

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

function mountFilter(initial: string | null, defaultValue: string | null) {
  const filterData = reactive({ publishedAt: initial }) as FilterData
  const filterConfig = reactive({
    general: { system: 'test', subject: 'test', elastic: false },
    touched: false,
    fields: {
      publishedAt: {
        name: 'publishedAt',
        type: 'datetime',
        variant: 'default',
        titleT: 'Published',
        default: defaultValue,
        apiName: 'publishedAt',
        clearable: true,
        mandatory: false,
        multiple: false,
        advanced: false,
        exclude: false,
        related: undefined,
        render: { skip: false, selected: true },
      },
    },
  }) as unknown as FilterConfig
  const selected = new Map<string, ValueObjectOption<string | number>[]>()
  if (initial) selected.set('publishedAt', [{ title: 'x', value: initial }])
  const filterSelected = ref(selected)
  const changes = { count: 0 }
  mounted = mount(AFilterDatetimePicker, {
    props: { name: 'publishedAt', onChange: () => (changes.count += 1) },
    attachTo: document.body,
    global: {
      provide: {
        [FilterSubmitResetCounterKey as symbol]: ref(0),
        [FilterSelectedKey as symbol]: filterSelected,
        [FilterConfigKey as symbol]: filterConfig,
        [FilterDataKey as symbol]: filterData,
      },
    },
  })
  return { filterData, filterConfig, filterSelected, changes }
}

const clearIcon = () => document.querySelector<HTMLElement>('.a-datetime-picker__clearable-icon')

describe('labs AFilterDatetimePicker', () => {
  it('drops the selected chip and the value when cleared', async () => {
    const { filterData, filterConfig, filterSelected, changes } = mountFilter(FEBRUARY_2023, null)

    clearIcon()!.click()
    await flushPromises()

    expect(filterData.publishedAt).toBeNull()
    expect(filterSelected.value.has('publishedAt')).toBe(false)
    expect(filterConfig.touched).toBe(true)
    expect(changes.count).toBe(1)
  })

  it('returns to the default and drops the chip when cleared with a default', async () => {
    const { filterData, filterSelected } = mountFilter(FEBRUARY_2023, DEFAULT_DAY)

    clearIcon()!.click()
    await flushPromises()

    expect(filterData.publishedAt).toBe(DEFAULT_DAY)
    expect(filterSelected.value.has('publishedAt')).toBe(false)
    expect(clearIcon()).toBeNull()
  })
})
