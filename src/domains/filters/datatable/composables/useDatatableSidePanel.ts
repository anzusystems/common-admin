import { useWindowSize } from '@vueuse/core'
import { computed, ref, toValue, watch, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'

export interface DatatableSidePanelWidth {
  /** Window width from which this panel width applies. */
  from: number
  width: number
}

export interface UseDatatableSidePanelOptions {
  /** Narrower windows get no panel; a row click should open the record's detail instead. Default 1000. */
  minWindowWidth?: number
  /** Panel width by window width. Default (also for an empty list) 480 from 1800, 420 from 1500, 360 below. */
  widths?: DatatableSidePanelWidth[]
}

const DEFAULT_WIDTHS: DatatableSidePanelWidth[] = [
  { from: 1800, width: 480 },
  { from: 1500, width: 420 },
  { from: 0, width: 360 },
]

/**
 * State of a panel next to a list that shows the record of the clicked row. Pair it with `ADatatableSidePanel`.
 */
export function useDatatableSidePanel<TId = number>(options: UseDatatableSidePanelOptions = {}) {
  const minWindowWidth = options.minWindowWidth ?? 1000
  const widths = [...(options.widths?.length ? options.widths : DEFAULT_WIDTHS)].sort((a, b) => b.from - a.from)
  const { width: windowWidth } = useWindowSize()

  const selectedId = ref<TId | null>(null) as Ref<TId | null>
  const available = computed(() => windowWidth.value >= minWindowWidth)
  const isOpen = computed(() => available.value && selectedId.value !== null)
  const width = computed(() => (widths.find((one) => windowWidth.value >= one.from) ?? widths.at(-1)!).width)

  /** Shows a record in the panel; false when the window is too narrow for one. */
  const open = (id: TId) => {
    if (!available.value) return false
    selectedId.value = id
    return true
  }

  const close = () => {
    selectedId.value = null
  }

  watch(available, (value) => {
    if (!value) close()
  })

  /** The columns to render: while the panel is open, without the given keys. The stored column setting stays. */
  const columnsWithPanel = <T>(columns: MaybeRefOrGetter<T[]>, hidden: MaybeRefOrGetter<string[]>): ComputedRef<T[]> =>
    computed(() => {
      const all = toValue(columns)
      if (!isOpen.value) return all
      const skip = toValue(hidden)
      return all.filter((column) => {
        const key = (column as { key?: unknown }).key
        return typeof key !== 'string' || !skip.includes(key)
      })
    })

  return {
    selectedId,
    isOpen,
    available,
    width,
    windowWidth,
    open,
    close,
    columnsWithPanel,
  }
}
