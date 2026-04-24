<script setup lang="ts" generic="TItem extends Record<string, any>">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useSlots,
  useTemplateRef,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { useSortable } from '@vueuse/integrations/useSortable'
import {
  useNestedListEditor,
  type NestedViewItem,
} from '@/labs/listEditor/composables/useNestedListEditor'
import {
  computeInstruction,
  type ExecutableInstruction,
  type Instruction,
} from '@/labs/listEditor/composables/useDragInstruction'
import { cloneDeep } from '@/utils/common'
import type {
  ListEditorKey,
  ListEditorValidationState,
  NestedPositionHint,
  NestedTree,
  NestedTreeNode,
} from '@/labs/listEditor/types/listEditorTypes'
import { useAlerts } from '@/composables/system/alerts'
import { stringToInt } from '@/utils/string'
import ANestedRow from '@/labs/listEditor/ANestedRow.vue'

export interface DecoratedNestedViewItem<T> extends NestedViewItem<T> {
  editing: boolean
  expanded: boolean
  childrenExpanded: boolean
  loading: boolean
  dirty: boolean
  moved: boolean
  unsaved: boolean
}

export interface DragState {
  sourceKey: ListEditorKey
  sourceSubtreeDepth: number
  instruction: Instruction | null
}

export type ReorderMode = 'view' | 'reorder'

export interface Props<TItem extends Record<string, any>> {
  maxDepth: number

  keyField?: string
  positionField?: string
  parentField?: string
  positionMultiplier?: number

  readonly?: boolean
  disabled?: boolean
  loading?: boolean
  error?: string | null

  title?: string | null

  compactField?: string | null
  statusField?: string | null

  showAddButton?: boolean
  showAddChildButton?: boolean
  showDeleteButton?: boolean
  showEditButton?: boolean
  showAddAfterAction?: boolean
  showExpandToggle?: boolean

  addLabel?: string | null
  emptyTitle?: string | null
  emptyText?: string | null

  disableRowClick?: boolean
  disableDeleteConfirm?: boolean
  deleteConfirmTitle?: string | null
  deleteConfirmText?: string | null

  closeVariant?: 'auto' | 'icon' | 'labeled'

  loadingKeys?: Set<ListEditorKey> | null

  showReorderToggle?: boolean
  reorderDisabled?: boolean
  disableDrag?: boolean
  toolbarMode?: 'internal' | 'external'
  toolbarBottomOffset?: number

  onDeleteConfirm?: (item: TItem) => Promise<boolean> | boolean
  onDelete?: (item: TItem) => Promise<void> | void
  onItemSave?: (item: TItem) => Promise<void> | void
  onReorderApply?: (tree: NestedTree<TItem>) => Promise<void> | void
}

const props = withDefaults(defineProps<Props<TItem>>(), {
  keyField: 'id',
  positionField: 'position',
  parentField: 'parent',
  positionMultiplier: 1,
  readonly: false,
  disabled: false,
  loading: false,
  error: null,
  title: null,
  compactField: null,
  statusField: null,
  showAddButton: true,
  showAddChildButton: true,
  showDeleteButton: true,
  showEditButton: true,
  showAddAfterAction: false,
  showExpandToggle: true,
  addLabel: null,
  emptyTitle: null,
  emptyText: null,
  disableRowClick: false,
  disableDeleteConfirm: false,
  deleteConfirmTitle: null,
  deleteConfirmText: null,
  closeVariant: 'auto',
  loadingKeys: null,
  showReorderToggle: true,
  reorderDisabled: false,
  disableDrag: false,
  toolbarMode: 'internal',
  toolbarBottomOffset: 12,
  onDeleteConfirm: undefined,
  onDelete: undefined,
  onItemSave: undefined,
  onReorderApply: undefined,
})

const emit = defineEmits<{
  add: [hint: NestedPositionHint | undefined]
  'add-child': [parent: NestedViewItem<TItem>]
  edit: [item: NestedViewItem<TItem>]
  deleted: [item: NestedViewItem<TItem>]
  close: [item: NestedViewItem<TItem>]
  'item-saved': [item: NestedViewItem<TItem>]
  'item-expand': [item: NestedViewItem<TItem>, expanded: boolean]
  'reorder-start': []
  'reorder-cancel': []
  'reorder-applied': [tree: NestedTree<TItem>]
  'reorder-apply-error': [error: unknown]
  'reorder-end': []
  indent: [item: NestedViewItem<TItem>]
  outdent: [item: NestedViewItem<TItem>]
}>()

const modelValue = defineModel<NestedTree<TItem>>({ required: true })
const mode = defineModel<ReorderMode>('mode', { default: 'view' })

// Declare the public slot surface so consumers get typed slot props and so
// `useSlots()` can detect which slots were passed. Without this, forwarding
// slots to <ANestedRow> strips the type info and template refs break.
// Slots carry a variety of scopes (row-level with `raw`, header with `mode`,
// reorder-toolbar with `applying`, empty with `actions`). Using `any` keeps the
// template-compiler surface ergonomic without forcing a union type the consumer
// has to discriminate.

type NestedSlotScope = any
defineSlots<{
  header?(props: NestedSlotScope): unknown
  'reorder-toggle'?(props: NestedSlotScope): unknown
  'reorder-toolbar'?(props: NestedSlotScope): unknown
  empty?(props: NestedSlotScope): unknown
  'add-button'?(props: NestedSlotScope): unknown
  item?(props: NestedSlotScope): unknown
  'item-compact'?(props: NestedSlotScope): unknown
  'item-readonly'?(props: NestedSlotScope): unknown
  'item-status'?(props: NestedSlotScope): unknown
  'item-footer'?(props: NestedSlotScope): unknown
  'item-actions'?(props: NestedSlotScope): unknown
  'before-item'?(props: NestedSlotScope): unknown
  'after-item'?(props: NestedSlotScope): unknown
}>()

const { t } = useI18n()
const slots = useSlots()
const display = useDisplay()
const { showWarningT } = useAlerts()

const isTouch = computed<boolean>(() => display.platform.value.touch)

const effectiveCloseVariant = computed<'icon' | 'labeled'>(() => {
  if (props.closeVariant === 'icon') return 'icon'
  if (props.closeVariant === 'labeled') return 'labeled'
  return display.smAndDown.value ? 'icon' : 'labeled'
})

const editingKeys = ref<Set<ListEditorKey>>(new Set())
const editingSnapshots = ref(new Map<ListEditorKey, TItem>()) as import('vue').Ref<
  Map<ListEditorKey, TItem>
>
// Tree-level expand/collapse — controls which descendants are visible in the flat
// viewItems list. Auto-populated at mount for every node that has children.
const childrenExpandedKeys = ref<Set<ListEditorKey>>(new Set())
// Row-level readonly detail visibility — used in readonly mode with #item-readonly slot.
// Independent of children expansion, so a node can have its subtree visible while its
// own detail body is collapsed, and vice versa.
const detailExpandedKeys = ref<Set<ListEditorKey>>(new Set())

const initChildrenExpanded = (tree: NestedTree<TItem>) => {
  const walk = (nodes: NestedTreeNode<TItem>[]) => {
    for (const n of nodes) {
      if (n.children && n.children.length > 0) {
        childrenExpandedKeys.value.add(n.data[props.keyField] as ListEditorKey)
        walk(n.children)
      }
    }
  }
  walk(tree.children)
}
// One-shot init at setup time — subsequent expansions are user-driven.
// eslint-disable-next-line vue/no-ref-object-reactivity-loss
initChildrenExpanded(modelValue.value)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const editor = useNestedListEditor<TItem>(modelValue, {
  keyField: props.keyField,
  positionField: props.positionField,
  parentField: props.parentField,
  positionMultiplier: props.positionMultiplier,
  maxDepth: props.maxDepth,
  expandedKeys: childrenExpandedKeys,
})

// Dirty baseline — compare JSON of each node.data against initial snapshot keyed by id.
const dirtyBaseline = ref(new Map<ListEditorKey, string>()) as import('vue').Ref<
  Map<ListEditorKey, string>
>
const captureDirtyBaseline = () => {
  const next = new Map<ListEditorKey, string>()
  const walk = (nodes: NestedTreeNode<TItem>[]) => {
    for (const n of nodes) {
      next.set(n.data[props.keyField] as ListEditorKey, JSON.stringify(n.data))
      if (n.children && n.children.length) walk(n.children)
    }
  }
  walk(modelValue.value.children)
  dirtyBaseline.value = next
}
captureDirtyBaseline()

// Reorder snapshot — captures the tree at reorder-start so we can detect "moved" items
// (row is at a different index in the flat visible order) and restore on cancel.
const snapshot = ref<NestedTree<TItem> | null>(null)
const snapshotKeyIndex = computed<Map<ListEditorKey, number>>(() => {
  const map = new Map<ListEditorKey, number>()
  if (!snapshot.value) return map
  const walk = (nodes: NestedTreeNode<TItem>[]) => {
    for (const n of nodes) {
      map.set(n.data[props.keyField] as ListEditorKey, map.size)
      if (n.children && n.children.length) walk(n.children)
    }
  }
  walk(snapshot.value.children as NestedTreeNode<TItem>[])
  return map
})
const snapshotParentIndex = computed<Map<ListEditorKey, ListEditorKey | null>>(() => {
  const map = new Map<ListEditorKey, ListEditorKey | null>()
  if (!snapshot.value) return map
  const walk = (
    nodes: NestedTreeNode<TItem>[],
    parentKey: ListEditorKey | null,
  ) => {
    for (const n of nodes) {
      map.set(n.data[props.keyField] as ListEditorKey, parentKey)
      if (n.children && n.children.length) walk(n.children, n.data[props.keyField] as ListEditorKey)
    }
  }
  walk(snapshot.value.children as NestedTreeNode<TItem>[], null)
  return map
})

