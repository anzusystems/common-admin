<script setup lang="ts" generic="TItem extends Record<string, any>">
import {
  computed,
  inject,
  onBeforeUnmount,
  provide,
  ref,
  shallowReactive,
  shallowRef,
  useSlots,
  useTemplateRef,
  watch,
  type ComputedRef,
} from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { useContainerWidth } from '@/labs/listEditor/composables/useContainerWidth'
import { useKeyboardNav } from '@/labs/listEditor/composables/useKeyboardNav'
import { useValidationRegistry } from '@/labs/listEditor/composables/useValidationRegistry'
import { useSortable } from '@vueuse/integrations/useSortable'
import { useListEditor } from '@/labs/listEditor/composables/useListEditor'
import { resolveCompactText as resolveCompactTextUtil } from '@/labs/listEditor/composables/resolveCompactText'
import { useUnsavedKeysSync } from '@/labs/listEditor/composables/useUnsavedKeysSync'
import { useDirtyBaseline } from '@/labs/listEditor/composables/useDirtyBaseline'
import { useDeleteDialog } from '@/labs/listEditor/composables/useDeleteDialog'
import { useInlineEditing } from '@/labs/listEditor/composables/useInlineEditing'
import {
  useReorderMode,
  SharedReorderRegistryKey,
  type SharedReorderRegistry,
} from '@/labs/listEditor/composables/useReorderMode'
import LeDeleteDialog from '@/labs/listEditor/internal/LeDeleteDialog.vue'
import LeMoveToPositionDialog from '@/labs/listEditor/internal/LeMoveToPositionDialog.vue'
import LeEmptyState from '@/labs/listEditor/internal/LeEmptyState.vue'
import LeStatus from '@/labs/listEditor/internal/LeStatus.vue'
import LeUnsavedLabel from '@/labs/listEditor/internal/LeUnsavedLabel.vue'
import LeDragHandle from '@/labs/listEditor/internal/LeDragHandle.vue'
import {
  DRAG_GHOST_CLASS,
  DRAG_CHOSEN_CLASS,
  DRAG_CLASS,
} from '@/labs/listEditor/internal/constants'
import { cloneDeep } from '@/utils/common'
import { stringToInt } from '@/utils/string'
import type {
  ListEditorKey,
  ListEditorValidationState,
  ListViewItem,
  PositionHint,
} from '@/labs/listEditor/types/listEditorTypes'

export interface DecoratedViewItem<T> extends ListViewItem<T> {
  editing: boolean
  expanded: boolean
  loading: boolean
  dirty: boolean
  moved: boolean
  unsaved: boolean
  canMoveUp: boolean
  canMoveDown: boolean
}

export type ReorderMode = 'view' | 'reorder'

// Public slot scope shapes — see AListEditor for the rationale on hoisting.
export interface RowActions<TItem> {
  edit: () => void
  save: () => Promise<void> | void
  cancel: () => void
  close: () => void
  delete: () => Promise<void>
  addAfter: () => void
  toggleExpand: () => void
  moveUp: () => void
  moveDown: () => void
  moveTop: () => void
  moveBottom: () => void
  update: (data: TItem) => TItem[]
}
export interface RowSlotProps<TItem extends Record<string, any>> {
  item: DecoratedViewItem<TItem> & { validationState: ListEditorValidationState }
  raw: TItem
  index: number
  key: ListEditorKey
  readonly: boolean
  disabled: boolean
  expanded: boolean
  editing: boolean
  dirty: boolean
  unsaved: boolean
  reorderMode: boolean
  moved: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  touch: boolean
  actions: RowActions<TItem>
}
export interface ToolbarSlotProps {
  applying: boolean
  hasPendingChanges: boolean
  movedCount: number
  error: string | null
  actions: { apply: () => Promise<void>; cancel: () => void }
}
export interface ReorderToggleSlotProps {
  mode: ReorderMode
  disabled: boolean
  hasPendingChanges: boolean
  actions: { enterReorderMode: () => void; exitReorderMode: () => void }
}
export interface HeaderSlotProps extends ReorderToggleSlotProps {
  title: string | null
}
export interface EmptySlotProps {
  readonly: boolean
  disabled: boolean
  actions: { add: () => void }
}
export interface AddButtonSlotProps {
  readonly: boolean
  disabled: boolean
  props: { onClick: () => void }
  actions: { add: () => void }
}
export interface ViewBodySlotProps<TItem extends Record<string, any>> {
  items: TItem[]
  mode: ReorderMode
  actions: { enterReorderMode: () => void }
}

export interface Props<TItem extends Record<string, any>> {
  keyField?: string
  positionField?: string
  positionMultiplier?: number
  updatePosition?: boolean

  readonly?: boolean
  disabled?: boolean
  loading?: boolean
  error?: string | null

  title?: string | null

  compactField?: string | null
  statusField?: string | null
  twoRows?: 'never' | 'mobile' | 'always'
  chips?: boolean

  showAddButton?: boolean
  showDeleteButton?: boolean
  showEditButton?: boolean
  showAddAfterAction?: boolean

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
  disableReorder?: boolean
  disableDrag?: boolean
  showMoveToPosition?: boolean

  /**
   * Embedded mode — this editor is nested inside another editor's `#item`
   * slot and follows a shared `v-model:mode` from the outer editor. When
   * set, the editor:
   *   - hides its own Reorder button + Cancel/Apply toolbar
   *   - skips the snapshot/restore (the outer editor's deep snapshot covers
   *     nested data, so cancel at the top reverts everything)
   *   - paints lighter chrome so it visually reads as part of the parent row
   * Pair with `v-model:mode` bound to the same ref the outer editor uses.
   */
  embedded?: boolean
  /**
   * Allow rows to remain inline-editable while the editor is in reorder
   * mode. By default, entering reorder closes any open inline edit and the
   * `#item` slot body is hidden — this keeps the visual focus on dragging.
   * Set this when the open row's body needs to render in reorder mode (e.g.
   * the parent editor of a shared-reorder pair, where the open question
   * exposes its embedded answers list for dragging).
   */
  allowEditInReorder?: boolean

  getValidationState?: (item: TItem, key: ListEditorKey, index: number) => ListEditorValidationState

