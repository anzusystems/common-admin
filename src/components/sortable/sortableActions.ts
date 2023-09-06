import { computed, type ComputedRef, nextTick, type Ref, ref } from 'vue'
import type { UseSortableReturn } from '@vueuse/integrations/useSortable'
import type { SortableItemDataAware, SortableItemNewPositions } from '@/components/sortable/sortableUtils'
import type { DocId, IntegerId } from '@/types/common'
import { cloneDeep, isNull, isUndefined } from '@/utils/common'
import { generateUUIDv1 } from '@/utils/generator'
import { objectSetValueByPath } from '@/utils/object'

export const HANDLE_CLASS = 'a-sortable-widget__handle'
export const GHOST_CLASS = 'a-sortable-widget__ghost'
export const DRAG_CLASS = 'a-sortable-widget__drag'
export const CHOSEN_CLASS = 'a-sortable-widget__chosen'
export const GROUP_CLASS = 'a-sortable-widget__group'

export type SortablePropItem<TItem = any> = SortableItemDataAware & TItem

export interface SortableItem<TItem = any> {
  key: DocId | IntegerId
  index: number
  raw: SortablePropItem<TItem>
}

export interface SortableEmit {
  (e: 'update:modelValue', data: SortablePropItem[]): void

  (e: 'update:dirty', data: Array<DocId | IntegerId>): void

  (e: 'onEnd', data: SortableItemNewPositions): void

  (e: 'onAddAfter', data: SortableItem): void

  (e: 'onAddLast', data: SortablePropItem | null): void

  (e: 'onEdit', data: SortableItem): void

  (e: 'onDelete', data: SortableItem): void
}

export interface SortableActionsProps {
  dirty: Set<DocId | IntegerId>
  keyField: string
  positionField: string
  updatePosition: boolean
}