const isItemDirty = (vi: NestedViewItem<TItem>): boolean => {
  const baseline = dirtyBaseline.value.get(vi.key)
  if (baseline === undefined) return true
  return baseline !== JSON.stringify(vi.raw)
}

const viewItemsDecorated = computed<DecoratedNestedViewItem<TItem>[]>(() => {
  return editor.viewItems.value.map((vi) => {
    const initialIdx = snapshotKeyIndex.value.get(vi.key)
    const initialParent = snapshotParentIndex.value.get(vi.key)
    const moved =
      snapshot.value !== null
      && ((initialIdx !== undefined && initialIdx !== vi.index) || initialParent !== vi.parentKey)
    const dirty = isItemDirty(vi)
    return {
      ...vi,
      editing: editingKeys.value.has(vi.key),
      expanded: detailExpandedKeys.value.has(vi.key),
      childrenExpanded: childrenExpandedKeys.value.has(vi.key),
      loading: props.loadingKeys?.has(vi.key) ?? false,
      dirty,
      moved,
      unsaved: dirty || moved,
    }
  })
})

const isEmpty = computed(() => modelValue.value.children.length === 0)
const totalItemCount = computed(() => editor.viewItems.value.length)

const movedCount = computed(() => viewItemsDecorated.value.filter((v) => v.moved).length)
const hasPendingChanges = computed(() => movedCount.value > 0)

const applying = ref(false)
const applyError = ref<string | null>(null)

const rowsContainer = useTemplateRef<HTMLElement>('rowsContainer')

const reorderMode = computed(() => mode.value === 'reorder')
const canInteract = computed(() => !props.readonly && !props.disabled && !props.loading)
const canEnterReorder = computed(
  () => canInteract.value && !props.reorderDisabled && totalItemCount.value > 1,
)
const canAdd = computed(() => canInteract.value && props.showAddButton && !reorderMode.value)
const dragEnabled = computed(
  () => reorderMode.value && !isTouch.value && !props.disableDrag,
)

const addLabelResolved = computed(() => props.addLabel ?? t('common.sortable.add'))
const emptyTitleResolved = computed(() => props.emptyTitle ?? t('common.sortable.emptyTitle'))
const emptyTextResolved = computed(() => props.emptyText ?? t('common.sortable.emptyText'))
const deleteConfirmTitleResolved = computed(
  () => props.deleteConfirmTitle ?? t('common.sortable.deleteConfirmTitle'),
)
const deleteConfirmTextResolved = computed(
  () => props.deleteConfirmText ?? t('common.sortable.deleteConfirmText'),
)

const reorderToggleVisible = computed<boolean>(
  (): boolean =>
    !props.readonly
    && props.showReorderToggle
    && !reorderMode.value
    && totalItemCount.value > 0,
)

const compactReorderButton = computed<boolean>(
  (): boolean => !!props.title && display.smAndDown.value,
)

// Keys of every node that *has* children — the candidates for expand/collapse.
const expandableKeys = computed<ListEditorKey[]>(() => {
  const out: ListEditorKey[] = []
  const walk = (nodes: NestedTreeNode<TItem>[]) => {
    for (const n of nodes) {
      if (n.children && n.children.length > 0) {
        out.push(n.data[props.keyField] as ListEditorKey)
        walk(n.children)
      }
    }
  }
  walk(modelValue.value.children)
  return out
})

const allExpanded = computed<boolean>(() =>
  expandableKeys.value.length > 0
  && expandableKeys.value.every((k) => childrenExpandedKeys.value.has(k)),
)

const expandAllVisible = computed<boolean>(
  () => !reorderMode.value && expandableKeys.value.length > 0,
)

const toggleExpandAll = () => {
  if (allExpanded.value) {
    for (const k of expandableKeys.value) childrenExpandedKeys.value.delete(k)
  } else {
    for (const k of expandableKeys.value) childrenExpandedKeys.value.add(k)
  }
}

const headerVisible = computed<boolean>(
  (): boolean =>
    !!(
      props.title
      || (slots as Record<string, unknown>).header
      || (slots as Record<string, unknown>)['reorder-toggle']
      || reorderToggleVisible.value
      || expandAllVisible.value
    ),
)

const isInlineEdit = computed(() => !!(slots as Record<string, unknown>).item)
const hasReadonlyDetail = computed(
  () => !!(slots as Record<string, unknown>)['item-readonly'],
)
const showInlineSaveFooter = computed(() => !!props.onItemSave)

const deleteDialog = ref(false)
const deleteTarget = ref<NestedViewItem<TItem> | null>(null)
const deleteInFlight = ref(false)
const deleteError = ref<string | null>(null)

const pendingAutoOpen = ref(false)
watch(
  () => {
    const keys: ListEditorKey[] = []
    const walk = (nodes: NestedTreeNode<TItem>[]) => {
      for (const n of nodes) {
        keys.push(n.data[props.keyField] as ListEditorKey)
        if (n.children && n.children.length) walk(n.children)
      }
    }
    walk(modelValue.value.children)
    return keys
  },
  (newKeys, oldKeys) => {
    if (!pendingAutoOpen.value) return
    pendingAutoOpen.value = false
    const oldSet = new Set(oldKeys ?? [])
    const addedKey = newKeys.find((k) => !oldSet.has(k))
    if (addedKey === undefined) return
    const { node: newNode } = editor.findNode(addedKey)
    if (!newNode) return
    if (!isInlineEdit.value) return
    if (!editingSnapshots.value.has(addedKey)) {
      editingSnapshots.value.set(addedKey, cloneDeep(newNode.data) as TItem)
    }
    editingKeys.value.add(addedKey)
    // Make sure ancestors are expanded so the new row is visible.
    const { parent } = editor.findNode(addedKey)
    if (parent) childrenExpandedKeys.value.add(parent.data[props.keyField] as ListEditorKey)
  },
)

// Initialize nested SortableJS groups. We create one Sortable instance per group
// so drag/drop can move items within/between groups — SortableJS handles the
// pointer events; onEnd reconciles via editor.moveTo().
const sortableInstances = ref<Array<{ stop: () => void; option?: (k: string, v: unknown) => void }>>(
  [],
)
const forceRerender = ref(0)

const destroySortables = () => {
  for (const s of sortableInstances.value) {
    try {
      s.stop()
    } catch {
      // no-op
    }
  }
  sortableInstances.value = []
}

const GROUP_CLASS = 'a-nested-list-editor__group'
const HANDLE_CLASS = 'a-nested-list-editor__drag-handle'

// Live drag state. `instruction` is recomputed on every pointermove while
// drag is active — it encodes WHERE the dragged item will land (sibling-above/
// below/make-child/blocked) and at WHAT DEPTH. The overlay template reads it
// to render the drop indicator; `onEnd` applies it via `editor.moveTo`.
//
// We don't rely on SortableJS to move the DOM — onMove always returns false.
// SortableJS is reduced to "drag lifecycle + floating clone"; hit-testing,
// depth picking and the final mutation are all ours.
const dragState = ref<DragState | null>(null)

// CSS-aligned constants. Row header padding-left in reorder mode is
// `calc(12px + depth * var(--ansle-indent))` where --ansle-indent is 24px
// (18px on mobile — but drag is disabled on touch so we don't care).
const INDENT_PX = 24
const ROW_PAD_LEFT = 12

const hitTestRow = (
  clientX: number,
  clientY: number,
): { el: HTMLElement; viewItem: DecoratedNestedViewItem<TItem> } | null => {
  const hit = document.elementFromPoint(clientX, clientY) as HTMLElement | null
  if (!hit) return null
  const wrapper = hit.closest('.a-nested-list-editor__row-wrapper') as HTMLElement | null
  if (!wrapper) return null
  // Only consider wrappers inside our rowsContainer — elementFromPoint could
  // hit a different ANestedSortableListEditor instance on the same page.
  if (!rowsContainer.value || !rowsContainer.value.contains(wrapper)) return null
  const key = parseKey(wrapper.getAttribute('data-id'))
  if (key === null) return null
  const vi = viewItemsDecorated.value.find((v) => v.key === key)
  if (!vi) return null
  return { el: wrapper, viewItem: vi }
}