  onDeleteConfirm?: (item: TItem) => Promise<boolean> | boolean
  onDelete?: (item: TItem) => Promise<void> | void
  onItemSave?: (item: TItem) => Promise<void> | void
  onReorderApply?: (items: TItem[]) => Promise<void> | void
}

const props = withDefaults(defineProps<Props<TItem>>(), {
  keyField: 'id',
  positionField: 'position',
  positionMultiplier: 1,
  updatePosition: false,
  readonly: false,
  disabled: false,
  loading: false,
  error: null,
  title: null,
  compactField: null,
  statusField: null,
  twoRows: 'never',
  chips: false,
  showAddButton: true,
  showDeleteButton: true,
  showEditButton: true,
  showAddAfterAction: false,
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
  disableReorder: false,
  disableDrag: false,
  showMoveToPosition: false,
  embedded: false,
  allowEditInReorder: false,
  getValidationState: undefined,
  onDeleteConfirm: undefined,
  onDelete: undefined,
  onItemSave: undefined,
  onReorderApply: undefined,
})

const emit = defineEmits<{
  add: [positionHint: PositionHint | undefined]
  edit: [item: ListViewItem<TItem>]
  deleted: [item: ListViewItem<TItem>]
  close: [item: ListViewItem<TItem>]
  'item-saved': [item: ListViewItem<TItem>]
  'item-expand': [item: ListViewItem<TItem>, expanded: boolean]
  'reorder-start': []
  'reorder-cancel': []
  'reorder-applied': [items: TItem[]]
  'reorder-apply-error': [error: unknown]
  'reorder-end': []
}>()

defineSlots<{
  header?: (props: HeaderSlotProps) => unknown
  'reorder-toggle'?: (props: ReorderToggleSlotProps) => unknown
  'reorder-toolbar'?: (props: ToolbarSlotProps) => unknown
  empty?: (props: EmptySlotProps) => unknown
  'add-button'?: (props: AddButtonSlotProps) => unknown
  'view-body'?: (props: ViewBodySlotProps<TItem>) => unknown
  item?: (props: RowSlotProps<TItem>) => unknown
  'item-compact'?: (props: RowSlotProps<TItem>) => unknown
  'item-readonly'?: (props: RowSlotProps<TItem>) => unknown
  'item-status'?: (props: RowSlotProps<TItem>) => unknown
  'item-actions'?: (props: RowSlotProps<TItem>) => unknown
  'item-footer'?: (props: RowSlotProps<TItem>) => unknown
  'before-item'?: (props: RowSlotProps<TItem>) => unknown
  'after-item'?: (props: RowSlotProps<TItem>) => unknown
}>()

const modelValue = defineModel<TItem[]>({ required: true })
const mode = defineModel<ReorderMode>('mode', { default: 'view' })

const { t } = useI18n()
const slots = useSlots()
const display = useDisplay()

const rootEl = useTemplateRef<HTMLElement>('rootEl')
const { isNarrow } = useContainerWidth(rootEl)

const isTouch = computed<boolean>(() => display.platform.value.touch)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const editor = useListEditor<TItem>(modelValue, {
  keyField: props.keyField,
  positionField: props.positionField,
  positionMultiplier: props.positionMultiplier,
  updatePosition: props.updatePosition,
})

const expandedKeys = ref<Set<ListEditorKey>>(new Set())

// `positionField` excluded: drag rewrites it on every shifted row, would falsely flag unmoved rows dirty.
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { captureDirtyBaseline, rebaselineKey, isItemDirty } = useDirtyBaseline<TItem>(
  () =>
    modelValue.value.map((item) => ({
      key: item[props.keyField] as ListEditorKey,
      data: item,
    })),
  { excludeFields: [props.positionField], source: modelValue },
)

const movedKeys = ref<Set<ListEditorKey>>(new Set())

const resetDirtyBaseline = () => {
  captureDirtyBaseline()
  movedKeys.value = new Set()
}

const snapshot = shallowRef<TItem[] | null>(null)

const rowsContainer = useTemplateRef<HTMLElement>('rowsContainer')

const isInlineEdit = computed(() => !props.chips && !!slots.item)
const hasReadonlyDetail = computed(() => !props.chips && !!slots['item-readonly'])

const {
  editingKeys,
  editingSnapshots,
  clearEditing,
  beginEdit,
  cancelEdit,
  commitEdit,
  closeEdit,
  requestAutoOpen,
} = useInlineEditing<TItem, ListViewItem<TItem>>({
  rowsContainer,
  rowSelector: '.a-le-row',
  isInlineEdit,
  restoreSnapshot: (key, data) => editor.updateItem(key, data),
  watchKeys: () => modelValue.value.map((it) => it[props.keyField] as ListEditorKey),
  findEntry: (key) => {
    const hit = modelValue.value.find((it) => (it[props.keyField] as ListEditorKey) === key)
    return hit ? { data: hit } : null
  },
  afterAutoOpen: (key) => {
    expandedKeys.value.delete(key)
  },
})

const canInteract = computed(() => !props.readonly && !props.disabled && !props.loading)
const canEnterReorder = computed(
  () => canInteract.value && !props.disableReorder && modelValue.value.length > 1,
)

const embeddedRef = computed(() => props.embedded)
const allowEditInReorderRef = computed(() => props.allowEditInReorder)

const {
  applying,
  applyError,
  hasPendingChanges,
  movedCount,
  reorderMode,
  enterReorderMode,
  cancelReorderMode,
  applyReorder,
} = useReorderMode<TItem[]>({
  mode,
  snapshot,
  movedKeys,
  modelValue,
  cloneModel: (m) => cloneDeep(m) as TItem[],
  applyModel: (m) => {
    modelValue.value = m
  },
  canEnterReorder,
  embedded: embeddedRef,
  onEnter: () => {
    if (!allowEditInReorderRef.value) {
      clearEditing()
      expandedKeys.value.clear()
    }
  },
  onExternalEnter: () => {
    if (!allowEditInReorderRef.value) {
      clearEditing()
      expandedKeys.value.clear()
    }
  },
  onReorderApply: (items) => props.onReorderApply?.(items),
  emit: {
    reorderStart: () => emit('reorder-start'),
    reorderCancel: () => emit('reorder-cancel'),
    reorderApplied: (payload) => emit('reorder-applied', payload),
    reorderApplyError: (err) => emit('reorder-apply-error', err),
    reorderEnd: () => emit('reorder-end'),
  },
})

