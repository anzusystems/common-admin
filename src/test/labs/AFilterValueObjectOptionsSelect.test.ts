import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import AFilterValueObjectOptionsSelect from '@/labs/filters/AFilterValueObjectOptionsSelect.vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/labs/filters/filterInjectionKeys'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import type { ValueObjectOption } from '@/types/ValueObject'

// This was the only labs filter without a `dataCy` prop: every one of them rendered
// data-cy="filter-value", so a bar carrying two of them (a status and an external system, say) had
// no way to tell them apart and an e2e locator resolved to both. The default has to stay
// "filter-value" -- the admins already address dozens of these selects by it.

let mounted: VueWrapper | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const field = (name: string) => ({
  name,
  type: 'custom',
  variant: 'in',
  titleT: 'Status',
  default: [],
  apiName: name,
  clearable: true,
  mandatory: false,
  multiple: true,
  advanced: false,
  exclude: false,
  render: { skip: false, selected: true },
})

function mountSelect(props: Record<string, unknown> = {}) {
  const filterData = reactive({ status: [] }) as unknown as FilterData
  const filterConfig = reactive({
    general: { system: 'test', subject: 'test', elastic: false },
    touched: false,
    fields: { status: field('status') },
  }) as unknown as FilterConfig
  mounted = mount(AFilterValueObjectOptionsSelect, {
    props: { name: 'status', items: [] as ValueObjectOption<string | number>[], ...props },
    attachTo: document.body,
    global: {
      provide: {
        [FilterSubmitResetCounterKey as symbol]: ref(0),
        [FilterSelectedKey as symbol]: ref(new Map<string, ValueObjectOption<string | number>[]>()),
        [FilterConfigKey as symbol]: filterConfig,
        [FilterDataKey as symbol]: filterData,
      },
    },
  })
  return mounted
}

const dataCyOf = (wrapper: VueWrapper) => wrapper.find('[data-cy]').attributes('data-cy')

describe('labs AFilterValueObjectOptionsSelect', () => {
  it('keeps rendering data-cy="filter-value" when nothing is passed', async () => {
    const wrapper = mountSelect()
    await flushPromises()

    expect(dataCyOf(wrapper)).toBe('filter-value')
  })

  it('renders the data-cy it is given, so two selects on one bar can be told apart', async () => {
    const wrapper = mountSelect({ dataCy: 'filter-ext-system' })
    await flushPromises()

    expect(dataCyOf(wrapper)).toBe('filter-ext-system')
  })
})