const recomputeInstruction = (clientX: number, clientY: number) => {
  if (!dragState.value || !rowsContainer.value) return
  const hit = hitTestRow(clientX, clientY)
  if (!hit) {
    dragState.value.instruction = null
    return
  }
  const containerRect = rowsContainer.value.getBoundingClientRect()
  // For hovered-row rect we read the row element (not the whole wrapper,
  // whose height balloons when children are rendered). The wrapper's first
  // `.a-nested-list-editor__row` child is the header+body we want to hit-test.
  const rowEl = hit.el.querySelector(
    ':scope > .a-nested-list-editor__row',
  ) as HTMLElement | null
  const rowRect = (rowEl ?? hit.el).getBoundingClientRect()
  dragState.value.instruction = computeInstruction({
    pointer: { x: clientX, y: clientY },
    hoveredRow: {
      key: hit.viewItem.key,
      rect: rowRect,
      depth: hit.viewItem.depth,
      parentKey: hit.viewItem.parentKey,
      siblingIndex: hit.viewItem.siblingIndex,
      siblingCount: hit.viewItem.siblingCount,
    },
    sourceKey: dragState.value.sourceKey,
    sourceSubtreeDepth: dragState.value.sourceSubtreeDepth,
    viewItems: viewItemsDecorated.value,
    maxDepth: props.maxDepth,
    indentPx: INDENT_PX,
    containerLeft: containerRect.left,
    containerPaddingLeft: ROW_PAD_LEFT,
  })
}

const onPointerMove = (e: PointerEvent) => {
  recomputeInstruction(e.clientX, e.clientY)
}

const applyInstruction = (inst: ExecutableInstruction, sourceKey: ListEditorKey) => {
  const res = editor.moveTo(sourceKey, inst.parentKey, inst.index)
  if (res === null) {
    showWarningT('common.sortable.error.maxDeepExceed')
    forceRerender.value++
    nextTick(() => initSortables())
  }
}

const initSortables = () => {
  destroySortables()
  if (!dragEnabled.value) return
  if (!rowsContainer.value) return
  const groups = Array.from(
    rowsContainer.value.querySelectorAll<HTMLElement>('.' + GROUP_CLASS),
  )
  for (const group of groups) {
    const sortable = useSortable(group, [], {
      group: { name: 'a-nested', pull: true, put: true },
      handle: '.' + HANDLE_CLASS,
      animation: 0,
      ghostClass: 'a-nested-list-editor__row--ghost',
      chosenClass: 'a-nested-list-editor__row--chosen',
      dragClass: 'a-nested-list-editor__row--drag',
      fallbackOnBody: true,
      forceFallback: true,
      fallbackTolerance: 3,
      onStart: (event) => {
        const draggedEl = event.item as HTMLElement
        const id = parseKey(draggedEl.getAttribute('data-id'))
        if (id === null) return
        const draggedNode = editor.findNode(id).node
        const subtreeDepth = draggedNode ? editor.calculateSubtreeDepth(draggedNode) : 1
        dragState.value = {
          sourceKey: id,
          sourceSubtreeDepth: subtreeDepth,
          instruction: null,
        }
        document.addEventListener('pointermove', onPointerMove, { passive: true })
      },
      onMove: (event) => {
        // Track pointer via SortableJS's event stream too (redundant with
        // document pointermove but keeps `instruction` in sync when the
        // browser coalesces pointermove events during fast drags).
        const orig = (event as unknown as { originalEvent?: Event }).originalEvent
        if (orig) {
          if ('clientX' in orig && 'clientY' in orig) {
            recomputeInstruction((orig as MouseEvent).clientX, (orig as MouseEvent).clientY)
          } else if ('touches' in orig) {
            const tev = orig as TouchEvent
            if (tev.touches.length > 0) {
              recomputeInstruction(tev.touches[0].clientX, tev.touches[0].clientY)
            }
          }
        }
        // Always refuse SortableJS's own DOM insertion — our overlay and
        // `editor.moveTo` in onEnd drive the actual move.
        return false
      },
      onEnd: () => {
        document.removeEventListener('pointermove', onPointerMove)
        const state = dragState.value
        dragState.value = null
        if (!state) return
        const inst = state.instruction
        if (inst === null) return
        if (inst.type === 'blocked') return
        applyInstruction(inst, state.sourceKey)
      },
    })
    sortableInstances.value.push(sortable)
  }
}

const parseKey = (raw: string | null): ListEditorKey | null => {
  if (raw === null || raw === '') return null
  const n = stringToInt(raw)
  if (n > 0) return n
  // Fallback to string keys (DocId)
  return raw
}

watch(
  () => dragEnabled.value,
  () => {
    if (dragEnabled.value) nextTick(() => initSortables())
    else destroySortables()
  },
)

watch(
  () => forceRerender.value,
  () => {
    if (dragEnabled.value) nextTick(() => initSortables())
  },
)

// Rebuild sortable instances whenever the tree shape changes during drag/drop mode —
// otherwise newly rendered groups would not be draggable.
watch(
  () => viewItemsDecorated.value.map((v) => v.key).join('|'),
  () => {
    if (dragEnabled.value) nextTick(() => initSortables())
  },
)

onMounted(() => {
  if (dragEnabled.value) initSortables()
})
onBeforeUnmount(() => {
  destroySortables()
  document.removeEventListener('pointermove', onPointerMove)
})

// Visual props derived from the current instruction. Re-reads DOM rects on
// every instruction change, which is fine because the user can't scroll or
// resize in the middle of a frame. `null` = overlay hidden.
type OverlayVisual =
  | { kind: 'line'; blocked: boolean; top: number; left: number; right: number }
  | { kind: 'box'; blocked: boolean; top: number; left: number; width: number; height: number }

const overlayVisual = computed<OverlayVisual | null>(() => {
  const state = dragState.value
  if (!state || state.instruction === null || !rowsContainer.value) return null
  const inst = state.instruction
  const blocked = inst.type === 'blocked'
  const effective: ExecutableInstruction = blocked ? inst.desired : inst
  const refWrapper = rowsContainer.value.querySelector<HTMLElement>(
    `.a-nested-list-editor__row-wrapper[data-id="${CSS.escape(String(effective.refKey))}"]`,
  )
  if (!refWrapper) return null
  const rowEl = refWrapper.querySelector<HTMLElement>(
    ':scope > .a-nested-list-editor__row',
  )
  const containerRect = rowsContainer.value.getBoundingClientRect()
  const rowRect = (rowEl ?? refWrapper).getBoundingClientRect()

  if (effective.type === 'make-child') {
    return {
      kind: 'box',
      blocked,
      top: rowRect.top - containerRect.top,
      left: rowRect.left - containerRect.left,
      width: rowRect.width,
      height: rowRect.height,
    }
  }
  const top =
    effective.type === 'sibling-above'
      ? rowRect.top - containerRect.top
      : rowRect.bottom - containerRect.top
  return {
    kind: 'line',
    blocked,
    top,
    left: ROW_PAD_LEFT + effective.depth * INDENT_PX,
    right: 16,
  }
})

const onAddClick = () => {
  if (!canAdd.value) return
  pendingAutoOpen.value = true
  emit('add', undefined)
}

const onRowAddAfterClick = (vi: NestedViewItem<TItem>) => {
  if (!canInteract.value) return
  pendingAutoOpen.value = true
  emit('add', { afterId: vi.key, childrenAllowed: vi.childrenAllowed })
}

const onAddChildClick = (vi: NestedViewItem<TItem>) => {
  if (!canInteract.value) return
  if (!vi.canAddChild) return
  pendingAutoOpen.value = true
  childrenExpandedKeys.value.add(vi.key)
  emit('add-child', vi)
  emit('add', { parentId: vi.key, asFirstChild: true, childrenAllowed: true })
}

const onEditClick = (vi: NestedViewItem<TItem>) => {
  if (!canInteract.value || reorderMode.value) return
  // Clicking the edit affordance while already editing closes the form — so the
  // pencil button works as a toggle just like clicking the row header.
  if (editingKeys.value.has(vi.key)) {
    onCloseClick(vi)
    return
  }
  if (isInlineEdit.value) {
    if (!editingSnapshots.value.has(vi.key)) {
      editingSnapshots.value.set(vi.key, cloneDeep(vi.raw) as TItem)
    }
    editingKeys.value.add(vi.key)
  }
  emit('edit', vi)
}

// Chevron click — toggles tree children visibility.
const onChevronClick = (vi: NestedViewItem<TItem>) => {
  if (props.disabled || props.loading) return
  const key = vi.key
  const currently = childrenExpandedKeys.value.has(key)
  if (currently) childrenExpandedKeys.value.delete(key)
  else childrenExpandedKeys.value.add(key)
  emit('item-expand', vi, !currently)
}

// Detail body toggle — controls the row's readonly-detail body (separate from tree).
const onDetailToggle = (vi: NestedViewItem<TItem>) => {
  if (props.disabled || props.loading) return
  const key = vi.key
  const currently = detailExpandedKeys.value.has(key)
  if (currently) detailExpandedKeys.value.delete(key)
  else detailExpandedKeys.value.add(key)
  emit('item-expand', vi, !currently)
}

const isRowClickable = (vi: DecoratedNestedViewItem<TItem>): boolean => {
  if (props.disableRowClick) return false
  if (props.disabled || props.loading) return false
  if (reorderMode.value) return false
  if (vi.editing || vi.expanded) return true
  if (!props.readonly && props.showEditButton) return true
  if (props.readonly && hasReadonlyDetail.value) return true
  return false
}

const onRowClick = (vi: DecoratedNestedViewItem<TItem>) => {
  if (!isRowClickable(vi)) return
  if (vi.editing || vi.expanded) {
    onCloseClick(vi)
    return
  }
  if (props.readonly && hasReadonlyDetail.value) onDetailToggle(vi)
  else onEditClick(vi)
}