// Stacked-editor registry: outer collects movedCount + hasChanges from embedded children for the toolbar counter.
// shallowReactive preserves ComputedRef identity (no auto-unwrap).
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const childContributions = props.embedded
  ? null
  : shallowReactive(
      new Map<symbol, { count: ComputedRef<number>; hasChanges: ComputedRef<boolean> }>(),
    )

if (childContributions) {
  const registry: SharedReorderRegistry = {
    register: (id, count, hasChanges) => {
      childContributions.set(id, { count, hasChanges })
    },
    unregister: (id) => {
      childContributions.delete(id)
    },
  }
  provide(SharedReorderRegistryKey, registry)
}

if (props.embedded) {
  const parent = inject(SharedReorderRegistryKey, null)
  if (parent) {
    const id = Symbol('le.embedded')
    parent.register(id, movedCount, hasPendingChanges)
    onBeforeUnmount(() => parent.unregister(id))
  }
}

const totalMovedCount = computed<number>(() => {
  let sum = movedCount.value
  if (childContributions) {
    for (const c of childContributions.values()) sum += c.count.value
  }
  return sum
})

const totalHasPendingChanges = computed<boolean>(() => {
  if (hasPendingChanges.value) return true
  if (childContributions) {
    for (const c of childContributions.values()) {
      if (c.hasChanges.value) return true
    }
  }
  return false
})

const canAdd = computed(() => canInteract.value && props.showAddButton && !reorderMode.value)
// Chips mode keeps drag always-on (no mode toggle) on non-touch devices.
const dragEnabled = computed(
  () => (reorderMode.value || props.chips) && !isTouch.value && !props.disableDrag,
)

const addLabelResolved = computed(() =>
  props.addLabel ? t(props.addLabel) : t('common.sortable.add'),
)
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
    !props.chips &&
    !props.embedded &&
    props.showReorderToggle &&
    !reorderMode.value &&
    modelValue.value.length > 0,
)

// When there IS a title and viewport is narrow, the reorder button shrinks to an
// icon-only round button to keep the single-line header from overflowing.
const compactReorderButton = computed<boolean>((): boolean => !!props.title && isNarrow.value)

const headerVisible = computed<boolean>(
  (): boolean =>
    !!(
      props.title ||
      slots.header ||
      slots['reorder-toggle'] ||
      reorderToggleVisible.value ||
      (reorderMode.value && !props.embedded)
    ),
)

// Editor band-only header — true when the header has substantive content
// (title or custom header slot). When false, the header still renders but
// as a slim band right-aligning just the reorder/apply controls — and stays
// that height across idle ↔ reorder so the layout doesn't jump on toggle.
const headerHasContent = computed<boolean>(
  (): boolean => !!(props.title || slots.header || slots['reorder-toggle'] || slots['view-body']),
)

// Per-row edit footer (Save + Cancel) is only meaningful if the consumer wants a
// per-item persist callback. Without it the expectation is that the parent form's
// global save flushes everything, so we hide the per-row buttons by default.
const showInlineSaveFooter = computed(() => !!props.onItemSave)

// Tracks only rows the user actively moved (drag, arrow buttons) — snapshot
// vs current-index diffing would also flag side-effect index shifts, which
// isn't what the user means by "unsaved".
const markMoved = (key: ListEditorKey) => {
  movedKeys.value.add(key)
}

// Decoupled dirty pass — see AListEditor for rationale.
const dirtyKeys = computed<Set<ListEditorKey>>(() => {
  const out = new Set<ListEditorKey>()
  for (const item of modelValue.value) {
    const key = item[props.keyField] as ListEditorKey
    if (isItemDirty(key, item)) out.add(key)
  }
  return out
})

// Per-key decorator cache — see AListEditor for rationale.
const decoratorCache = new Map<ListEditorKey, DecoratedViewItem<TItem>>()
const viewItemsDecorated = computed<DecoratedViewItem<TItem>[]>(() => {
  const total = modelValue.value.length
  const next: DecoratedViewItem<TItem>[] = []
  const liveKeys = new Set<ListEditorKey>()
  for (const vi of editor.viewItems.value) {
    liveKeys.add(vi.key)
    const editing = editingKeys.value.has(vi.key)
    const expanded = expandedKeys.value.has(vi.key)
    const loading = props.loadingKeys?.has(vi.key) ?? false
    const moved = movedKeys.value.has(vi.key)
    const dirty = dirtyKeys.value.has(vi.key)
    const unsaved = dirty || moved
    const canMoveUp = vi.index > 0
    const canMoveDown = vi.index < total - 1
    const cached = decoratorCache.get(vi.key)
    if (
      cached &&
      cached.raw === vi.raw &&
      cached.index === vi.index &&
      cached.position === vi.position &&
      cached.editing === editing &&
      cached.expanded === expanded &&
      cached.loading === loading &&
      cached.dirty === dirty &&
      cached.moved === moved &&
      cached.unsaved === unsaved &&
      cached.canMoveUp === canMoveUp &&
      cached.canMoveDown === canMoveDown
    ) {
      next.push(cached)
      continue
    }
    const decorated: DecoratedViewItem<TItem> = {
      ...vi,
      editing,
      expanded,
      loading,
      dirty,
      moved,
      unsaved,
      canMoveUp,
      canMoveDown,
    }
    decoratorCache.set(vi.key, decorated)
    next.push(decorated)
  }
  for (const key of decoratorCache.keys()) {
    if (!liveKeys.has(key)) decoratorCache.delete(key)
  }
  return next
})

const isEmpty = computed(() => viewItemsDecorated.value.length === 0)

const findVi = (key: ListEditorKey): DecoratedViewItem<TItem> | undefined =>
  viewItemsDecorated.value.find((v) => v.key === key)