export function useSortableActions(
  model: Readonly<Ref<SortablePropItem[]>>,
  initSortableCallback: () => void,
  props: SortableActionsProps,
  emit: SortableEmit
): {
  removeByIndex: (index: number) => SortableItemNewPositions
  updateDataAtIndex: (index: number, data: SortablePropItem, position: number | null, dirty?: boolean | null) => void
  onRemoveDialogConfirm: () => void
  removeById: (id: DocId | IntegerId) => SortableItemNewPositions
  updateData: (id: DocId | IntegerId, data: SortablePropItem, position: number | null, dirty?: boolean | null) => void
  refresh: () => void
  destroy: () => void
  removeDialog: Ref<boolean>
  addAfterId: (targetId: DocId | IntegerId | null, data: SortablePropItem) => SortableItemNewPositions
  forceRerender: Ref<number>
  dirtyLocal: Ref<Set<DocId | IntegerId>>
  widgetEl: Ref<HTMLElement | null>
  itemToRemove: Ref<SortableItem | null>
  sortableInstance: Ref<UseSortableReturn | null>
  randomUuid: Ref<string>
  items: ComputedRef<SortableItem[]>
  moveArrayElement: (from: number, to: number) => SortableItemNewPositions
  addAfterIndex: (targetIndex: number | null, data: SortablePropItem) => SortableItemNewPositions
} {
  const removeDialog = ref(false)
  const itemToRemove = ref<null | SortableItem>(null)
  const widgetEl = ref<HTMLElement | null>(null)
  const randomUuid = ref<string>(generateUUIDv1())
  const sortableInstance = ref<UseSortableReturn | null>(null)
  const forceRerender = ref(0)
  const dirtyLocal = ref(props.dirty)

  function transformItem(item: SortablePropItem, index: number): SortableItem {
    return {
      key: item[props.keyField],
      index,
      raw: item,
    }
  }

  const items = computed(() => {
    return model.value.map((item, index) => transformItem(item, index))
  })

  const forceRerenderWidgetHtml = (emitData: SortablePropItem[] | undefined = undefined) => {
    forceRerender.value++
    if (!isUndefined(emitData)) {
      emit('update:modelValue', emitData)
    }
    nextTick(() => {
      initSortableCallback()
    })
  }

  const touchDirty = (id: DocId | IntegerId) => {
    dirtyLocal.value.add(id)
  }

  const untouchDirty = (id: DocId | IntegerId) => {
    dirtyLocal.value.delete(id)
  }

  const updatePositions = (
    items: SortablePropItem[],
    oldIndex: number,
    newIndex: number,
    updatedPositions: SortableItemNewPositions = []
  ) => {
    const start = oldIndex > newIndex ? newIndex : oldIndex
    let position = start + 1
    for (let i = start; i < items.length; i++) {
      objectSetValueByPath(items[i], props.positionField, position)
      touchDirty(items[i][props.keyField])
      position++
      updatedPositions.push({
        id: items[i].id,
        position: items[i].position,
      })
    }
    return updatedPositions
  }

  const moveArrayElement = (from: number, to: number): SortableItemNewPositions => {
    const clonedData = cloneDeep(model.value)
    if (to >= 0 && to < clonedData.length) {
      let returnData: SortableItemNewPositions = []
      const element = clonedData.splice(from, 1)[0]
      clonedData.splice(to, 0, element)
      if (!isUndefined(props.updatePosition)) {
        returnData = updatePositions(clonedData, from, to)
      }
      emit('update:modelValue', clonedData)
      return returnData
    }
    return []
  }

  const findItemIndexById = (id: DocId | IntegerId, items: SortablePropItem[]) => {
    const idx = items.findIndex((item) => item[props.keyField] === id)
    if (idx === -1) return null
    return idx
  }

  const updateDataCommon = (
    item: SortablePropItem,
    data: SortablePropItem,
    position: number | null,
    dirty: null | boolean = null
  ) => {
    item.data = cloneDeep(data)
    if (!isNull(position)) item.data.position = position
    if (!isNull(dirty)) touchDirty(data.id)
  }

  /**
   * @param id - id of item
   * @param data - item data
   * @param position - item position, use null to skip update and keep original data
   * @param dirty - item dirty, use null to skip update and keep original data
   */
  const updateData = (
    id: DocId | IntegerId,
    data: SortablePropItem,
    position: number | null = null,
    dirty: null | boolean = null
  ) => {
    const clonedData = cloneDeep(model.value)
    const foundIndex = findItemIndexById(id, clonedData)
    if (!isNull(foundIndex) && clonedData[foundIndex]) {
      updateDataCommon(clonedData[foundIndex], data, position, dirty)
      forceRerenderWidgetHtml(clonedData)
    }
  }

  const updateDataAtIndex = (
    index: number,
    data: SortablePropItem,
    position: number | null,
    dirty: null | boolean = null
  ) => {
    const clonedData = cloneDeep(model.value)
    if (clonedData[index]) {
      updateDataCommon(clonedData[index], data, position, dirty)
      forceRerenderWidgetHtml(clonedData)
    }
  }

  /**
   * @template targetIndex null value is when push as last item
   */
  const addAfterIndex = (targetIndex: number | null, data: SortablePropItem): SortableItemNewPositions => {
    const clonedData = cloneDeep(model.value)

    if (isNull(targetIndex)) {
      clonedData.push(cloneDeep(data))
      forceRerenderWidgetHtml(clonedData)
      return []
    }

    const returnData: SortableItemNewPositions = []

    if (clonedData[targetIndex]) {
      clonedData.splice(targetIndex + 1, 0, data)
      updatePositions(clonedData, targetIndex + 1, targetIndex + 1, returnData)
      forceRerenderWidgetHtml(clonedData)
      return returnData
    }
    return []
  }

  /**
   * @template targetId null value is when push as last item
   */
  const addAfterId = (targetId: DocId | IntegerId | null, data: SortablePropItem): SortableItemNewPositions => {
    const clonedData = cloneDeep(model.value)

    if (isNull(targetId)) {
      clonedData.push(cloneDeep(data))
      forceRerenderWidgetHtml(clonedData)
      return []
    }

    const foundIndex = findItemIndexById(targetId, clonedData)
    const returnData: SortableItemNewPositions = []

    if (!isNull(foundIndex) && clonedData[foundIndex]) {
      clonedData.splice(foundIndex + 1, 0, data)
      updatePositions(clonedData, foundIndex + 1, foundIndex + 1, returnData)
      forceRerenderWidgetHtml(clonedData)
      return returnData
    }

    return []
  }

  const removeById = (id: DocId | IntegerId): SortableItemNewPositions => {
    const clonedData = cloneDeep(model.value)
    const foundIndex = findItemIndexById(id, clonedData)

    const returnData: SortableItemNewPositions = []

    if (!isNull(foundIndex) && clonedData[foundIndex]) {
      clonedData.splice(foundIndex, 1)
      updatePositions(clonedData, foundIndex, foundIndex, returnData)
      untouchDirty(id)
      forceRerenderWidgetHtml(clonedData)
      return returnData
    }
    return []
  }

  const removeByIndex = (index: number): SortableItemNewPositions => {
    const clonedData = cloneDeep(model.value)

    const returnData: SortableItemNewPositions = []

    if (clonedData[index]) {
      const id = clonedData[index][props.keyField]
      clonedData.splice(index, 1)
      updatePositions(clonedData, index, index, returnData)
      untouchDirty(id)
      forceRerenderWidgetHtml(clonedData)
      return returnData
    }
    return []
  }

  const destroy = () => {
    if (!widgetEl.value) return
    if (!sortableInstance.value) return
    sortableInstance.value.stop()
    sortableInstance.value = null
  }

  const refresh = () => {
    destroy()
    initSortableCallback()
  }

  const onRemoveDialogConfirm = () => {
    if (isNull(itemToRemove.value)) return
    emit('onDelete', itemToRemove.value)
    removeDialog.value = false
  }

  return {
    items,
    forceRerender,
    dirtyLocal,
    widgetEl,
    randomUuid,
    removeDialog,
    itemToRemove,
    sortableInstance,
    refresh,
    onRemoveDialogConfirm,
    destroy,
    moveArrayElement,
    addAfterId,
    addAfterIndex,
    removeById,
    removeByIndex,
    updateData,
    updateDataAtIndex,
  }
}