const performDelete = async (vi: NestedViewItem<TItem>): Promise<boolean> => {
  deleteError.value = null
  if (props.onDeleteConfirm) {
    const ok = await props.onDeleteConfirm(vi.raw)
    if (!ok) return false
  }
  if (props.onDelete) {
    deleteInFlight.value = true
    try {
      await props.onDelete(vi.raw)
    } catch (err) {
      deleteInFlight.value = false
      deleteError.value = err instanceof Error ? err.message : String(err)
      return false
    }
    deleteInFlight.value = false
  }
  editor.deleteItem(vi.key)
  editingKeys.value.delete(vi.key)
  editingSnapshots.value.delete(vi.key)
  detailExpandedKeys.value.delete(vi.key)
  childrenExpandedKeys.value.delete(vi.key)
  emit('deleted', vi)
  return true
}

const onDeleteClick = async (vi: NestedViewItem<TItem>) => {
  if (!canInteract.value) return
  if (props.disableDeleteConfirm) {
    await performDelete(vi)
    return
  }
  deleteTarget.value = vi
  deleteError.value = null
  deleteDialog.value = true
}

const onDeleteDialogConfirm = async () => {
  if (!deleteTarget.value) return
  const ok = await performDelete(deleteTarget.value as NestedViewItem<TItem>)
  if (ok) {
    deleteDialog.value = false
    deleteTarget.value = null
  }
}

const onDeleteDialogCancel = () => {
  if (deleteInFlight.value) return
  deleteDialog.value = false
  deleteTarget.value = null
  deleteError.value = null
}

const onSaveClick = async (vi: NestedViewItem<TItem>) => {
  if (props.onItemSave) await props.onItemSave(vi.raw)
  editingKeys.value.delete(vi.key)
  editingSnapshots.value.delete(vi.key)
  emit('item-saved', vi)
}

const onCancelClick = (vi: NestedViewItem<TItem>) => {
  const snap = editingSnapshots.value.get(vi.key)
  if (snap) editor.updateItem(vi.key, snap as TItem)
  editingKeys.value.delete(vi.key)
  editingSnapshots.value.delete(vi.key)
}

const onCloseClick = (vi: NestedViewItem<TItem>) => {
  editingKeys.value.delete(vi.key)
  editingSnapshots.value.delete(vi.key)
  emit('close', vi)
}

const moveUp = (id: ListEditorKey) => {
  editor.moveUp(id)
}
const moveDown = (id: ListEditorKey) => {
  editor.moveDown(id)
}
const moveTop = (id: ListEditorKey) => {
  editor.moveTop(id)
}
const moveBottom = (id: ListEditorKey) => {
  editor.moveBottom(id)
}
const doIndent = (vi: NestedViewItem<TItem>) => {
  const res = editor.indent(vi.key)
  if (res === null) {
    showWarningT('common.sortable.error.maxDeepExceed')
    return
  }
  emit('indent', vi)
}
const doOutdent = (vi: NestedViewItem<TItem>) => {
  const res = editor.outdent(vi.key)
  if (res === null) return
  emit('outdent', vi)
}

const enterReorderMode = () => {
  if (!canEnterReorder.value || reorderMode.value) return
  editingKeys.value.clear()
  editingSnapshots.value.clear()
  // Expand every branch so the user can see (and reach) every row before
  // picking something to drag — otherwise collapsed subtrees would be invisible
  // reorder targets.
  for (const k of expandableKeys.value) childrenExpandedKeys.value.add(k)
  snapshot.value = cloneDeep(modelValue.value) as NestedTree<TItem>
  applyError.value = null
  mode.value = 'reorder'
  emit('reorder-start')
  nextTick(() => {
    if (dragEnabled.value) initSortables()
  })
}

const cancelReorderMode = () => {
  if (!reorderMode.value) return
  if (snapshot.value) modelValue.value = snapshot.value as NestedTree<TItem>
  snapshot.value = null
  applyError.value = null
  applying.value = false
  mode.value = 'view'
  destroySortables()
  emit('reorder-cancel')
  emit('reorder-end')
}

const applyReorder = async () => {
  if (!reorderMode.value) return
  const tree = cloneDeep(modelValue.value) as NestedTree<TItem>
  applyError.value = null
  if (props.onReorderApply) {
    applying.value = true
    try {
      await props.onReorderApply(tree)
    } catch (err) {
      applying.value = false
      applyError.value = err instanceof Error ? err.message : String(err)
      emit('reorder-apply-error', err)
      return
    }
    applying.value = false
  }
  snapshot.value = null
  mode.value = 'view'
  destroySortables()
  emit('reorder-applied', tree)
  emit('reorder-end')
}

watch(mode, (newMode, oldMode) => {
  if (newMode === 'reorder' && oldMode !== 'reorder') {
    if (!snapshot.value) snapshot.value = cloneDeep(modelValue.value) as NestedTree<TItem>
    editingKeys.value.clear()
    editingSnapshots.value.clear()
  }
  if (newMode === 'view' && oldMode === 'reorder' && snapshot.value) {
    snapshot.value = null
    applyError.value = null
    applying.value = false
  }
})

const resolveCompactText = (raw: TItem, key: ListEditorKey): string => {
  const pick = (v: unknown): string | null => (v == null || v === '' ? null : String(v))
  const fromField = props.compactField ? pick(raw[props.compactField]) : null
  if (fromField !== null) return fromField
  const fallbacks = [
    pick(raw.title),
    pick(raw.name),
    pick(raw.texts?.title),
    pick(raw.text),
    pick(key),
  ]
  const hit = fallbacks.find((v): v is string => v !== null)
  return hit ?? t('common.sortable.itemFallback')
}

const resolveValidation = (raw: TItem): ListEditorValidationState => {
  const v = raw.validationState
  if (v === 'valid' || v === 'invalid' || v === 'warning') return v
  return null
}

const buildSlotProps = (vi: DecoratedNestedViewItem<TItem>) => ({
  item: { ...vi, validationState: resolveValidation(vi.raw as TItem) },
  raw: vi.raw,
  index: vi.index,
  key: vi.key,
  depth: vi.depth,
  parent: vi.parent,
  parentKey: vi.parentKey,
  childrenCount: vi.childrenCount,
  hasChildren: vi.hasChildren,
  childrenAllowed: vi.childrenAllowed,
  firstInParent: vi.firstInParent,
  lastInParent: vi.lastInParent,
  readonly: props.readonly,
  disabled: props.disabled,
  expanded: vi.expanded,
  childrenExpanded: vi.childrenExpanded,
  editing: vi.editing,
  dirty: vi.dirty,
  unsaved: vi.unsaved,
  moved: vi.moved,
  reorderMode: reorderMode.value,
  canMoveUp: !vi.firstInParent,
  canMoveDown: !vi.lastInParent,
  canIndent: vi.canIndent,
  canOutdent: vi.canOutdent,
  canAddChild: vi.canAddChild,
  touch: isTouch.value,
  actions: {
    edit: () => onEditClick(vi),
    save: () => onSaveClick(vi),
    cancel: () => onCancelClick(vi),
    close: () => onCloseClick(vi),
    delete: () => onDeleteClick(vi),
    addAfter: () => onRowAddAfterClick(vi),
    addChild: () => onAddChildClick(vi),
    toggleExpand: () => onChevronClick(vi),
    toggleDetail: () => onDetailToggle(vi),
    moveUp: () => moveUp(vi.key),
    moveDown: () => moveDown(vi.key),
    moveTop: () => moveTop(vi.key),
    moveBottom: () => moveBottom(vi.key),
    indent: () => doIndent(vi),
    outdent: () => doOutdent(vi),
  },
})

const toolbarSlotProps = computed(() => ({
  applying: applying.value,
  hasPendingChanges: hasPendingChanges.value,
  movedCount: movedCount.value,
  error: applyError.value,
  actions: {
    apply: applyReorder,
    cancel: cancelReorderMode,
  },
}))

const reorderToggleSlotProps = computed(() => ({
  mode: mode.value,
  disabled: !canEnterReorder.value,
  hasPendingChanges: hasPendingChanges.value,
  actions: {
    enterReorderMode,
    exitReorderMode: cancelReorderMode,
  },
}))

// Aggregated display flags + helpers passed into each <ANestedRow>. Recomputed
// reactively when any underlying dependency changes.
const rowContext = computed(() => ({
  reorderMode: reorderMode.value,
  canInteract: canInteract.value,
  dragEnabled: dragEnabled.value,
  showExpandToggle: props.showExpandToggle,
  showEditButton: props.showEditButton,
  showDeleteButton: props.showDeleteButton,
  showAddChildButton: props.showAddChildButton,
  showAddAfterAction: props.showAddAfterAction,
  showInlineSaveFooter: showInlineSaveFooter.value,
  statusField: props.statusField,
  effectiveCloseVariant: effectiveCloseVariant.value,
  isRowClickable,
  resolveCompactText,
  resolveValidation,
  buildSlotProps,
}))