const keyboardNav = useKeyboardNav({
  viewItems: computed(() => viewItemsDecorated.value.map((vi) => ({ key: vi.key }))),
  variant: 'sortable',
  isReorderMode: reorderMode,
  disabled: computed(() => !canInteract.value),
  isEditing: (key) => editingKeys.value.has(key),
  onToggleEdit: (key) => {
    const vi = findVi(key)
    if (vi) onEditClick(vi)
  },
  onCancelEdit: (key) => {
    const vi = findVi(key)
    if (vi) onCloseClick(vi)
  },
  onMoveUp: (key) => {
    const vi = findVi(key)
    if (vi) moveUp(vi.index)
  },
  onMoveDown: (key) => {
    const vi = findVi(key)
    if (vi) moveDown(vi.index)
  },
  onMoveTop: (key) => {
    const vi = findVi(key)
    if (vi) moveTop(vi.index)
  },
  onMoveBottom: (key) => {
    const vi = findVi(key)
    if (vi) moveBottom(vi.index)
  },
  onCancelReorder: () => cancelReorderMode(),
})

const moveToPositionDialogOpen = ref<boolean>(false)
const moveToPositionTarget = shallowRef<DecoratedViewItem<TItem> | null>(null)
const moveToPositionLabel = computed<string>(() =>
  moveToPositionTarget.value
    ? resolveCompactText(moveToPositionTarget.value.raw, moveToPositionTarget.value.key)
    : '',
)
const openMoveToPosition = (vi: DecoratedViewItem<TItem>) => {
  if (!props.showMoveToPosition) return
  moveToPositionTarget.value = vi
  moveToPositionDialogOpen.value = true
}
const onMoveToPositionConfirm = (newIndex: number) => {
  const target = moveToPositionTarget.value
  moveToPositionTarget.value = null
  if (!target) return
  if (newIndex === target.index) return
  editor.moveItem(target.index, newIndex)
  markMoved(target.key)
}

const resolveCompactText = (raw: TItem, key: ListEditorKey): string =>
  resolveCompactTextUtil(raw, key, {
    compactField: props.compactField,
    fallback: t('common.sortable.itemFallback'),
  })

const { resolveValidation } = useValidationRegistry<TItem>({
  getValidationState: (item, key, index) => props.getValidationState?.(item, key, index) ?? null,
})

// Skip SortableJS entirely on touch devices — touch users reorder via arrows + menu,
// so the drag/drop library is never needed and there is no point paying its setup cost.
// The one-shot reads below are intentional: touch detection is fixed at setup time,
// and dragEnabled's initial value seeds SortableJS; later changes flow via the watch.
/* eslint-disable vue/no-ref-object-reactivity-loss */
if (!isTouch.value) {
  const sortable = useSortable(rowsContainer, modelValue, {
    // The rows container can mount/unmount across mode flips (e.g. when the
    // consumer renders a `#view-body` slot in view mode and the rows are
    // only mounted in reorder mode). vueuse's default `tryOnMounted` fires
    // exactly once and would bind to a null ref, leaving SortableJS dead.
    // `watchElement: true` re-initialises whenever the rows container ref
    // populates.
    watchElement: true,
    handle: '.a-le-drag-handle',
    animation: 150,
    // Force the fallback renderer so `dragClass` is applied to a CSS-controlled
    // clone that follows the cursor — gives us a custom, row-shaped ghost
    // instead of the opaque browser-native drag bitmap.
    forceFallback: true,
    fallbackTolerance: 3,
    fallbackOnBody: true,
    ghostClass: DRAG_GHOST_CLASS,
    chosenClass: DRAG_CHOSEN_CLASS,
    dragClass: DRAG_CLASS,
    disabled: !dragEnabled.value,
    onEnd: (event) => {
      // Resolve which row was dragged by reading its data-id attribute
      // (set via template binding on .row). SortableJS's `event.item` is
      // the moved DOM element; we only mark that one specific key as moved
      // rather than diffing the whole list, so siblings that shifted index
      // as a side-effect stay clean.
      const el = event.item as HTMLElement
      const raw = el.getAttribute('data-id')
      if (raw !== null && raw !== '') {
        const n = stringToInt(raw)
        const key: ListEditorKey = n > 0 ? n : raw
        markMoved(key)
      }
      if (props.updatePosition) {
        modelValue.value = editor.recalculatePositions(modelValue.value) as TItem[]
      }
    },
  })

  watch(dragEnabled, (enabled) => {
    sortable.option('disabled', !enabled)
  })
}
/* eslint-enable vue/no-ref-object-reactivity-loss */

const onAddClick = () => {
  if (!canAdd.value) return
  requestAutoOpen()
  emit('add', undefined)
}

const onRowAddAfterClick = (vi: ListViewItem<TItem>) => {
  if (!canInteract.value) return
  requestAutoOpen()
  emit('add', { afterId: vi.key })
}

const onEditClick = (vi: ListViewItem<TItem>) => {
  if (!canInteract.value) return
  if (reorderMode.value && !props.allowEditInReorder) return
  // Toggle: clicking edit while already editing closes the form, matching the
  // row-header click behaviour.
  if (editingKeys.value.has(vi.key)) {
    onCloseClick(vi)
    return
  }
  if (isInlineEdit.value) {
    beginEdit(vi)
    expandedKeys.value.delete(vi.key)
  }
  emit('edit', vi)
}

const onExpandClick = (vi: ListViewItem<TItem>) => {
  if (props.disabled || props.loading) return
  if (reorderMode.value && !props.allowEditInReorder) return
  const key = vi.key
  const currentlyExpanded = expandedKeys.value.has(key)
  if (currentlyExpanded) {
    expandedKeys.value.delete(key)
  } else {
    for (const k of expandedKeys.value) expandedKeys.value.delete(k)
    expandedKeys.value.add(key)
  }
  emit('item-expand', vi, !currentlyExpanded)
}

const isRowClickable = (vi: DecoratedViewItem<TItem>): boolean => {
  if (props.chips) return false
  if (props.disableRowClick) return false
  if (props.disabled || props.loading) return false
  if (reorderMode.value && !props.allowEditInReorder) return false
  if (vi.editing || vi.expanded) return true
  if (!props.readonly && props.showEditButton) return true
  return false
}

const onRowClick = (vi: DecoratedViewItem<TItem>) => {
  if (!isRowClickable(vi)) return
  if (vi.editing || vi.expanded) {
    onCloseClick(vi)
    return
  }
  if (props.readonly && hasReadonlyDetail.value) {
    onExpandClick(vi)
  } else {
    onEditClick(vi)
  }
}

