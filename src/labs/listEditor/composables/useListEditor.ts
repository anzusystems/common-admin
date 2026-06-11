import { computed, type ComputedRef, type Ref } from 'vue'
import type {
  ListEditorKey,
  ListViewItem,
  PositionHint,
  UseListEditorOptions,
} from '@/labs/listEditor/types/listEditorTypes'
import { renumberPositions } from '@/labs/listEditor/utils/positions'

export interface ListEditorApi<TItem> {
  viewItems: ComputedRef<ListViewItem<TItem>[]>
  addItem: (data: TItem, positionHint?: PositionHint) => TItem[]
  deleteItem: (idOrItem: ListEditorKey | TItem) => TItem[]
  updateItem: (idOrItem: ListEditorKey | TItem, data: TItem) => TItem[]
  moveItem: (fromIndex: number, toIndex: number) => TItem[]
  recalculatePositions: (items: TItem[]) => TItem[]
}

/**
 * Flat list editor core. Pure data behavior shared by AListEditor and
 * ASortableListEditor. Does not touch the DOM, SortableJS, or emits.
 *
 * The caller passes a writable ref (typically `defineModel<TItem[]>`).
 * Mutators write a new array to `model.value` and also return it.
 * Input items are never mutated — when positions need to change, a new
 * item object is produced with `{ ...item, [positionField]: n }`.
 */
export function useListEditor<TItem extends Record<string, any>>(
  model: Ref<TItem[]>,
  options: UseListEditorOptions = {},
): ListEditorApi<TItem> {
  const keyField = options.keyField ?? 'id'
  const positionField = options.positionField ?? 'position'
  const positionMultiplier = options.positionMultiplier ?? 1
  const updatePositionEnabled = options.updatePosition === true

  // Surfaces row-key wiring bugs loudly: rows keyed `undefined` (item lacks the
  // key-field) or two rows sharing one key silently break dirty tracking,
  // validity rails and reorder targeting in ways that are hard to trace from
  // symptoms (QA 85050 BUG-09 class). Deduplicated per signature so a stable
  // bad state warns once, but a new offender warns again.
  const warnedKeySignatures = new Set<string>()
  const warnOnBadKeys = (items: ListViewItem<TItem>[]): void => {
    const seen = new Set<ListEditorKey>()
    const duplicates = new Set<string>()
    let missing = 0
    for (const vi of items) {
      if (vi.key === undefined || vi.key === null) {
        missing++
        continue
      }
      if (seen.has(vi.key)) duplicates.add(String(vi.key))
      seen.add(vi.key)
    }
    if (missing === 0 && duplicates.size === 0) return
    const signature = `${missing}|${[...duplicates].sort().join(',')}`
    if (warnedKeySignatures.has(signature)) return
    warnedKeySignatures.add(signature)
    if (missing > 0) {
      console.warn(
        `[list-editor] ${missing} row(s) resolve to an undefined key (key-field "${keyField}"). ` +
          'Point key-field at a field every item has, or give new items unique temp ids ' +
          '(see nextListEditorTempId).',
      )
    }
    if (duplicates.size > 0) {
      console.warn(
        `[list-editor] duplicate row keys (key-field "${keyField}"): ${[...duplicates].join(', ')}. ` +
          'Row keys must be unique — dirty tracking and validation rails target rows by key.',
      )
    }
  }

  const viewItems = computed<ListViewItem<TItem>[]>(() => {
    const items = model.value.map((raw, index) => ({
      key: raw[keyField] as ListEditorKey,
      index,
      raw,
      position: raw[positionField] as number | undefined,
    }))
    warnOnBadKeys(items)
    return items
  })

  const recalculatePositions = (items: TItem[]): TItem[] =>
    renumberPositions(items, { positionField, positionMultiplier })

  const finalize = (arr: TItem[]): TItem[] => {
    const result = updatePositionEnabled ? recalculatePositions(arr) : arr
    model.value = result
    return result
  }

  const isItem = (value: ListEditorKey | TItem): value is TItem =>
    value !== null && typeof value === 'object'

  const resolveIndexByKey = (items: TItem[], key: ListEditorKey): number =>
    items.findIndex((x) => x[keyField] === key)

  const resolveIndex = (items: TItem[], idOrItem: ListEditorKey | TItem): number => {
    const key = isItem(idOrItem) ? (idOrItem[keyField] as ListEditorKey) : idOrItem
    return resolveIndexByKey(items, key)
  }

  const resolveInsertIndex = (items: TItem[], hint?: PositionHint): number => {
    if (!hint) return items.length
    if (hint.afterId !== undefined) {
      const idx = resolveIndexByKey(items, hint.afterId)
      return idx === -1 ? items.length : idx + 1
    }
    if (hint.afterIndex !== undefined) {
      if (hint.afterIndex < 0) return items.length
      return Math.min(hint.afterIndex + 1, items.length)
    }
    if (hint.index !== undefined) {
      return Math.max(0, Math.min(hint.index, items.length))
    }
    return items.length
  }

  const addItem = (data: TItem, positionHint?: PositionHint): TItem[] => {
    const arr = [...model.value]
    const insertIndex = resolveInsertIndex(arr, positionHint)
    arr.splice(insertIndex, 0, data)
    return finalize(arr)
  }

  const deleteItem = (idOrItem: ListEditorKey | TItem): TItem[] => {
    const idx = resolveIndex(model.value, idOrItem)
    if (idx === -1) return model.value
    const arr = [...model.value]
    arr.splice(idx, 1)
    return finalize(arr)
  }

  const updateItem = (idOrItem: ListEditorKey | TItem, data: TItem): TItem[] => {
    const idx = resolveIndex(model.value, idOrItem)
    if (idx === -1) return model.value
    const arr = [...model.value]
    arr[idx] = data
    return finalize(arr)
  }

  const moveItem = (fromIndex: number, toIndex: number): TItem[] => {
    const len = model.value.length
    if (fromIndex === toIndex) return model.value
    if (fromIndex < 0 || fromIndex >= len) return model.value
    if (toIndex < 0 || toIndex >= len) return model.value
    const arr = [...model.value]
    const [el] = arr.splice(fromIndex, 1)
    arr.splice(toIndex, 0, el)
    return finalize(arr)
  }

  return {
    viewItems,
    addItem,
    deleteItem,
    updateItem,
    moveItem,
    recalculatePositions,
  }
}