// Event callback bundle — each handler mutates the main component's local state
// (editingKeys, expandedKeys, etc.) or delegates to the editor composable.
const rowCallbacks = {
  onRowClick,
  onChevronClick,
  onEditClick,
  onDeleteClick,
  onCloseClick,
  onSaveClick,
  onCancelClick,
  onAddAfterClick: onRowAddAfterClick,
  onAddChildClick,
  moveUp: (id: ListEditorKey) => moveUp(id),
  moveDown: (id: ListEditorKey) => moveDown(id),
  moveTop: (id: ListEditorKey) => moveTop(id),
  moveBottom: (id: ListEditorKey) => moveBottom(id),
  indent: doIndent,
  outdent: doOutdent,
}

const rootViewItems = computed(() =>
  viewItemsDecorated.value.filter((v) => v.parentKey === null),
)

// Expose imperative API — mirrors legacy ASortableNested signatures for easier
// migration of admin-cms consumers (LinkedListManage calls these on the ref).
// These methods assume the caller has already persisted the change server-side,
// so they re-capture the dirty baseline — the affected items should not render
// as "unsaved" immediately after this call.
const addAfterId = (
  targetId: ListEditorKey | null,
  data: TItem,
  childrenAllowed: boolean,
) => {
  const res = editor.addItem(data, { afterId: targetId ?? undefined, childrenAllowed })
  nextTick(() => captureDirtyBaseline())
  return res
}
const addChildToId = (
  targetId: ListEditorKey,
  data: TItem,
  childrenAllowed: boolean,
) => {
  childrenExpandedKeys.value.add(targetId)
  const res = editor.addItem(data, { parentId: targetId, asFirstChild: true, childrenAllowed })
  nextTick(() => captureDirtyBaseline())
  return res
}
const removeById = (id: ListEditorKey) => {
  editor.deleteItem(id)
  editingKeys.value.delete(id)
  editingSnapshots.value.delete(id)
  detailExpandedKeys.value.delete(id)
  childrenExpandedKeys.value.delete(id)
  nextTick(() => captureDirtyBaseline())
}
const updateData = (
  id: ListEditorKey,
  data: TItem,
  _children: unknown = null,
  _position: unknown = null,
  _markUnsaved: unknown = null,
) => {
  editor.updateItem(id, data)
  nextTick(() => captureDirtyBaseline())
}

defineExpose({
  addItem: editor.addItem,
  addAfterId,
  addChildToId,
  removeById,
  updateData,
  updateItem: editor.updateItem,
  deleteItem: editor.deleteItem,
  moveUp: editor.moveUp,
  moveDown: editor.moveDown,
  moveTop: editor.moveTop,
  moveBottom: editor.moveBottom,
  indent: editor.indent,
  outdent: editor.outdent,
  moveTo: editor.moveTo,
  recalculatePositions: editor.recalculatePositions,
  viewItems: editor.viewItems,
  resetDirtyBaseline: captureDirtyBaseline,
  enterReorderMode,
  cancelReorderMode,
  applyReorder,
  // Tree children visibility (expand/collapse a branch)
  expand: (id: ListEditorKey) => childrenExpandedKeys.value.add(id),
  collapse: (id: ListEditorKey) => childrenExpandedKeys.value.delete(id),
  toggleExpand: (id: ListEditorKey) => {
    if (childrenExpandedKeys.value.has(id)) childrenExpandedKeys.value.delete(id)
    else childrenExpandedKeys.value.add(id)
  },
  // Row readonly-detail body visibility
  expandDetail: (id: ListEditorKey) => detailExpandedKeys.value.add(id),
  collapseDetail: (id: ListEditorKey) => detailExpandedKeys.value.delete(id),
})

</script>