const {
  deleteDialog,
  deleteInFlight,
  deleteError,
  onDeleteClick: triggerDeleteClick,
  onDeleteDialogConfirm,
  onDeleteDialogCancel,
} = useDeleteDialog<TItem, ListViewItem<TItem>>({
  onDeleteConfirm: (raw) => (props.onDeleteConfirm ? props.onDeleteConfirm(raw) : true),
  onDelete: (raw) => props.onDelete?.(raw),
  onDeleted: (vi) => {
    editingKeys.value.delete(vi.key)
    editingSnapshots.value.delete(vi.key)
    expandedKeys.value.delete(vi.key)
    emit('deleted', vi)
  },
  disableDeleteConfirm: () => props.disableDeleteConfirm || props.chips,
})

const onDeleteClick = async (vi: ListViewItem<TItem>) => {
  if (!canInteract.value) return
  await triggerDeleteClick(vi)
}

const onSaveClick = async (vi: ListViewItem<TItem>) => {
  if (props.onItemSave) {
    await props.onItemSave(vi.raw)
  }
  commitEdit(vi)
  emit('item-saved', vi)
}

const onCancelClick = (vi: ListViewItem<TItem>) => {
  cancelEdit(vi)
}

const onCloseClick = (vi: ListViewItem<TItem>) => {
  closeEdit(vi)
  expandedKeys.value.delete(vi.key)
  emit('close', vi)
}

const keyAtIndex = (idx: number): ListEditorKey | null => {
  const item = modelValue.value[idx]
  if (!item) return null
  return item[props.keyField] as ListEditorKey
}

const moveUp = (idx: number) => {
  if (idx <= 0) return
  const key = keyAtIndex(idx)
  editor.moveItem(idx, idx - 1)
  if (key !== null) markMoved(key)
}
const moveDown = (idx: number) => {
  if (idx >= modelValue.value.length - 1) return
  const key = keyAtIndex(idx)
  editor.moveItem(idx, idx + 1)
  if (key !== null) markMoved(key)
}
const moveTop = (idx: number) => {
  if (idx <= 0) return
  const key = keyAtIndex(idx)
  editor.moveItem(idx, 0)
  if (key !== null) markMoved(key)
}
const moveBottom = (idx: number) => {
  if (idx >= modelValue.value.length - 1) return
  const key = keyAtIndex(idx)
  editor.moveItem(idx, modelValue.value.length - 1)
  if (key !== null) markMoved(key)
}

// Per-key actions cache: stable identity per row, see equivalent block in
// AListEditor for rationale. Closures capture key (stable) and look up the
// current vi via findVi at call time.
type ActionsBundle = {
  edit: () => void
  save: () => Promise<void> | void
  cancel: () => void
  close: () => void
  delete: () => Promise<void>
  addAfter: () => void
  toggleExpand: () => void
  moveUp: () => void
  moveDown: () => void
  moveTop: () => void
  moveBottom: () => void
  update: (data: TItem) => TItem[]
}
const actionsCache = new Map<ListEditorKey, ActionsBundle>()
const getActions = (key: ListEditorKey): ActionsBundle => {
  let actions = actionsCache.get(key)
  if (!actions) {
    actions = {
      edit: () => {
        const vi = findVi(key)
        if (vi) onEditClick(vi)
      },
      save: () => {
        const vi = findVi(key)
        if (vi) return onSaveClick(vi)
      },
      cancel: () => {
        const vi = findVi(key)
        if (vi) onCancelClick(vi)
      },
      close: () => {
        const vi = findVi(key)
        if (vi) onCloseClick(vi)
      },
      delete: async () => {
        const vi = findVi(key)
        if (vi) await onDeleteClick(vi)
      },
      addAfter: () => {
        const vi = findVi(key)
        if (vi) onRowAddAfterClick(vi)
      },
      toggleExpand: () => {
        const vi = findVi(key)
        if (vi) onExpandClick(vi)
      },
      moveUp: () => {
        const vi = findVi(key)
        if (vi) moveUp(vi.index)
      },
      moveDown: () => {
        const vi = findVi(key)
        if (vi) moveDown(vi.index)
      },
      moveTop: () => {
        const vi = findVi(key)
        if (vi) moveTop(vi.index)
      },
      moveBottom: () => {
        const vi = findVi(key)
        if (vi) moveBottom(vi.index)
      },
      update: (data: TItem) => editor.updateItem(key, data),
    }
    actionsCache.set(key, actions)
  }
  return actions
}
watch(
  () => viewItemsDecorated.value,
  (now) => {
    if (actionsCache.size === 0) return
    const liveKeys = new Set(now.map((v) => v.key))
    for (const key of actionsCache.keys()) {
      if (!liveKeys.has(key)) actionsCache.delete(key)
    }
  },
)

const buildSlotProps = (vi: DecoratedViewItem<TItem>) => ({
  item: { ...vi, validationState: resolveValidation(vi.raw as TItem, vi.key, vi.index) },
  raw: vi.raw,
  index: vi.index,
  key: vi.key,
  readonly: props.readonly,
  disabled: props.disabled,
  expanded: vi.expanded,
  editing: vi.editing,
  dirty: vi.dirty,
  unsaved: vi.unsaved,
  reorderMode: reorderMode.value,
  moved: vi.moved,
  canMoveUp: vi.canMoveUp,
  canMoveDown: vi.canMoveDown,
  touch: isTouch.value,
  actions: getActions(vi.key),
})

const toolbarSlotProps = computed(() => ({
  applying: applying.value,
  hasPendingChanges: totalHasPendingChanges.value,
  movedCount: totalMovedCount.value,
  error: applyError.value,
  actions: {
    apply: applyReorder,
    cancel: cancelReorderMode,
  },
}))

const reorderToggleSlotProps = computed(() => ({
  mode: mode.value,
  disabled: !canEnterReorder.value,
  hasPendingChanges: totalHasPendingChanges.value,
  actions: {
    enterReorderMode,
    exitReorderMode: cancelReorderMode,
  },
}))

const unsavedKeysModel = defineModel<Set<ListEditorKey>>('unsavedKeys', {
  default: () => new Set<ListEditorKey>(),
})

const internalUnsavedKeys = computed<Set<ListEditorKey>>(() => {
  const out = new Set<ListEditorKey>()
  for (const vi of viewItemsDecorated.value) {
    if (vi.unsaved) out.add(vi.key)
  }
  return out
})

