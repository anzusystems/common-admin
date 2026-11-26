import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, reactive, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import sk from '@/locales/sk'
import AFilterTimeInterval from '@/domains/filters/components/AFilterTimeInterval.vue'
import { useFilterTimeIntervalValidators } from '@/domains/filters/composables/filterTimeIntervalTools'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/domains/filters/utils/filterInjectionKeys'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'
import type { ValueObjectOption } from '@/shared/types/ValueObject'

// Clearing a filter means "back to the default", which is not always "everything".
// Forum's post list defaults to a 365 day window.
// `onClear` used to set the display to "everything" and write
// the default back. The value did not change, so no watcher ran.
// The control then claimed the list was unfiltered while the query still carried the window.

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

describe('AFilterTimeInterval', () => {
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

    filterSelected.value.delete('from')
    submitResetCounter.value += 1
    await flushPromises()

    expect(filterSelected.value.has('from')).toBe(true)
  })
})

// "Vlastné" took the current second as the seconds of "until" (23:59 became 23:59:17)
// and named the other field "From"/"Until" in English in every language.
describe('AFilterTimeInterval custom range', () => {
  type DialogVm = {
    onEditInterval: (clear?: boolean) => void
    dialogData: { from: string | null; until: string | null }
  }
  const openDialog = async () => {
    mountFilter(null, null)
    await flushPromises()
    const vm = mounted!.vm as unknown as DialogVm
    vm.onEditInterval(true)
    await flushPromises()
    return vm
  }
  const typeInto = async (index: number, text: string) => {
    const input = document.querySelectorAll<HTMLInputElement>('.v-overlay--active .a-datetime-picker input')[index]!
    input.value = text
    input.dispatchEvent(new Event('input'))
    await flushPromises()
    input.dispatchEvent(new Event('blur'))
    await flushPromises()
  }

  it('starts "until" at the end of the current minute', async () => {
    const vm = await openDialog()

    expect(vm.dialogData.until).toMatch(/:59\.000000Z$/)
  })

  it('keeps a typed "until" at the end of its minute', async () => {
    const vm = await openDialog()

    await typeInto(1, '25.11.2026 23:59')
    expect(dayjs(vm.dialogData.until).format('DD.MM.YYYY HH:mm:ss')).toBe('25.11.2026 23:59:59')

    vm.dialogData.until = null
    await flushPromises()
    await typeInto(1, '26.11.2026 10:15')
    expect(dayjs(vm.dialogData.until).format('DD.MM.YYYY HH:mm:ss')).toBe('26.11.2026 10:15:59')
  })

  it('starts a typed "from" at the start of its minute', async () => {
    const vm = await openDialog()

    await typeInto(0, '25.11.2026 08:30')
    expect(dayjs(vm.dialogData.from).format('DD.MM.YYYY HH:mm:ss')).toBe('25.11.2026 08:30:00')
  })

  it('names the other field in the current language', () => {
    const i18n = createI18n({ legacy: false, locale: 'sk', messages: { sk } })
    let v$: ReturnType<typeof useFilterTimeIntervalValidators>['v$'] | undefined
    mounted = mount(
      defineComponent({
        setup() {
          v$ = useFilterTimeIntervalValidators(ref({ from: UNTIL, until: FROM })).v$
          return () => null
        },
      }),
      { global: { plugins: [i18n] } }
    )
    v$!.value.$touch()

    expect(v$!.value.dialogData.from.$errors[0]?.$params).toMatchObject({ otherDateName: 'Do' })
    expect(v$!.value.dialogData.until.$errors[0]?.$params).toMatchObject({ otherDateName: 'Od' })
  })
})