<template>
  <div
    class="a-nested-list-editor"
    :class="[
      `a-nested-list-editor--mode-${mode}`,
      {
        'a-nested-list-editor--readonly': readonly,
        'a-nested-list-editor--disabled': disabled,
        'a-nested-list-editor--touch': isTouch,
        'a-nested-list-editor--drag-enabled': dragEnabled,
      },
    ]"
  >
    <div class="a-nested-list-editor__card">
      <div
        v-if="headerVisible"
        class="a-nested-list-editor__header"
      >
        <slot
          name="header"
          :title="title"
          v-bind="reorderToggleSlotProps"
        >
          <h3
            v-if="title"
            class="a-nested-list-editor__title-heading"
          >
            {{ title }}
          </h3>
          <div class="a-nested-list-editor__header-actions">
            <VBtn
              v-if="expandAllVisible && compactReorderButton"
              variant="tonal"
              color="primary"
              icon
              size="x-small"
              @click="toggleExpandAll"
            >
              <VIcon
                :icon="
                  allExpanded ? 'mdi-unfold-less-horizontal' : 'mdi-unfold-more-horizontal'
                "
                size="18"
              />
              <VTooltip
                activator="parent"
                location="bottom"
                :text="
                  allExpanded
                    ? t('common.sortable.collapseAll')
                    : t('common.sortable.expandAll')
                "
              />
            </VBtn>
            <VBtn
              v-else-if="expandAllVisible"
              variant="tonal"
              color="primary"
              size="small"
              :prepend-icon="
                allExpanded ? 'mdi-unfold-less-horizontal' : 'mdi-unfold-more-horizontal'
              "
              @click="toggleExpandAll"
            >
              {{
                allExpanded
                  ? t('common.sortable.collapseAll')
                  : t('common.sortable.expandAll')
              }}
            </VBtn>
            <slot
              v-if="reorderToggleVisible"
              name="reorder-toggle"
              v-bind="reorderToggleSlotProps"
            >
              <VBtn
                v-if="compactReorderButton"
                variant="tonal"
                color="primary"
                icon
                size="x-small"
                :disabled="!canEnterReorder"
                @click="enterReorderMode"
              >
                <VIcon
                  icon="mdi-sort"
                  size="18"
                />
                <VTooltip
                  activator="parent"
                  location="bottom"
                  :text="t('common.sortable.reorder')"
                />
              </VBtn>
              <VBtn
                v-else
                variant="tonal"
                color="primary"
                prepend-icon="mdi-sort"
                size="small"
                :disabled="!canEnterReorder"
                @click="enterReorderMode"
              >
                {{ t('common.sortable.reorder') }}
              </VBtn>
            </slot>
          </div>
        </slot>
      </div>

      <div
        v-if="loading"
        class="a-nested-list-editor__state a-nested-list-editor__state--loading"
      >
        <VProgressCircular
          indeterminate
          color="primary"
          size="32"
        />
      </div>

      <div
        v-else-if="error"
        class="a-nested-list-editor__state a-nested-list-editor__state--error"
      >
        <VAlert
          type="error"
          variant="tonal"
          density="compact"
          border="start"
        >
          {{ error }}
        </VAlert>
      </div>

      <div
        v-else-if="isEmpty"
        class="a-nested-list-editor__state a-nested-list-editor__state--empty"
      >
        <slot
          name="empty"
          :readonly="readonly"
          :disabled="disabled"
          :actions="{ add: onAddClick }"
        >
          <div class="a-nested-list-editor__empty">
            <h3 class="a-nested-list-editor__empty-title">
              {{ emptyTitleResolved }}
            </h3>
            <p class="a-nested-list-editor__empty-text">
              {{ emptyTextResolved }}
            </p>
            <VBtn
              v-if="canAdd"
              color="primary"
              variant="flat"
              prepend-icon="mdi-plus"
              @click="onAddClick"
            >
              {{ t('common.sortable.addFirst') }}
            </VBtn>
          </div>
        </slot>
      </div>

      <div
        v-else
        :key="forceRerender"
        ref="rowsContainer"
        class="a-nested-list-editor__rows"
        :class="{ 'a-nested-list-editor__rows--dragging': dragState !== null }"
      >
        <!-- Drop indicator overlay — a horizontal line (for sibling-above /
             sibling-below / reparent) whose `left` offset encodes the target
             depth, or a box outlining the whole row (for make-child). Painted
             in warning colour when the desired target would break maxDepth or
             form a cycle — visible intent + unambiguous "not here". -->
        <template v-if="overlayVisual !== null">
          <div
            v-if="overlayVisual.kind === 'line'"
            class="a-nested-list-editor__drop-line"
            :class="{ 'a-nested-list-editor__drop-line--blocked': overlayVisual.blocked }"
            :style="{
              top: `${overlayVisual.top}px`,
              left: `${overlayVisual.left}px`,
              right: `${overlayVisual.right}px`,
            }"
          >
            <span class="a-nested-list-editor__drop-line-dot" />
          </div>
          <div
            v-else-if="overlayVisual.kind === 'box'"
            class="a-nested-list-editor__drop-box"
            :class="{ 'a-nested-list-editor__drop-box--blocked': overlayVisual.blocked }"
            :style="{
              top: `${overlayVisual.top}px`,
              left: `${overlayVisual.left}px`,
              width: `${overlayVisual.width}px`,
              height: `${overlayVisual.height}px`,
            }"
          />
        </template>
        <div
          :class="[GROUP_CLASS, 'a-nested-list-editor__group--root']"
          data-parent-id=""
        >
          <ANestedRow
            v-for="vi in rootViewItems"
            :key="String(vi.key)"
            :vi="vi"
            :view-items="viewItemsDecorated"
            :drag-state="dragState"
            :context="rowContext"
            :callbacks="rowCallbacks"
          >
            <template #item="slotScope">
              <slot
                name="item"
                v-bind="slotScope"
              />
            </template>
            <template #item-compact="slotScope">
              <slot
                name="item-compact"
                v-bind="slotScope"
              />
            </template>
            <template #item-readonly="slotScope">
              <slot
                name="item-readonly"
                v-bind="slotScope"
              />
            </template>
            <template #item-status="slotScope">
              <slot
                name="item-status"
                v-bind="slotScope"
              />
            </template>
            <template #item-footer="slotScope">
              <slot
                name="item-footer"
                v-bind="slotScope"
              />
            </template>
            <template #item-actions="slotScope">
              <slot
                name="item-actions"
                v-bind="slotScope"
              />
            </template>
            <template #before-item="slotScope">
              <slot
                name="before-item"
                v-bind="slotScope"
              />
            </template>
            <template #after-item="slotScope">
              <slot
                name="after-item"
                v-bind="slotScope"
              />
            </template>
          </ANestedRow>
        </div>
      </div>

      <slot
        v-if="canAdd && !loading && !error && !isEmpty"
        name="add-button"
        :readonly="readonly"
        :disabled="disabled"
        :props="{ onClick: onAddClick }"
        :actions="{ add: onAddClick }"
      >
        <button
          type="button"
          class="a-nested-list-editor__row-add"
          @click="onAddClick"
        >
          <VIcon
            icon="mdi-plus"
            size="18"
          />
          <span>{{ addLabelResolved }}</span>
        </button>
      </slot>
    </div>

    <VDialog
      v-model="deleteDialog"
      max-width="420"
      :persistent="deleteInFlight"
    >
      <VCard>
        <VCardTitle class="text-headline-small">
          {{ deleteConfirmTitleResolved }}
        </VCardTitle>
        <VCardText>
          {{ deleteConfirmTextResolved }}
          <VAlert
            v-if="deleteError"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            {{ deleteError }}
          </VAlert>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn
            variant="text"
            :disabled="deleteInFlight"
            @click="onDeleteDialogCancel"
          >
            {{ t('common.button.cancel') }}
          </VBtn>
          <VBtn
            color="error"
            variant="flat"
            :loading="deleteInFlight"
            :disabled="deleteInFlight"
            @click="onDeleteDialogConfirm"
          >
            {{ t('common.sortable.delete') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <slot
      v-if="reorderMode && toolbarMode === 'internal'"
      name="reorder-toolbar"
      v-bind="toolbarSlotProps"
    >
      <div
        class="a-nested-list-editor__toolbar"
        :style="{ bottom: `${toolbarBottomOffset}px` }"
      >
        <div
          class="a-nested-list-editor__toolbar-status"
          :class="{ 'a-nested-list-editor__toolbar-status--pending': hasPendingChanges }"
        >
          <VIcon
            v-if="hasPendingChanges"
            icon="mdi-circle-medium"
            color="warning"
            size="18"
          />
          <span v-if="applyError">{{ applyError }}</span>
          <span v-else-if="hasPendingChanges">
            {{ t('common.sortable.pendingChanges', { count: movedCount }) }}
          </span>
          <span v-else>
            {{ t('common.sortable.noPendingChanges') }}
          </span>
        </div>
        <div class="a-nested-list-editor__toolbar-actions">
          <VBtn
            variant="text"
            :disabled="applying"
            @click="cancelReorderMode"
          >
            {{ t('common.sortable.reorderCancel') }}
          </VBtn>
          <VBtn
            color="primary"
            variant="flat"
            prepend-icon="mdi-check"
            :loading="applying"
            :disabled="applying"
            @click="applyReorder"
          >
            {{ t('common.sortable.reorderApply') }}
          </VBtn>
        </div>
      </div>
    </slot>
  </div>
</template>

<style lang="scss">
/* stylelint-disable color-function-alias-notation --
   Vuetify 4 exports theme colours as comma-separated "R, G, B" lists; the
   modern `rgb(R G B / A)` slash-alpha syntax produces invalid CSS (and a
   silent transparent fallback) when that var expands. We have to use the
   explicit `rgba(R, G, B, A)` form everywhere a theme var appears. */

.a-nested-list-editor {
  // Vuetify v4 exports theme colors as "R, G, B" (comma-separated) — so we must
  // use rgba(var(--v-theme-X), A) with a literal comma, not the modern
  // `rgb(R G B / A)` slash-alpha syntax (which produces invalid CSS when the var
  // expands to a comma-separated list and silently falls back to transparent).
  --ansle-border: rgb(0 0 0 / 12%);
  --ansle-surface: rgb(var(--v-theme-surface, 255, 255, 255));
  --ansle-surface-container: rgb(0 0 0 / 2.5%);
  --ansle-primary: rgb(var(--v-theme-primary, 63, 106, 216));
  --ansle-primary-container: rgba(var(--v-theme-primary, 63, 106, 216), 0.12);
  --ansle-primary-state: rgba(var(--v-theme-primary, 63, 106, 216), 0.04);
  --ansle-primary-state-press: rgba(var(--v-theme-primary, 63, 106, 216), 0.12);
  --ansle-success-container: rgb(76 175 80 / 18%);
  --ansle-success-fg: #165634;
  --ansle-warning-container: rgb(251 140 0 / 18%);
  --ansle-warning-fg: #914000;
  --ansle-warning: rgb(var(--v-theme-warning, 251, 140, 0));
  --ansle-error-container: rgba(var(--v-theme-error, 217, 37, 80), 0.18);
  --ansle-error-fg: rgb(var(--v-theme-error, 217, 37, 80));
  --ansle-on-surface: rgb(var(--v-theme-on-surface, 51, 51, 51));
  --ansle-on-surface-variant: rgb(var(--v-theme-on-surface-variant, 102, 102, 102));
  --ansle-radius: 8px;
  --ansle-radius-pill: 9999px;
  --ansle-elev-1: 0 1px 2px rgb(0 0 0 / 12%), 0 1px 3px 1px rgb(0 0 0 / 6%);
  --ansle-elev-3: 0 1px 3px rgb(0 0 0 / 16%), 0 4px 8px 3px rgb(0 0 0 / 10%);

  // Compact density — baked in, aligned with the reference design.
  --ansle-row-min-height: 48px;
  --ansle-row-pad-y: 6px;
  --ansle-row-font: 13px;
  --ansle-indent: 24px;

  position: relative;
  container-type: inline-size;
  container-name: ansle-shell;
}

.a-nested-list-editor--disabled,
.a-nested-list-editor--readonly {
  opacity: 0.85;
}

.a-nested-list-editor--disabled {
  pointer-events: none;
}

.a-nested-list-editor__card {
  background: var(--ansle-surface);
  border: 1px solid var(--ansle-border);
  border-radius: var(--ansle-radius);
  overflow: hidden;
}

.a-nested-list-editor__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 20px;
  height: 60px;
  border-bottom: 1px solid var(--ansle-border);
  background: var(--ansle-surface);
  flex-shrink: 0;
}

.a-nested-list-editor__header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}

.a-nested-list-editor__title-heading {
  font-weight: 500;
  font-size: 1rem;
  line-height: 1.5;
  letter-spacing: 0.009em;
  color: var(--ansle-on-surface);
  margin: 0;
}

.a-nested-list-editor__state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
}

.a-nested-list-editor__state--error {
  padding: 16px;
}

.a-nested-list-editor__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  padding: 16px;
}

.a-nested-list-editor__empty-title {
  font-size: 1rem;
  font-weight: 500;
  margin: 0;
  color: var(--ansle-on-surface);
}

.a-nested-list-editor__empty-text {
  font-size: 0.875rem;
  color: var(--ansle-on-surface-variant);
  margin: 0 0 12px;
}

.a-nested-list-editor__rows {
  position: relative;
  display: flex;
  flex-direction: column;
}

.a-nested-list-editor__group {
  display: flex;
  flex-direction: column;
}

.a-nested-list-editor__row-wrapper {
  display: flex;
  flex-direction: column;
}

.a-nested-list-editor__row {
  position: relative;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--ansle-border);
  background: var(--ansle-surface);
  transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.a-nested-list-editor__row-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--ansle-row-pad-y) 12px var(--ansle-row-pad-y)
    calc(16px + var(--nested-depth, 0) * var(--ansle-indent));
  min-height: var(--ansle-row-min-height);
  flex-shrink: 0;
  position: relative;
  transition: background-color 0.15s;
}

.a-nested-list-editor__row--clickable .a-nested-list-editor__row-header {
  cursor: pointer;
}

/* stylelint-disable selector-max-compound-selectors */
.a-nested-list-editor__row--clickable:not(
    .a-nested-list-editor__row--editing,
    .a-nested-list-editor__row--expanded
  ):hover
  .a-nested-list-editor__row-header {
  background: var(--ansle-primary-state);
}
/* stylelint-enable selector-max-compound-selectors */

/* Editing / readonly-expanded rows keep the overall row transparent — the blue
   tint sits on the header only, and the form body gets its own soft gradient
   (see container-query desktop rule further down). */
.a-nested-list-editor__row--editing .a-nested-list-editor__row-header,
.a-nested-list-editor__row--expanded .a-nested-list-editor__row-header {
  background: var(--ansle-primary-container);
}