const { hasUnsavedChanges, unsavedCount, clearUnsavedState } = useUnsavedKeysSync({
  unsavedKeysModel,
  internalUnsavedKeys,
  onClearAll: () => {
    captureDirtyBaseline()
    movedKeys.value = new Set()
  },
  onClearKey: (key) => {
    rebaselineKey(key)
    movedKeys.value.delete(key)
  },
})

defineExpose({
  addItem: editor.addItem,
  deleteItem: editor.deleteItem,
  updateItem: editor.updateItem,
  moveItem: editor.moveItem,
  recalculatePositions: editor.recalculatePositions,
  viewItems: editor.viewItems,
  resetDirtyBaseline,
  hasUnsavedChanges,
  unsavedCount,
  clearUnsavedState,
  enterReorderMode,
  cancelReorderMode,
  applyReorder,
})
</script>

<template>
  <div
    ref="rootEl"
    class="a-sortable-list-editor"
    :class="[
      `a-sortable-list-editor--two-rows-${twoRows}`,
      `a-sortable-list-editor--mode-${mode}`,
      {
        'a-sortable-list-editor--readonly': readonly,
        'a-sortable-list-editor--disabled': disabled,
        'a-sortable-list-editor--touch': isTouch,
        'a-sortable-list-editor--drag-enabled': dragEnabled,
        'a-sortable-list-editor--chips': chips,
        'a-sortable-list-editor--embedded': embedded,
        'a-sortable-list-editor--header-floating':
          !embedded && !chips && !headerHasContent && headerVisible,
      },
    ]"
  >
    <div class="a-le-card">
      <div
        v-if="headerVisible"
        class="a-le-header"
      >
        <slot
          name="header"
          :title="title"
          v-bind="reorderToggleSlotProps"
        >
          <h3
            v-if="title"
            class="a-le-title-heading"
          >
            {{ title }}
          </h3>
          <div class="a-le-header-actions">
            <template v-if="reorderMode && !embedded">
              <!-- Reorder-mode header: pending-changes count + Cancel/Apply.
                   Replaces the old sticky bottom toolbar — the actions sit
                   where the "Reorder" button lives in view mode. -->
              <slot
                name="reorder-toolbar"
                v-bind="toolbarSlotProps"
              >
                <LeStatus
                  :class="{ 'a-le-toolbar-status--pending': totalHasPendingChanges }"
                  :has-pending-changes="totalHasPendingChanges"
                  :pending-count="totalMovedCount"
                  :error="applyError"
                />
                <VBtn
                  variant="text"
                  size="small"
                  :disabled="applying"
                  @click="cancelReorderMode"
                >
                  {{ t('common.sortable.reorderCancel') }}
                </VBtn>
                <VBtn
                  color="primary"
                  variant="flat"
                  size="small"
                  prepend-icon="mdi-check"
                  :loading="applying"
                  :disabled="applying || !totalHasPendingChanges"
                  @click="applyReorder"
                >
                  {{ t('common.sortable.reorderApply') }}
                </VBtn>
              </slot>
            </template>
            <slot
              v-else-if="reorderToggleVisible"
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
        class="a-le-state a-le-state--loading"
      >
        <VProgressCircular
          indeterminate
          color="primary"
          size="32"
        />
      </div>

      <div
        v-else-if="error"
        class="a-le-state a-le-state--error"
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
        v-else-if="!reorderMode && $slots['view-body']"
        class="a-le-view-body"
      >
        <slot
          name="view-body"
          :items="modelValue"
          :mode="mode"
          :actions="{ enterReorderMode }"
        />
      </div>

      <div
        v-else-if="isEmpty"
        class="a-le-state a-le-state--empty"
      >
        <slot
          name="empty"
          :readonly="readonly"
          :disabled="disabled"
          :actions="{ add: onAddClick }"
        >
          <LeEmptyState
            :title="emptyTitleResolved"
            :text="emptyTextResolved"
            :add-label="addLabelResolved"
            :can-add="canAdd"
            @add="onAddClick"
          />
        </slot>
      </div>

      <div
        v-else
        ref="rowsContainer"
        class="a-sortable-list-editor__rows"
      >
        <div
          v-for="vi in viewItemsDecorated"
          :key="String(vi.key)"
          :data-id="String(vi.key)"
          role="listitem"
          :tabindex="keyboardNav.rowTabindex(vi.key)"
          class="a-le-row"
          :class="{
            'a-le-row--two-rows': twoRows === 'always',
            'a-le-row--editing': vi.editing,
            'a-le-row--expanded': vi.expanded,
            'a-le-row--unsaved': vi.unsaved,
            'a-le-row--reorder': reorderMode,
            'a-le-row--grabbed': keyboardNav.isGrabbed(vi.key),
            'a-le-row--clickable': isRowClickable(vi),
            [`a-le-row--validation-${resolveValidation(vi.raw, vi.key, vi.index)}`]:
              resolveValidation(vi.raw, vi.key, vi.index) !== null,
          }"
          @keydown="keyboardNav.handleKeydown(vi.key, $event)"
        >
          <slot
            name="before-item"
            v-bind="buildSlotProps(vi)"
          />

          <div
            class="a-le-row-header"
            @click="onRowClick(vi)"
          >
            <LeDragHandle v-if="dragEnabled" />

            <div class="a-le-row-main">
              <slot
                name="item-compact"
                v-bind="buildSlotProps(vi)"
              >
                <span class="a-le-title">
                  {{ resolveCompactText(vi.raw, vi.key) }}
                </span>
              </slot>
              <LeUnsavedLabel v-if="vi.unsaved" />
            </div>

            <div
              v-if="!chips && !reorderMode"
              class="a-le-status"
            >
              <slot
                name="item-status"
                v-bind="buildSlotProps(vi)"
              >
                <span
                  v-if="statusField && vi.raw[statusField] != null && vi.raw[statusField] !== ''"
                  class="a-le-status-badge"
                >
                  {{ vi.raw[statusField] }}
                </span>
              </slot>
            </div>

            <div class="a-le-actions">
              <slot
                name="item-actions"
                v-bind="buildSlotProps(vi)"
              >
                <VBtn
                  v-if="chips && showDeleteButton && canInteract"
                  icon
                  size="x-small"
                  variant="text"
                  density="compact"
                  :active="false"
                  class="a-le-action a-le-action--chip-close"
                  @click.stop="onDeleteClick(vi)"
                >
                  <VIcon
                    icon="mdi-close"
                    size="14"
                  />
                </VBtn>
                <template v-else-if="reorderMode">
                  <VBtn
                    icon
                    size="small"
                    variant="text"
                    density="comfortable"
                    :disabled="!vi.canMoveUp"
                    class="mx-1 a-le-action a-le-action--up"
                    @click.stop="moveUp(vi.index)"
                  >
                    <VIcon
                      icon="mdi-arrow-up"
                      size="18"
                    />
                    <VTooltip
                      activator="parent"
                      location="bottom"
                      :text="t('common.sortable.moveUp')"
                    />
                  </VBtn>
                  <VBtn
                    icon
                    size="small"
                    variant="text"
                    density="comfortable"
                    :disabled="!vi.canMoveDown"
                    class="mx-1 a-le-action a-le-action--down"
                    @click.stop="moveDown(vi.index)"
                  >
                    <VIcon
                      icon="mdi-arrow-down"
                      size="18"
                    />
                    <VTooltip
                      activator="parent"
                      location="bottom"
                      :text="t('common.sortable.moveDown')"
                    />
                  </VBtn>
                  <VBtn
                    icon
                    size="small"
                    variant="text"
                    density="comfortable"
                    :active="false"
                    class="mx-1 a-le-action a-le-action--menu"
                  >
                    <VIcon
                      icon="mdi-dots-vertical"
                      size="18"
                    />
                    <VTooltip
                      activator="parent"
                      location="bottom"
                      :text="t('common.sortable.more')"
                    />
                    <VMenu activator="parent">
                      <VList density="compact">
                        <VListItem
                          :disabled="!vi.canMoveUp"
                          @click.stop="moveTop(vi.index)"
                        >
                          <template #prepend>
                            <VIcon icon="mdi-arrow-collapse-up" />
                          </template>
                          <VListItemTitle>
                            {{ t('common.sortable.moveToTop') }}
                          </VListItemTitle>
                        </VListItem>
                        <VListItem
                          :disabled="!vi.canMoveDown"
                          @click.stop="moveBottom(vi.index)"
                        >
                          <template #prepend>
                            <VIcon icon="mdi-arrow-collapse-down" />
                          </template>
                          <VListItemTitle>
                            {{ t('common.sortable.moveToBottom') }}
                          </VListItemTitle>
                        </VListItem>
                        <VListItem
                          v-if="showMoveToPosition && viewItemsDecorated.length > 1"
                          @click.stop="openMoveToPosition(vi)"
                        >
                          <template #prepend>
                            <VIcon icon="mdi-target" />
                          </template>
                          <VListItemTitle>
                            {{ t('common.sortable.moveToPosition.action') }}
                          </VListItemTitle>
                        </VListItem>
                        <VListItem
                          v-if="showAddAfterAction && canInteract"
                          @click.stop="onRowAddAfterClick(vi)"
                        >
                          <template #prepend>
                            <VIcon icon="mdi-plus" />
                          </template>
                          <VListItemTitle>
                            {{ t('common.sortable.addAfter') }}
                          </VListItemTitle>
                        </VListItem>
                        <VListItem
                          v-if="showDeleteButton && canInteract"
                          @click.stop="onDeleteClick(vi)"
                        >
                          <template #prepend>
                            <VIcon icon="mdi-trash-can-outline" />
                          </template>
                          <VListItemTitle>
                            {{ t('common.sortable.delete') }}
                          </VListItemTitle>
                        </VListItem>
                      </VList>
                    </VMenu>
                  </VBtn>
                </template>
                <template v-else>
                  <VBtn
                    v-if="showEditButton && canInteract"
                    icon
                    size="small"
                    variant="tonal"
                    color="primary"
                    density="comfortable"
                    class="mx-1 a-le-action a-le-action--edit"
                    @click.stop="onEditClick(vi)"
                  >
                    <VIcon
                      icon="mdi-pencil-outline"
                      size="18"
                    />
                    <VTooltip
                      activator="parent"
                      location="bottom"
                      :text="t('common.sortable.edit')"
                    />
                  </VBtn>
                  <VBtn
                    v-if="showDeleteButton && canInteract"
                    icon
                    size="small"
                    variant="text"
                    density="comfortable"
                    class="mx-1 a-le-action a-le-action--delete"
                    @click.stop="onDeleteClick(vi)"
                  >
                    <VIcon
                      icon="mdi-trash-can-outline"
                      size="18"
                    />
                    <VTooltip
                      activator="parent"
                      location="bottom"
                      :text="t('common.sortable.delete')"
                    />
                  </VBtn>
                  <VBtn
                    v-if="showAddAfterAction && canInteract"
                    icon
                    size="small"
                    variant="text"
                    density="comfortable"
                    :active="false"
                    class="mx-1 a-le-action a-le-action--menu"
                  >
                    <VIcon
                      icon="mdi-dots-vertical"
                      size="18"
                    />
                    <VTooltip
                      activator="parent"
                      location="bottom"
                      :text="t('common.sortable.more')"
                    />
                    <VMenu activator="parent">
                      <VList density="compact">
                        <VListItem @click.stop="onRowAddAfterClick(vi)">
                          <template #prepend>
                            <VIcon icon="mdi-plus" />
                          </template>
                          <VListItemTitle>
                            {{ t('common.sortable.addAfter') }}
                          </VListItemTitle>
                        </VListItem>
                      </VList>
                    </VMenu>
                  </VBtn>
                </template>
              </slot>
            </div>
          </div>

          <template v-if="vi.editing && (allowEditInReorder || !reorderMode) && $slots.item">
            <div class="a-le-row-body">
              <div class="a-le-form">
                <slot
                  name="item"
                  v-bind="buildSlotProps(vi)"
                />
              </div>
            </div>
            <slot
              name="item-footer"
              v-bind="buildSlotProps(vi)"
            >
              <div
                v-if="showInlineSaveFooter && !reorderMode"
                class="a-le-row-footer"
              >
                <div class="a-le-row-footer-spacer" />
                <VBtn
                  variant="text"
                  :disabled="vi.loading"
                  @click.stop="onCancelClick(vi)"
                >
                  {{ t('common.button.cancel') }}
                </VBtn>
                <VBtn
                  color="primary"
                  variant="flat"
                  prepend-icon="mdi-check"
                  :disabled="vi.loading"
                  @click.stop="onSaveClick(vi)"
                >
                  {{ t('common.button.save') }}
                </VBtn>
              </div>
            </slot>
          </template>

          <div
            v-else-if="
              $slots['item-readonly'] &&
                (readonly || vi.expanded) &&
                (allowEditInReorder || !reorderMode)
            "
            class="a-le-row-body"
          >
            <div class="a-le-form">
              <slot
                name="item-readonly"
                v-bind="buildSlotProps(vi)"
              />
            </div>
          </div>

          <slot
            name="after-item"
            v-bind="buildSlotProps(vi)"
          />
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
          class="a-le-row-add"
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

    <LeMoveToPositionDialog
      v-model="moveToPositionDialogOpen"
      :total="viewItemsDecorated.length"
      :current-index="moveToPositionTarget?.index ?? 0"
      :item-label="moveToPositionLabel"
      @confirm="onMoveToPositionConfirm"
    />

    <LeDeleteDialog
      v-model="deleteDialog"
      :title="deleteConfirmTitleResolved"
      :text="deleteConfirmTextResolved"
      :confirm-label="t('common.sortable.delete')"
      :cancel-label="t('common.button.cancel')"
      :error="deleteError"
      :in-flight="deleteInFlight"
      @confirm="onDeleteDialogConfirm"
      @cancel="onDeleteDialogCancel"
    />

    <div
      class="a-le-sr-only"
      aria-live="polite"
      role="status"
    >
      {{
        keyboardNav.grabbedKey.value !== null
          ? t('common.sortable.keyboardGrab.status', {
            n: keyboardNav.grabbedIndex.value + 1,
            total: keyboardNav.totalCount.value,
          })
          : ''
      }}
    </div>
  </div>
