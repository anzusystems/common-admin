import { type InjectionKey, nextTick, type Ref, ref } from 'vue'
import type { UseSortableReturn } from '@vueuse/integrations/useSortable'
import type { SortableItemNewPositions, SortableItemWithParentDataAware } from '@/components/sortable/sortableUtils'
import { useAlerts } from '@/composables/system/alerts'
import { generateUUIDv1 } from '@/utils/generator'
import { cloneDeep, isNull, isUndefined } from '@/utils/common'
import type { DocId, IntegerId } from '@/types/common'

export const NESTED_HANDLE_CLASS = 'a-sortable-nested-widget__handle'
export const NESTED_GHOST_CLASS = 'a-sortable-nested-widget__ghost'
export const NESTED_DRAG_CLASS = 'a-sortable-nested-widget__drag'
export const NESTED_CHOSEN_CLASS = 'a-sortable-nested-widget__chosen'
export const NESTED_GROUP_CLASS = 'a-sortable-nested-widget__group'
export const SortableLevel: InjectionKey<number> = Symbol.for('anzu:SortableLevel')

export interface SortableNestedItem<TData extends SortableItemWithParentDataAware = any> {
  data: TData
  children?: Array<SortableNestedItem> | undefined // if undefined, no nested allowed
  meta: {
    dirty: boolean
  }
}

export interface SortableNested<TData extends SortableItemWithParentDataAware = any> {
  children: Array<SortableNestedItem<TData>>
  meta: {
    dirty: boolean
  }
}

export interface SortableNestedEmit {
  (e: 'update:modelValue', data: SortableNested): void

  (e: 'onEnd', data: SortableItemNewPositions): void

  (e: 'onAddAfter', data: SortableNestedItem): void

  (e: 'onAddChild', data: SortableNestedItem): void

  (e: 'onAddLast', data: SortableNestedItem | null): void

  (e: 'onEdit', data: SortableNestedItem): void

  (e: 'onDelete', data: SortableNestedItem): void
}