.a-nested-list-editor__row--editing::before,
.a-nested-list-editor__row--expanded::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--ansle-primary);
  z-index: 1;
}

.a-nested-list-editor__row--unsaved {
  background: var(--ansle-warning-container);
}

.a-nested-list-editor__row--unsaved::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--ansle-warning);
  z-index: 2;
}

/* Unsaved takes visual precedence over editing — swap the header's blue tint
   and title color for warning so the whole row reads as "dirty, not active". */
.a-nested-list-editor__row--unsaved .a-nested-list-editor__row-header {
  background: var(--ansle-warning-container);
}

.a-nested-list-editor .a-nested-list-editor__row--unsaved.a-nested-list-editor__row--editing
  .a-nested-list-editor__row-main,
.a-nested-list-editor .a-nested-list-editor__row--unsaved.a-nested-list-editor__row--expanded
  .a-nested-list-editor__row-main,
.a-nested-list-editor .a-nested-list-editor__row--unsaved.a-nested-list-editor__row--editing
  .a-nested-list-editor__row-main *,
.a-nested-list-editor .a-nested-list-editor__row--unsaved.a-nested-list-editor__row--expanded
  .a-nested-list-editor__row-main * {
  color: var(--ansle-warning);
}

.a-nested-list-editor__row--reorder .a-nested-list-editor__row-header {
  padding-left: calc(12px + var(--nested-depth, 0) * var(--ansle-indent));
  padding-right: 8px;
  gap: 8px;
}

.a-nested-list-editor__row-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.a-nested-list-editor__title {
  flex: 1 1 auto;
  font-size: var(--ansle-row-font);
  font-weight: 400;
  line-height: 1.43;
  letter-spacing: 0.018em;
  color: var(--ansle-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Root-level rows carry a bolder title weight to anchor the visual hierarchy
   without resorting to separate header rows. */
.a-nested-list-editor__row:not(.a-nested-list-editor__row--child)
  .a-nested-list-editor__title {
  font-weight: 600;
}

/* Active (editing / readonly-expanded) row — the full header reads "primary":
   bold blue title, primary-tinted caret, blue background. `.row-main` is the
   wrapper around both the default title span and any consumer #item-compact
   slot content, so styling it covers custom title renderers too. */
.a-nested-list-editor__row--editing .a-nested-list-editor__tree-toggle,
.a-nested-list-editor__row--expanded .a-nested-list-editor__tree-toggle {
  color: var(--ansle-primary);
}

.a-nested-list-editor .a-nested-list-editor__row--editing .a-nested-list-editor__row-main,
.a-nested-list-editor .a-nested-list-editor__row--expanded .a-nested-list-editor__row-main,
.a-nested-list-editor .a-nested-list-editor__row--editing .a-nested-list-editor__row-main *,
.a-nested-list-editor .a-nested-list-editor__row--expanded .a-nested-list-editor__row-main * {
  font-weight: 700;
  color: var(--ansle-primary);
}

.a-nested-list-editor__unsaved-label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--ansle-warning);
  font-weight: 500;
  border: 1px solid var(--ansle-warning);
  padding: 2px 8px;
  border-radius: var(--ansle-radius-pill);
  white-space: nowrap;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.a-nested-list-editor__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}

.a-nested-list-editor__status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 56px;
  padding: 4px 10px;
  font: 500 11px/1 var(--v-font-body, inherit);
  letter-spacing: 0.02em;
  background: var(--ansle-success-container);
  color: var(--ansle-success-fg);
  border-radius: var(--ansle-radius-pill);
  white-space: nowrap;
  flex-shrink: 0;
}

.a-nested-list-editor__status-badge--warning {
  background: var(--ansle-warning-container);
  color: var(--ansle-warning-fg);
}

.a-nested-list-editor__status-badge--error {
  background: var(--ansle-error-container);
  color: var(--ansle-error-fg);
}

.a-nested-list-editor__actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: 4px;
}

.a-nested-list-editor__action--edit,
.a-nested-list-editor__action--delete,
.a-nested-list-editor__action--add-child,
.a-nested-list-editor__action--up,
.a-nested-list-editor__action--down,
.a-nested-list-editor__action--menu {
  opacity: 0;
  transition: opacity 0.15s;
}

/* stylelint-disable selector-max-compound-selectors */
.a-nested-list-editor__row:hover .a-nested-list-editor__action--edit,
.a-nested-list-editor__row:hover .a-nested-list-editor__action--delete,
.a-nested-list-editor__row:hover .a-nested-list-editor__action--add-child,
.a-nested-list-editor__row:hover .a-nested-list-editor__action--up,
.a-nested-list-editor__row:hover .a-nested-list-editor__action--down,
.a-nested-list-editor__row:hover .a-nested-list-editor__action--menu,
.a-nested-list-editor__row:focus-within .a-nested-list-editor__action--edit,
.a-nested-list-editor__row:focus-within .a-nested-list-editor__action--delete,
.a-nested-list-editor__row:focus-within .a-nested-list-editor__action--add-child,
.a-nested-list-editor__row:focus-within .a-nested-list-editor__action--up,
.a-nested-list-editor__row:focus-within .a-nested-list-editor__action--down,
.a-nested-list-editor__row:focus-within .a-nested-list-editor__action--menu {
  opacity: 1;
}

.a-nested-list-editor--touch .a-nested-list-editor__action--edit,
.a-nested-list-editor--touch .a-nested-list-editor__action--delete,
.a-nested-list-editor--touch .a-nested-list-editor__action--add-child,
.a-nested-list-editor--touch .a-nested-list-editor__action--up,
.a-nested-list-editor--touch .a-nested-list-editor__action--down,
.a-nested-list-editor--touch .a-nested-list-editor__action--menu {
  opacity: 1;
}

/* Active rows keep all affordances (edit / delete / menu) pinned open — same
   visual weight as a row on hover, so the right-side column looks identical to
   an inactive row, just always-on. */
.a-nested-list-editor__row--editing .a-nested-list-editor__action--edit,
.a-nested-list-editor__row--editing .a-nested-list-editor__action--delete,
.a-nested-list-editor__row--editing .a-nested-list-editor__action--menu,
.a-nested-list-editor__row--expanded .a-nested-list-editor__action--edit,
.a-nested-list-editor__row--expanded .a-nested-list-editor__action--delete,
.a-nested-list-editor__row--expanded .a-nested-list-editor__action--menu {
  opacity: 1;
}

.a-nested-list-editor__row:hover .a-nested-list-editor__action--up.v-btn--disabled,
.a-nested-list-editor__row:hover .a-nested-list-editor__action--down.v-btn--disabled,
.a-nested-list-editor__row:focus-within .a-nested-list-editor__action--up.v-btn--disabled,
.a-nested-list-editor__row:focus-within .a-nested-list-editor__action--down.v-btn--disabled,
.a-nested-list-editor--touch .a-nested-list-editor__action--up.v-btn--disabled,
.a-nested-list-editor--touch .a-nested-list-editor__action--down.v-btn--disabled {
  opacity: 0.3;
}
/* stylelint-enable selector-max-compound-selectors */

.a-nested-list-editor__drag-handle {
  cursor: grab;
  flex-shrink: 0;
  padding: 4px 0;
}

.a-nested-list-editor__drag-handle:active {
  cursor: grabbing;
}

/* Source row during drag — stays in place, dimmed, so the user keeps context
   on where the item came from while it's being moved. */
.a-nested-list-editor__row--drop-source,
.a-nested-list-editor__row--chosen {
  opacity: 0.4;
}

/* Hide SortableJS's own placeholder — our overlay (drop-line / drop-box) is
   the sole landing indicator. SortableJS still needs the element for its
   internal bookkeeping, we just don't show it. */
.a-nested-list-editor__row--ghost {
  display: none !important;
}

/* Floating clone that follows the cursor — slim row-shaped card, no rotation,
   no subtree, no action column. Just enough to say "this is what I'm moving". */
.a-nested-list-editor__row--drag {
  box-shadow: var(--ansle-elev-3);
  background: var(--ansle-surface);
  border: 1px solid var(--ansle-border);
  border-radius: var(--ansle-radius);
  opacity: 0.96;
  pointer-events: none;
  max-width: 420px;
}

/* Strip the dragged clone down to the bare header — hide rendered children
   subtree, status badge and action column. */
.a-nested-list-editor__row--drag .a-nested-list-editor__children,
.a-nested-list-editor__row--drag .a-nested-list-editor__row-body,
.a-nested-list-editor__row--drag .a-nested-list-editor__actions,
.a-nested-list-editor__row--drag .a-nested-list-editor__status {
  display: none;
}

/* In the drag clone, `.row-main` shouldn't stretch — otherwise the title grows
   to fill leftover space and pushes the "+N" chip to the far edge. Collapse
   it (and its nested title span / consumer slot content) to natural content
   width so the chip sits right next to the title text. */
.a-nested-list-editor__row--drag .a-nested-list-editor__row-main,
.a-nested-list-editor__row--drag .a-nested-list-editor__row-main * {
  flex: 0 0 auto;
}