</template>

<style lang="scss">
@use './styles/tokens';
@use './styles/shared';

// Variant-specific rules for ASortableListEditor — reorder-mode trims, drag
// clone styling, chips flex-wrap layout, and the validation rail.
.a-sortable-list-editor {
  &__rows {
    display: flex;
    flex-direction: column;
  }

  // View-mode body slot — gives the consumer's slot content breathing room
  // inside the editor card. Match the row's horizontal rhythm (~16 px) and
  // add a modest vertical inset so cards don't sit flush against the border.
  .a-le-view-body {
    padding: 12px 16px;
  }

  // Reorder-mode trims the row-header padding since the drag handle already
  // eats some of the horizontal rhythm.
  .a-le-row--reorder .a-le-row-header {
    padding-left: 12px;
    padding-right: 8px;
    gap: 8px;
  }

  // Drag rendering — SortableJS clone + ghost + chosen source.
  .a-le-row--ghost {
    opacity: 0.35;
    background: var(--le-primary-state);
  }

  .a-le-row--chosen {
    opacity: 0.5;
  }

  // Floating clone that follows the cursor. Row-shaped card with elevation;
  // action column and status badge hidden so the preview stays clean.
  .a-le-row--drag {
    background: var(--le-surface);
    border: 1px solid var(--le-border);
    border-radius: var(--le-radius);
    box-shadow: var(--le-elev-3);
    max-width: 420px;
    opacity: 0.96;
    pointer-events: none;
  }

  .a-le-row--drag .a-le-actions,
  .a-le-row--drag .a-le-status {
    display: none;
  }

  // Header-only-with-reorder variant — when there's no title and no header
  // slot, the header still renders but as a slim band right-aligning just
  // the Preskupiť button.
  &--header-floating .a-le-header {
    justify-content: flex-end;
    padding: 6px 8px;
    min-height: 0;
  }

  // Embedded variant — this editor sits inside another editor's row. Drop
  // the card chrome (border, shadow), tighten rows, lighten background so it
  // visually reads as part of the parent's body, not a sibling list.
  &--embedded .a-le-card {
    background: transparent;
    border: none;
    box-shadow: none;
    border-radius: 0;
  }

  &--embedded .a-le-header {
    padding: 4px 0 6px;
    background: transparent;
    border: none;
  }

  &--embedded .a-le-title-heading {
    font-size: 13px;
    font-weight: 500;
    color: var(--le-on-surface-medium, rgb(0 0 0 / 70%));
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  &--embedded .a-le-row {
    background: var(--le-surface);
    border: 1px solid var(--le-border);
    border-radius: 6px;
    margin-bottom: 4px;
  }

  &--embedded .a-le-row:last-of-type {
    margin-bottom: 0;
  }

  &--embedded .a-le-row-add {
    min-height: var(--le-row-min-height);
    padding: 0 16px;
    background: transparent;
    border: 1px dashed var(--le-border);
    border-radius: 6px;
    color: var(--le-primary);
    margin-top: 4px;
    width: 100%;
  }

  &--embedded .a-le-row-add:hover {
    background: var(--le-primary-state);
    border-style: solid;
  }

  // Chips-layout variant-specific overrides — `__rows` flex-wraps into pills,
  // `row-header` gets the drag-handle-friendly 8 px left padding (vs 12 px
  // in AListEditor), `drag-handle` shrinks to match the pill height.
  &--chips &__rows {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    flex: 1 1 100%;
  }

  &--chips .a-le-row-header {
    padding: 2px 4px 2px 8px;
    gap: 4px;
    min-height: 28px;
  }

  &--chips .a-le-drag-handle {
    padding: 0;
    font-size: 16px;
  }
}

// Narrow-container / mobile layout — taller rows, always-visible actions,
// status badge dropped to make room.
/* stylelint-disable selector-max-compound-selectors */
@container le-shell (max-width: 768px) {
  .a-sortable-list-editor {
    --le-row-min-height: 48px;
    --le-row-pad-y: 10px;

    .a-le-row:not(.a-le-row--editing) .a-le-status {
      display: none;
    }

    .a-le-row .a-le-action--edit,
    .a-le-row .a-le-action--delete,
    .a-le-row .a-le-action--menu,
    .a-le-row .a-le-action--up,
    .a-le-row .a-le-action--down {
      opacity: 1;
    }
  }
}
/* stylelint-enable selector-max-compound-selectors */
</style>