export function useSortableNestedActions(
  model: Readonly<Ref<SortableNested>>,
  initSortablesCallback: () => void,
  emit: SortableNestedEmit
): {
  onRemoveDialogConfirm: () => void
  removeById: (id: DocId | IntegerId) => SortableItemNewPositions
  updateData: (
    id: DocId | IntegerId,
    data: any,
    children: Array<SortableNestedItem> | undefined | null,
    position: number | null,
    dirty?: boolean | null,
    parent?: DocId | IntegerId | null | undefined
  ) => void
  refresh: () => void
  destroy: () => void
  removeDialog: Ref<boolean>
  sortableInstances: Ref<Array<UseSortableReturn>>
  addChildToId: (targetId: DocId | IntegerId, data: any, childrenAllowed: boolean) => void
  addAfterId: (targetId: DocId | IntegerId | null, data: any, childrenAllowed: boolean) => SortableItemNewPositions
  forceRerender: Ref<number>
  dragging: Ref<boolean>
  widgetEl: Ref<HTMLElement | null>
  itemToRemove: Ref<SortableNestedItem | null>
  randomUuid: Ref<string>
  moveArrayElement: (
    currentId: DocId | IntegerId,
    targetId: DocId | IntegerId | null,
    newIndex: number,
    oldIndex: number,
    maxDepth: number
  ) => SortableItemNewPositions
} {
  const { showWarningT } = useAlerts()

  const sortableInstances = ref<Array<UseSortableReturn>>([])
  const forceRerender = ref(0)
  const removeDialog = ref(false)
  const itemToRemove = ref<null | SortableNestedItem>(null)
  const dragging = ref(false)
  const widgetEl = ref<HTMLElement | null>(null)
  const randomUuid = ref<string>(generateUUIDv1())

  const forceRerenderWidgetHtml = (emitData: SortableNested | undefined = undefined) => {
    forceRerender.value++
    if (!isUndefined(emitData)) {
      emit('update:modelValue', emitData)
    }
    nextTick(() => {
      initSortablesCallback()
    })
  }

  const refresh = () => {
    destroy()
    initSortablesCallback()
  }

  const onRemoveDialogConfirm = () => {
    if (isNull(itemToRemove.value)) return
    emit('onDelete', itemToRemove.value)
    removeDialog.value = false
  }

  const destroy = () => {
    if (!widgetEl.value) return
    sortableInstances.value.forEach((item) => {
      item.stop()
    })
    sortableInstances.value = []
  }

  const touchDirty = (item: SortableNestedItem, nestedData: SortableNested) => {
    item.meta.dirty = true
    nestedData.meta.dirty = true
  }

  const updatePositionsSameParent = (
    items: SortableNestedItem[],
    oldIndex: number,
    newIndex: number,
    clonedData: SortableNested,
    updatedPositions: SortableItemNewPositions = []
  ) => {
    const start = oldIndex > newIndex ? newIndex : oldIndex
    let position = start + 1
    for (let i = start; i < items.length; i++) {
      if (items[i].data.position !== position) {
        items[i].data.position = position
        touchDirty(items[i], clonedData)
        updatedPositions.push({
          id: items[i].data.id,
          position: items[i].data.position,
        })
      }
      position++
    }
  }
  const updatePositionsDifferentParent = (
    itemsTarget: SortableNestedItem[],
    itemsSource: SortableNestedItem[],
    indexTarget: number,
    indexSource: number,
    clonedData: SortableNested,
    updatedPositions: SortableItemNewPositions = []
  ) => {
    if (itemsTarget.length > 0) {
      let position = indexTarget + 1
      for (let i = indexTarget; i < itemsTarget.length; i++) {
        if (itemsTarget[i].data.position !== position) {
          itemsTarget[i].data.position = position
          touchDirty(itemsTarget[i], clonedData)
          updatedPositions.push({
            id: itemsTarget[i].data.id,
            position: itemsTarget[i].data.position,
          })
        }
        position++
      }
    }
    if (itemsSource.length > 0) {
      let position = indexSource + 1
      for (let i = indexSource; i < itemsSource.length; i++) {
        if (itemsSource[i].data.position !== position) {
          itemsSource[i].data.position = position
          touchDirty(itemsSource[i], clonedData)
          updatedPositions.push({
            id: itemsSource[i].data.id,
            position: itemsSource[i].data.position,
          })
        }
        position++
      }
    }
  }

  const calculateParentDepth = (
    parent: DocId | IntegerId | null,
    items: Array<SortableNestedItem>,
    depth: number = 0
  ): number => {
    if (parent === null) return depth
    const parentItem = items.find((item) => item.data.id === parent)
    if (!parentItem) return depth
    depth++
    return calculateParentDepth(parentItem.data.parent, items, depth)
  }

  const calculateChildDepth = (children: Array<SortableNestedItem> | undefined, depth: number = 0): number => {
    let childDepth = depth
    if (children && children.length) {
      depth++
      for (const child of children) {
        const currentDepth = calculateChildDepth(child.children, depth)
        childDepth = Math.max(childDepth, currentDepth)
      }
    }
    return childDepth
  }

  /**
   * @return number - Max depth of array, root = 1
   */
  const calculateNodeMaxDepth = (
    item: SortableNestedItem,
    items: Array<SortableNestedItem>,
    depth: number = 1
  ): number => {
    const parentDepth = calculateParentDepth(item.data.parent, items)
    const childDepth = calculateChildDepth(item.children, depth)
    return parentDepth + childDepth
  }

  const findItemById = (
    id: DocId | IntegerId,
    arr: SortableNestedItem[],
    parent: SortableNestedItem | null = null
  ): { itemFound: SortableNestedItem | null; parentItem: SortableNestedItem | null } => {
    for (const item of arr) {
      if (item.data.id === id) {
        return {
          itemFound: item,
          parentItem: parent,
        }
      }
      if (item.children) {
        const foundInChildren = findItemById(id, item.children, item)
        if (foundInChildren.itemFound !== null) {
          return foundInChildren
        }
      }
    }

    return {
      itemFound: null,
      parentItem: null,
    }
  }

  // todo refactor
  const moveArrayElement = (
    currentId: DocId | IntegerId,
    targetId: DocId | IntegerId | null,
    newIndex: number,
    oldIndex: number,
    maxDepth: number
  ): SortableItemNewPositions => {
    const clonedData: SortableNested = cloneDeep(model.value)

    const { itemFound: itemToMove, parentItem: itemToMoveParentItem } = findItemById(currentId, clonedData.children)

    if (!itemToMove) {
      console.error('ASortableNested error.')
      return []
    }

    const returnData: SortableItemNewPositions = []

    // moving to root
    if (targetId === null) {
      if (isNull(itemToMoveParentItem) && newIndex === oldIndex) {
        // moving item from root to root, but same place, skip
        return []
      }
      if (isNull(itemToMoveParentItem)) {
        // moving item from root to root
        const idx = clonedData.children.indexOf(itemToMove)
        if (idx !== -1) {
          const element = clonedData.children.splice(idx, 1)[0]
          clonedData.children.splice(newIndex, 0, element)
          updatePositionsSameParent(clonedData.children, idx, newIndex, clonedData, returnData)
          forceRerenderWidgetHtml(clonedData)
          return []
        }
        console.error('ASortableNested error.')
        return []
      }
      if (!isNull(itemToMoveParentItem) && itemToMoveParentItem.children) {
        // moving from non-root to root
        const idx = itemToMoveParentItem.children.indexOf(itemToMove)
        if (idx !== -1) {
          itemToMove.data.parent = null
          const element = itemToMoveParentItem.children.splice(idx, 1)[0]
          clonedData.children.splice(newIndex, 0, element)
          updatePositionsDifferentParent(
            clonedData.children,
            itemToMoveParentItem.children,
            newIndex,
            idx,
            clonedData,
            returnData
          )
          forceRerenderWidgetHtml(clonedData)
          return []
        }
        console.error('ASortableNested error.')
        return []
      }
      console.error('ASortableNested error.')
      return []
    }
    // moving to specific array element
    const { itemFound: targetItem } = findItemById(targetId, clonedData.children)

    if (!targetItem || !targetItem.children) {
      // moving item to undefined children is not allowed by this implementation but allowed by sortablejs
      // so rerender is needed
      forceRerenderWidgetHtml()
      return []
    }

    if (!isNull(itemToMoveParentItem) && itemToMoveParentItem.data.id === targetItem.data.id && newIndex === oldIndex) {
      // moving item from/to same parent and same position, skip
      return []
    }

    if (itemToMoveParentItem && itemToMoveParentItem.children && targetItem.data.id === itemToMoveParentItem.data.id) {
      // moving item inside same parent
      const idx = itemToMoveParentItem.children.indexOf(itemToMove)
      if (idx !== -1) {
        const element = itemToMoveParentItem.children.splice(idx, 1)[0]
        targetItem.children.splice(newIndex, 0, element)
        updatePositionsSameParent(targetItem.children, idx, newIndex, clonedData, returnData)
      }
    } else if (
      itemToMoveParentItem &&
      itemToMoveParentItem.children &&
      targetItem.data.id !== itemToMoveParentItem.data.id
    ) {
      // moving item between two different parents
      const idx = itemToMoveParentItem.children.indexOf(itemToMove)
      if (idx !== -1) {
        itemToMove.data.parent = targetItem.data.id
        const element = itemToMoveParentItem.children.splice(idx, 1)[0]
        targetItem.children.splice(newIndex, 0, element)
        updatePositionsDifferentParent(
          targetItem.children,
          itemToMoveParentItem.children,
          newIndex,
          idx,
          clonedData,
          returnData
        )
      }
    } else {
      // moving from root to non-root
      const idx = clonedData.children.indexOf(itemToMove)
      if (idx !== -1) {
        itemToMove.data.parent = targetItem.data.id
        const element = clonedData.children.splice(idx, 1)[0]
        targetItem.children.splice(newIndex, 0, element)
        updatePositionsDifferentParent(targetItem.children, clonedData.children, newIndex, idx, clonedData, returnData)
      }
    }

    if (calculateNodeMaxDepth(targetItem, clonedData.children) > maxDepth) {
      showWarningT('common.sortable.error.maxDeepExceed')
      forceRerenderWidgetHtml()
      return []
    }
    forceRerenderWidgetHtml(clonedData)
    return returnData
  }

  const removeById = (id: DocId | IntegerId): SortableItemNewPositions => {
    const clonedData: SortableNested = cloneDeep(model.value)
    const { itemFound, parentItem } = findItemById(id, clonedData.children)
    if (!itemFound) {
      return []
    }

    const returnData: SortableItemNewPositions = []

    if (parentItem && parentItem.children) {
      const idx = parentItem.children.indexOf(itemFound)
      if (idx !== -1) {
        parentItem.children.splice(idx, 1)
        updatePositionsSameParent(parentItem.children, idx, idx, clonedData, returnData)
      }
    } else {
      const idx = clonedData.children.indexOf(itemFound)
      if (idx !== -1) {
        clonedData.children.splice(idx, 1)
        updatePositionsSameParent(clonedData.children, idx, idx, clonedData, returnData)
      }
    }

    forceRerenderWidgetHtml(clonedData)
    return returnData
  }

  /**
   * @param id - id of item
   * @param data - item data
   * @param children - item children, use null to skip update and keep original data
   * @param position - item position, use null to skip update and keep original data
   * @param dirty - item dirty, use null to skip update and keep original data
   * @param parent - item parent id, use undefined to skip update and keep original data
   */
  const updateData = (
    id: DocId | IntegerId,
    data: any,
    children: Array<SortableNestedItem> | undefined | null = null,
    position: number | null = null,
    dirty: null | boolean = null,
    parent: DocId | IntegerId | null | undefined = undefined
  ) => {
    const clonedData: SortableNested = cloneDeep(model.value)

    const { itemFound } = findItemById(id, clonedData.children)
    if (!itemFound) {
      return
    }
    itemFound.data = cloneDeep(data)
    if (!isNull(children)) itemFound.children = children
    if (!isNull(position)) itemFound.data.position = position
    if (!isNull(dirty)) itemFound.meta.dirty = dirty
    if (!isNull(dirty) && dirty === true) clonedData.meta.dirty = true
    if (!isUndefined(parent)) itemFound.data.parent = parent
    forceRerenderWidgetHtml(clonedData)
  }

  /**
   * @template targetId null value is when push as last item
   */
  const addAfterId = (
    targetId: DocId | IntegerId | null,
    data: any,
    childrenAllowed: boolean
  ): SortableItemNewPositions => {
    const clonedData: SortableNested = cloneDeep(model.value)

    const insertData: SortableNestedItem = {
      data: cloneDeep(data),
      children: childrenAllowed ? [] : undefined,
      meta: {
        dirty: false,
      },
    }

    if (isNull(targetId)) {
      clonedData.children.push(insertData)
      forceRerenderWidgetHtml(clonedData)
      return []
    }

    const { itemFound: targetItem, parentItem: targetItemParentItem } = findItemById(targetId, clonedData.children)

    if (!targetItem) {
      showWarningT('common.sortable.error.unableToAdd')
      return []
    }
    insertData.data.position = targetItem.data.position + 1
    insertData.data.parent = targetItem.data.parent

    const returnData: SortableItemNewPositions = []

    if (!isNull(targetItemParentItem) && targetItemParentItem.children) {
      const idx = targetItemParentItem.children.indexOf(targetItem) + 1
      if (idx !== -1) {
        targetItemParentItem.children.splice(idx, 0, insertData)
        updatePositionsSameParent(targetItemParentItem.children, idx, idx, clonedData, returnData)
      }
    } else {
      // insert to root
      const idx = clonedData.children.indexOf(targetItem) + 1
      if (idx !== -1) {
        clonedData.children.splice(idx, 0, insertData)
        updatePositionsSameParent(clonedData.children, idx, idx, clonedData, returnData)
      }
    }

    forceRerenderWidgetHtml(clonedData)
    return returnData
  }

  const addChildToId = (targetId: DocId | IntegerId, data: any, childrenAllowed: boolean) => {
    const clonedData: SortableNested = cloneDeep(model.value)

    const { itemFound: targetItem } = findItemById(targetId, clonedData.children)

    if (!targetItem) {
      showWarningT('common.sortable.error.unableToAdd')
      return
    }
    const insertData: SortableNestedItem = {
      data: cloneDeep(data),
      children: childrenAllowed ? [] : undefined,
      meta: {
        dirty: false,
      },
    }
    insertData.data.id = data.id
    insertData.data.position =
      targetItem.children && targetItem.children.length > 0 ? targetItem.children.length + 1 : 1
    insertData.data.parent = targetItem.data.id

    if (!isUndefined(targetItem.children) && targetItem.children.length === 0) {
      targetItem.children.push(insertData)
      forceRerenderWidgetHtml(clonedData)
    }
  }

  return {
    dragging,
    widgetEl,
    randomUuid,
    removeDialog,
    itemToRemove,
    sortableInstances,
    forceRerender,
    refresh,
    onRemoveDialogConfirm,
    destroy,
    moveArrayElement,
    addAfterId,
    addChildToId,
    removeById,
    updateData,
  }
}