/* Drop indicator line — 2px primary stroke with an 8px terminal dot on the
   left that bleeds 4px outside the anchor column. Absolute-positioned inside
   .rows, which is position:relative. `left` is set by the overlay computed
   from the instruction's target depth, so at depth 0 the line sits at the
   root indent and at depth N it starts N*indent further right. This is the
   primary channel for communicating "where will the row land" — the line's
   horizontal START encodes the final depth. */
.a-nested-list-editor__drop-line {
  position: absolute;
  height: 2px;
  margin-top: -1px;
  background: var(--ansle-primary);
  pointer-events: none;
  z-index: 4;
  border-radius: 1px;
}

.a-nested-list-editor__drop-line-dot {
  position: absolute;
  left: -4px;
  top: 50%;
  width: 8px;
  height: 8px;
  background: var(--ansle-primary);
  border-radius: 50%;
  transform: translateY(-50%);
}

.a-nested-list-editor__drop-line--blocked {
  background: var(--ansle-warning);
}

.a-nested-list-editor__drop-line--blocked .a-nested-list-editor__drop-line-dot {
  background: var(--ansle-warning);
}

/* Drop indicator box — 2px primary outline around the full target row. Used
   for `make-child`, signalling "this row is about to adopt the dragged item
   as a child". Complements the line indicator (which can't express "nest
   inside this row" without becoming ambiguous with a sibling insert). */
.a-nested-list-editor__drop-box {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid var(--ansle-primary);
  border-radius: 4px;
  pointer-events: none;
  z-index: 4;
  background: var(--ansle-primary-container);
}

.a-nested-list-editor__drop-box--blocked {
  border-color: var(--ansle-warning);
  background: var(--ansle-warning-container);
}

/* Inline edit body. Default layout (narrow container / mobile) — form fills the
   full row width, no rail, no depth-aware indent beyond the parent padding.
   Desktop layout is applied via container query below. */
.a-nested-list-editor__row-body {
  padding: 12px 16px;
  transition: padding-left 0.2s ease;
}

/* Form card — wraps consumer-provided #item / #item-readonly content so the
   inline editor reads as a distinct surface against the tinted row-body
   background. White fill, whisper-faint border, gentle radius. */
.a-nested-list-editor__form {
  background: var(--ansle-surface);
  border: 1px solid rgb(0 0 0 / 6%);
  border-radius: var(--ansle-radius);
  padding: 16px 16px 8px;
}

.a-nested-list-editor__row-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding: 4px 16px 16px;
}

.a-nested-list-editor__row-footer-spacer {
  flex: 1 1 auto;
}

/* Container-query driven desktop layout — keyed off the component's own width,
   so the same rule works in a wide page layout and in a narrow sidebar panel
   on the same screen. */
@container ansle-shell (min-width: 769px) {
  /* Row text column = 16 (pad) + depth*24 (indent) + 24 (caret) + 10 (gap) = 50 + depth*24.
     Inline form aligns with that column so the first input sits under the title.
     Body and footer both get the primary left rail + soft gradient so the whole
     editing area reads as one continuous surface. */
  .a-nested-list-editor__row--editing .a-nested-list-editor__row-body,
  .a-nested-list-editor__row--expanded .a-nested-list-editor__row-body,
  .a-nested-list-editor__row--editing .a-nested-list-editor__row-footer,
  .a-nested-list-editor__row--expanded .a-nested-list-editor__row-footer {
    padding-left: calc(50px + var(--nested-depth, 0) * var(--ansle-indent));
    padding-right: 16px;
    border-left: 2px solid rgba(var(--v-theme-primary, 63, 106, 216), 0.28);
    background: linear-gradient(
      to right,
      rgba(var(--v-theme-primary, 63, 106, 216), 0.07),
      rgba(var(--v-theme-primary, 63, 106, 216), 0.02) 50%,
      transparent 85%
    );
  }

  /* Unsaved + editing: swap the primary rail + gradient for warning. */
  .a-nested-list-editor__row--unsaved.a-nested-list-editor__row--editing .a-nested-list-editor__row-body,
  .a-nested-list-editor__row--unsaved.a-nested-list-editor__row--expanded .a-nested-list-editor__row-body,
  .a-nested-list-editor__row--unsaved.a-nested-list-editor__row--editing .a-nested-list-editor__row-footer,
  .a-nested-list-editor__row--unsaved.a-nested-list-editor__row--expanded .a-nested-list-editor__row-footer {
    border-left-color: rgb(251 140 0 / 35%);
    background: linear-gradient(
      to right,
      rgb(251 140 0 / 7%),
      rgb(251 140 0 / 2%) 50%,
      transparent 85%
    );
  }
}

/* Narrow-container / mobile layout — tighter indent so deep branches still fit,
   taller rows for comfortable touch targets, always-visible actions, and the
   status badge drops out to make room for the title. */
@container ansle-shell (max-width: 768px) {
  .a-nested-list-editor {
    --ansle-indent: 18px;
    --ansle-row-min-height: 48px;
    --ansle-row-pad-y: 10px;
  }

  .a-nested-list-editor__row:not(.a-nested-list-editor__row--editing)
    .a-nested-list-editor__status {
    display: none;
  }

  /* stylelint-disable selector-max-compound-selectors */
  .a-nested-list-editor__row .a-nested-list-editor__action--edit,
  .a-nested-list-editor__row .a-nested-list-editor__action--delete,
  .a-nested-list-editor__row .a-nested-list-editor__action--menu {
    opacity: 1;
  }
  /* stylelint-enable selector-max-compound-selectors */
}

/* Children container — flat layout. No background tint or tree guide line:
   depth is conveyed by the row's padding-left indent alone. */
.a-nested-list-editor__children {
  position: relative;
}

/* Triangle-caret toggle — VBtn-text-style circular button: transparent by
   default, subtle tinted circle on hover so the affordance is obvious. Size
   matches the flat icon-btn rhythm (28×28) with the triangle optically centred. */
.a-nested-list-editor__tree-toggle {
  width: 24px;
  height: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  pointer-events: auto;
  color: rgb(0 0 0 / 54%);
  z-index: 2;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.a-nested-list-editor__tree-toggle:hover {
  background: rgb(0 0 0 / 5%);
  color: var(--ansle-on-surface);
}

.a-nested-list-editor__tree-toggle:focus-visible {
  outline: none;
  background: rgb(0 0 0 / 8%);
}

/* Spacer keeps caret column width reserved on leaf rows so titles align
   vertically across siblings regardless of whether they have children. */
.a-nested-list-editor__tree-toggle--spacer,
.a-nested-list-editor__tree-toggle--empty {
  width: 24px;
  height: 24px;
  background: transparent;
  visibility: hidden;
  pointer-events: none;
}

/* Pure CSS right-pointing triangle; rotates to down when the row is open. */
.a-nested-list-editor__tree-toggle-caret {
  width: 0;
  height: 0;
  border-left: 5px solid currentcolor;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-right: 0;
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateX(1px); /* optical centering — triangle's visual mass leans left */
}

.a-nested-list-editor__tree-toggle--open .a-nested-list-editor__tree-toggle-caret {
  transform: translate(0, 1px) rotate(90deg);
}

/* While dragging, dim the add-button so focus stays on the drag target. */
.a-nested-list-editor__rows--dragging .a-nested-list-editor__row-add {
  opacity: 0.4;
}

/* "+N" children indicator — rendered on every row with children, but hidden
   in the normal DOM. Only becomes visible inside the SortableJS drag clone
   (which carries `.__row--drag`) so the user sees that the whole branch
   will follow the item being moved. */
.a-nested-list-editor__drag-count {
  display: none;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
  padding: 2px 8px;
  font: 500 11px/1 var(--v-font-body, inherit);
  letter-spacing: 0.02em;
  color: var(--ansle-primary);
  background: var(--ansle-primary-container);
  border-radius: var(--ansle-radius-pill);
  flex-shrink: 0;
}

.a-nested-list-editor__row--drag .a-nested-list-editor__drag-count {
  display: inline-flex;
}

.a-nested-list-editor__row-add {
  width: 100%;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ansle-primary);
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  border: none;
  border-top: 1px solid var(--ansle-border);
  background: var(--ansle-surface-container);
  letter-spacing: 0.02em;
  transition: background-color 0.15s;
  text-align: left;
  font-family: inherit;
}

.a-nested-list-editor__row-add:hover {
  background: var(--ansle-primary-container);
}

.a-nested-list-editor__toolbar {
  position: sticky;
  z-index: 5;
  margin-top: 12px;
  padding: 10px 16px;
  background: var(--ansle-surface);
  border: 1px solid var(--ansle-border);
  border-radius: 16px;
  box-shadow: var(--ansle-elev-3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.a-nested-list-editor__toolbar-status {
  font: 500 14px/1 var(--v-font-body, inherit);
  color: var(--ansle-on-surface);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.a-nested-list-editor__toolbar-status--pending {
  color: var(--ansle-warning);
}

.a-nested-list-editor__toolbar-actions {
  display: inline-flex;
  gap: 8px;
  flex-shrink: 0;
}

@media (hover: none) {
  .a-nested-list-editor__action--edit,
  .a-nested-list-editor__action--delete,
  .a-nested-list-editor__action--add-child,
  .a-nested-list-editor__action--up,
  .a-nested-list-editor__action--down,
  .a-nested-list-editor__action--menu {
    opacity: 1;
  }
}
</style>
