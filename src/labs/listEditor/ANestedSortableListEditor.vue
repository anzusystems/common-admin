<script setup lang="ts" generic="TItem extends Record<string, any>">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useSlots,
  useTemplateRef,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'
import { useContainerWidth } from '@/labs/listEditor/composables/useContainerWidth'
import { useIsTouchDevice } from '@/labs/listEditor/composables/useIsTouchDevice'
import { useKeyboardNav } from '@/labs/listEditor/composables/useKeyboardNav'
import { useSortable } from '@vueuse/integrations/useSortable'
import { type NestedViewItem } from '@/labs/listEditor/composables/useNestedListEditor'
import {
  useNestedListEditorController,
  type GetKey,
  type ListEditorValidationResult,
  type NestedListEditorHandle,
  type PositionOption,
} from '@/labs/listEditor/composables/useNestedListEditorController'
import {
  computeInstruction,
  type ExecutableInstruction,
  type Instruction,
} from '@/labs/listEditor/composables/useDragInstruction'
import { resolveCompactText as resolveCompactTextUtil } from '@/labs/listEditor/composables/resolveCompactText'
import { useUnsavedSection } from '@/labs/unsavedGuard/useUnsavedSection'
import { useDeleteDialog } from '@/labs/listEditor/composables/useDeleteDialog'
import { useInlineEditing } from '@/labs/listEditor/composables/useInlineEditing'
import { validateAllAndReveal } from '@/labs/listEditor/utils/revealInvalidRows'
import { useListEditorScopeValidity } from '@/labs/listEditor/composables/useListEditorScopeValidity'
import { useReorderMode } from '@/labs/listEditor/composables/useReorderMode'
import { cloneDeep } from '@/utils/common'
import type {
  ListEditorKey,
  ListEditorValidationScope,
  ListEditorValidationState,
  NestedPositionHint,
  NestedTree,
  NestedTreeNode,
} from '@/labs/listEditor/types/listEditorTypes'
import { useAlerts } from '@/composables/system/alerts'
import { stringToInt } from '@/utils/string'
import LeNestedRow from '@/labs/listEditor/internal/LeNestedRow.vue'
import LeDeleteDialog from '@/labs/listEditor/internal/LeDeleteDialog.vue'
import LeMoveToPositionDialog from '@/labs/listEditor/internal/LeMoveToPositionDialog.vue'
import LeChangeParentDialog from '@/labs/listEditor/internal/LeChangeParentDialog.vue'
import LeEmptyState from '@/labs/listEditor/internal/LeEmptyState.vue'
import LeStatus from '@/labs/listEditor/internal/LeStatus.vue'
import {
  DRAG_GHOST_CLASS,
  DRAG_CHOSEN_CLASS,
  DRAG_CLASS,
} from '@/labs/listEditor/internal/constants'

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

// Hoisted for vite-plugin-dts d.ts rollup.
export interface RowActions<TItem> {
  edit: () => void
  save: () => Promise<void> | void
  cancel: () => void
  close: () => void
  delete: () => Promise<void>
  addAfter: () => void
  addChild: () => void
  toggleExpand: () => void
  toggleDetail: () => void
  moveUp: () => void
  moveDown: () => void
  moveTop: () => void
  moveBottom: () => void
  indent: () => void
  outdent: () => void
  update: (data: TItem) => void
}
export interface RowSlotProps<TItem extends Record<string, any>> {
  item: DecoratedNestedViewItem<TItem> & { validationState: ListEditorValidationState }
  raw: TItem
  index: number
  key: ListEditorKey
  depth: number
  parent: TItem | null
  parentKey: ListEditorKey | null
  childrenCount: number
  hasChildren: boolean
  childrenAllowed: boolean
  firstInParent: boolean
  lastInParent: boolean
  readonly: boolean
  disabled: boolean
  expanded: boolean
  childrenExpanded: boolean
  editing: boolean
  dirty: boolean
  unsaved: boolean
  moved: boolean
  reorderMode: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  canIndent: boolean
  canOutdent: boolean
  canAddChild: boolean
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

export interface Props<TItem extends Record<string, any>> {
  maxDepth: number

  /**
   * New-row factory; if set, add/add-after/add-inside insert through the
   * controller (no `@add` handler needed). Optional for read-only trees.
   */
  factory?: () => TItem
  /**
   * Stable row identity. Default `'id'`. Never point at the position field.
   * Typed `string` (not `keyof TItem`): a bare keyof compiles to a Boolean-only
   * runtime type that silently coerces `get-key="id"` to `true`.
   */
  getKey?: string | ((item: TItem) => ListEditorKey)
  /**
   * Managed order field. Default `'position'`; `false` opts out. Typed
   * `[String, Boolean, Object]` with `string` before `false`: a bare keyof
   * compiles Boolean-only, and `false`-first would coerce `position="position"`
   * (value == prop name) to `true`. Object form folds in `{ field, multiplier }`.
   */
  position?: string | false | { field: string; multiplier?: number }
  /** Parent-key field written onto reparented rows. Default `'parent'`. */
  parentField?: string
  /**
   * Extra fields dropped from the dirty content-hash (position + parent always
   * dropped), e.g. a child collection tracked by a separate editor.
   */
  dirtyExclude?: string[]
  /** Per-row validity — `true` (or `{ valid: true }`) = VALID. Drives the red rail + save guard. */
  validate?: (item: TItem) => ListEditorValidationResult
  /**
   * Vuelidate `$scope` (the same one the consumer's row forms / save-gate collector use). When set,
   * the editor registers its aggregate validity under it, so a plain `v$.$invalid` save gate blocks
   * AND reveals a collapsed invalid row — no `validateAll()` call needed in the save flow. Omit to
   * keep legacy behavior (gate the save on the exposed `validateAll()` yourself); `false` opts out.
   */
  validationScope?: ListEditorValidationScope | false
  /**
   * Opt-in lifted controller (`useNestedListEditorController()`) so state
   * survives unmount/remount; omitted = internal controller. Same handle
   * reachable via `useTemplateRef`.
   */
  editor?: NestedListEditorHandle<TItem>

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
  showMoveToPosition?: boolean
  showChangeParent?: boolean
  showExpandToggle?: boolean

  addLabel?: string | null
  emptyTitle?: string | null

  disableRowClick?: boolean
  disableDeleteConfirm?: boolean
  deleteConfirmTitle?: string | null
  deleteConfirmText?: string | null
  /**
   * How a row delete persists. `deferred` (default): the row disappears but the deletion counts as an
   * unconfirmed change until save (revertible until then, incl. via reorder Cancel). `immediate`: the
   * consumer deletes on the backend — the dialog says it is irreversible and it does NOT read as unsaved.
   */
  deleteMode?: 'immediate' | 'deferred'

  closeVariant?: 'auto' | 'icon' | 'labeled'

  loadingKeys?: Set<ListEditorKey> | null

  showReorderToggle?: boolean
  disableReorder?: boolean
  disableDrag?: boolean

  onDeleteConfirm?: (item: TItem) => Promise<boolean> | boolean
  onDelete?: (item: TItem) => Promise<void> | void
  onItemSave?: (item: TItem) => Promise<void> | void
  onReorderApply?: (tree: NestedTree<TItem>) => Promise<void> | void

  /** Registers this editor as a named unsaved-changes section under the given (translated) label. */
  unsavedSectionLabel?: string
}

const props = withDefaults(defineProps<Props<TItem>>(), {
  unsavedSectionLabel: undefined,
  factory: undefined,
  getKey: undefined,
  position: undefined,
  parentField: 'parent',
  dirtyExclude: undefined,
  validate: undefined,
  validationScope: undefined,
  editor: undefined,
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
  showMoveToPosition: false,
  showChangeParent: false,
  showExpandToggle: true,
  addLabel: null,
  emptyTitle: null,
  disableRowClick: false,
  disableDeleteConfirm: false,
  deleteConfirmTitle: null,
  deleteConfirmText: null,
  deleteMode: 'deferred',
  closeVariant: 'auto',
  loadingKeys: null,
  showReorderToggle: true,
  disableReorder: false,
  disableDrag: false,
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

defineSlots<{
  header?: (props: HeaderSlotProps) => unknown
  'reorder-toggle'?: (props: ReorderToggleSlotProps) => unknown
  'reorder-toolbar'?: (props: ToolbarSlotProps) => unknown
  empty?: (props: EmptySlotProps) => unknown
  'add-button'?: (props: AddButtonSlotProps) => unknown
  item?: (props: RowSlotProps<TItem>) => unknown
  'item-compact'?: (props: RowSlotProps<TItem>) => unknown
  'item-readonly'?: (props: RowSlotProps<TItem>) => unknown
  'item-status'?: (props: RowSlotProps<TItem>) => unknown
  'item-footer'?: (props: RowSlotProps<TItem>) => unknown
  'item-actions'?: (props: RowSlotProps<TItem>) => unknown
  'before-item'?: (props: RowSlotProps<TItem>) => unknown
  'after-item'?: (props: RowSlotProps<TItem>) => unknown
}>()

const { t } = useI18n()
const slots = useSlots()
const { showWarningT } = useAlerts()

const rootEl = useTemplateRef<HTMLElement>('rootEl')
const { isNarrow } = useContainerWidth(rootEl)

const isTouch = useIsTouchDevice()

const effectiveCloseVariant = computed<'icon' | 'labeled'>(() => {
  if (props.closeVariant === 'icon') return 'icon'
  if (props.closeVariant === 'labeled') return 'labeled'
  return isNarrow.value ? 'icon' : 'labeled'
})

const childrenExpandedKeys = ref<Set<ListEditorKey>>(new Set())
// Readonly detail body visibility — independent of subtree expansion.
const detailExpandedKeys = ref<Set<ListEditorKey>>(new Set())

// Local mirror of the controller's key resolution so walkers + the template key
// rows the same way the controller tracks them. Construction-time config, read once.
/* eslint-disable vue/no-setup-props-reactivity-loss */
const getKeyOpt = props.getKey ?? 'id'
const keyFieldName = (typeof getKeyOpt === 'function' ? 'id' : getKeyOpt) as string
const keyOf = (data: TItem): ListEditorKey =>
  typeof getKeyOpt === 'function'
    ? getKeyOpt(data)
    : (data[getKeyOpt as keyof TItem] as ListEditorKey)

// Managed position field (row position, move-to-position dialog, flatViewItems). Mirrors the controller.
const positionFieldName = ((): string => {
  const p = props.position
  if (p === undefined || p === false) return 'position'
  if (typeof p === 'object') return p.field
  return p
})()

const initChildrenExpanded = (tree: NestedTree<TItem>) => {
  const walk = (nodes: NestedTreeNode<TItem>[]) => {
    for (const n of nodes) {
      if (n.children && n.children.length > 0) {
        childrenExpandedKeys.value.add(keyOf(n.data))
        walk(n.children)
      }
    }
  }
  walk(tree.children)
}
// eslint-disable-next-line vue/no-ref-object-reactivity-loss
initChildrenExpanded(modelValue.value)

// State controller (v2). Default: this editor owns it; opt-in `:editor` lift lets
// state survive unmount/remount. Undefined getKey/position/validate fall back to
// controller defaults ('id' / 'position' / always-valid). Its `viewItems` ignores
// expand state, so we re-project an expand-aware list below (flatViewItems).
const controller =
  props.editor ??
  useNestedListEditorController<TItem>({
    get: () => modelValue.value,
    set: (v) => (modelValue.value = v),
    factory: props.factory,
    getKey: props.getKey as GetKey<TItem> | undefined,
    position: props.position as PositionOption<TItem> | undefined,
    parentField: props.parentField,
    maxDepth: props.maxDepth,
    dirtyExclude: () => props.dirtyExclude ?? [],
    validate: props.validate,
  })
/* eslint-enable vue/no-setup-props-reactivity-loss */

// FULL flattened list (collapsed-branch rows included) built directly off the
// tree: the recursive renderer (LeNestedRow) filters by parentKey + childrenExpandedKeys,
// so it needs every row present in viewItemsDecorated even when hidden.
const flatViewItems = computed<NestedViewItem<TItem>[]>(() => {
  const flat: NestedViewItem<TItem>[] = []
  let flatIndex = 0
  const maxDepth = props.maxDepth
  const walk = (
    nodes: NestedTreeNode<TItem>[],
    depth: number,
    parentNode: NestedTreeNode<TItem> | null,
  ) => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const key = keyOf(node.data)
      const childrenAllowed = node.children !== undefined
      const hasChildren = childrenAllowed && (node.children?.length ?? 0) > 0
      const childrenCount = node.children?.length ?? 0
      const remainingDepth = maxDepth - (depth + 1)
      flat.push({
        key,
        index: flatIndex++,
        raw: node.data,
        position: node.data[positionFieldName] as number | undefined,
        node,
        depth,
        parent: parentNode?.data ?? null,
        parentKey: parentNode ? keyOf(parentNode.data) : null,
        childrenCount,
        hasChildren,
        childrenAllowed,
        siblingIndex: i,
        siblingCount: nodes.length,
        firstInParent: i === 0,
        lastInParent: i === nodes.length - 1,
        canAddChild: childrenAllowed && remainingDepth > 0,
        canIndent: i > 0,
        canOutdent: depth > 0,
      })
      if (hasChildren) walk(node.children as NestedTreeNode<TItem>[], depth + 1, node)
    }
  }
  walk(modelValue.value.children, 0, null)
  return flat
})

// Snapshot for reorder-cancel restore only; dirty detection lives in the controller.
// `movedKeys` is component view state driving the toolbar "N pending" counter,
// cleared on every mode transition by `useReorderMode`.
const snapshot = shallowRef<NestedTree<TItem> | null>(null)
const movedKeys = ref<Set<ListEditorKey>>(new Set())
// Deletes made during the current reorder session, split by mode — deferred ones count in the toolbar
// and revert on Cancel; immediate (backend) ones are re-applied on Cancel so they stay gone (else the
// snapshot-restore would resurrect a server-deleted row). Mirrors ASortableListEditor.
const sessionDeferredDeletes = ref<Set<ListEditorKey>>(new Set())
const sessionImmediateDeletes = ref<Set<ListEditorKey>>(new Set())

// Re-baseline current tree as saved. Legacy name kept; maps onto `controller.commit()`.
const resetDirtyBaseline = () => {
  controller.commit()
  movedKeys.value = new Set()
}
// Mark row + every descendant moved — a moved parent visually carries its subtree.
const markMoved = (key: ListEditorKey) => {
  const { node } = controller.findNode(key)
  if (!node) {
    movedKeys.value.add(key)
    return
  }
  const collect = (n: NestedTreeNode<TItem>) => {
    movedKeys.value.add(keyOf(n.data))
    if (n.children) n.children.forEach(collect)
  }
  collect(node)
}

const decoratorCache = new Map<ListEditorKey, DecoratedNestedViewItem<TItem>>()
const viewItemsDecorated = computed<DecoratedNestedViewItem<TItem>[]>(() => {
  const next: DecoratedNestedViewItem<TItem>[] = []
  const liveKeys = new Set<ListEditorKey>()
  for (const vi of flatViewItems.value) {
    liveKeys.add(vi.key)
    const editing = editingKeys.value.has(vi.key)
    const expanded = detailExpandedKeys.value.has(vi.key)
    const childrenExpanded = childrenExpandedKeys.value.has(vi.key)
    const loading = props.loadingKeys?.has(vi.key) ?? false
    const moved = movedKeys.value.has(vi.key)
    // Amber = controller dirty OR reorder-session moved. readonly suppresses it
    // (read-only views can't be unsaved; also dodges a mount-before-load baseline). (QA 85050 sweep)
    const dirty = props.readonly ? false : controller.isUnsaved(vi.key)
    const unsaved = props.readonly ? false : dirty || moved
    const cached = decoratorCache.get(vi.key)
    if (
      cached &&
      cached.raw === vi.raw &&
      cached.index === vi.index &&
      cached.position === vi.position &&
      cached.depth === vi.depth &&
      cached.parentKey === vi.parentKey &&
      cached.childrenCount === vi.childrenCount &&
      cached.firstInParent === vi.firstInParent &&
      cached.lastInParent === vi.lastInParent &&
      cached.editing === editing &&
      cached.expanded === expanded &&
      cached.childrenExpanded === childrenExpanded &&
      cached.loading === loading &&
      cached.dirty === dirty &&
      cached.moved === moved &&
      cached.unsaved === unsaved
    ) {
      next.push(cached)
      continue
    }
    const decorated: DecoratedNestedViewItem<TItem> = {
      ...vi,
      editing,
      expanded,
      childrenExpanded,
      loading,
      dirty,
      moved,
      unsaved,
    }
    decoratorCache.set(vi.key, decorated)
    next.push(decorated)
  }
  for (const key of decoratorCache.keys()) {
    if (!liveKeys.has(key)) decoratorCache.delete(key)
  }
  return next
})

const isEmpty = computed(() => modelValue.value.children.length === 0)
const totalItemCount = computed(() => flatViewItems.value.length)

const rowsContainer = useTemplateRef<HTMLElement>('rowsContainer')

const canInteract = computed(() => !props.readonly && !props.disabled && !props.loading)
const canEnterReorder = computed(
  () => canInteract.value && !props.disableReorder && totalItemCount.value > 1,
)

const isInlineEdit = computed(() => !!(slots as Record<string, unknown>).item)
const hasReadonlyDetail = computed(() => !!(slots as Record<string, unknown>)['item-readonly'])
const showInlineSaveFooter = computed(() => !!props.onItemSave)

const {
  editingKeys,
  editingSnapshots,
  clearEditing,
  beginEdit,
  cancelEdit,
  commitEdit,
  closeEdit,
  requestAutoOpen,
} = useInlineEditing<TItem, NestedViewItem<TItem>>({
  rowsContainer,
  rowSelector: '.a-le-row-wrapper',
  isInlineEdit,
  // markDirty=false: restoring the pre-edit snapshot on cancel must not flag the
  // node dirty (it would otherwise be resent by partial-multi saves).
  restoreSnapshot: (key, data) => controller.updateItem(key, data, false),
  watchKeys: () => {
    const keys: ListEditorKey[] = []
    const walk = (nodes: NestedTreeNode<TItem>[]) => {
      for (const n of nodes) {
        keys.push(keyOf(n.data))
        if (n.children && n.children.length) walk(n.children)
      }
    }
    walk(modelValue.value.children)
    return keys
  },
  findEntry: (key) => {
    const { node } = controller.findNode(key)
    return node ? { data: node.data } : null
  },
  afterAutoOpen: (key) => {
    const { parent } = controller.findNode(key)
    if (parent) {
      childrenExpandedKeys.value.add(keyOf(parent.data))
    }
  },
})

const {
  applying,
  applyError,
  hasPendingChanges,
  movedCount,
  reorderMode,
  enterReorderMode,
  cancelReorderMode,
  applyReorder,
} = useReorderMode<NestedTree<TItem>>({
  mode,
  snapshot,
  movedKeys,
  modelValue,
  cloneModel: (m) => cloneDeep(m) as NestedTree<TItem>,
  applyModel: (m) => {
    modelValue.value = m
  },
  canEnterReorder,
  onEnter: () => {
    sessionDeferredDeletes.value = new Set()
    sessionImmediateDeletes.value = new Set()
    clearEditing()
    // Expand every branch so all rows are reachable drag targets.
    for (const k of expandableKeys.value) childrenExpandedKeys.value.add(k)
    nextTick(() => {
      if (dragEnabled.value) initSortables()
    })
  },
  onExternalEnter: () => {
    sessionDeferredDeletes.value = new Set()
    sessionImmediateDeletes.value = new Set()
    clearEditing()
  },
  // Cancel: the snapshot-restore has brought every deleted row back; reconcile the controller so a
  // deferred delete truly reverts (clear tombstone, row stays) and an immediate delete stays gone (row
  // removed again — it is deleted on the backend and must not resurrect / be re-created by a save).
  onCancel: () => {
    for (const key of sessionDeferredDeletes.value) controller.restoreDeleted(key)
    for (const key of sessionImmediateDeletes.value)
      controller.deleteItem(key, { trackDeleted: false })
    sessionDeferredDeletes.value = new Set()
    sessionImmediateDeletes.value = new Set()
    destroySortables()
  },
  onApplyEnd: () => {
    sessionDeferredDeletes.value = new Set()
    sessionImmediateDeletes.value = new Set()
    destroySortables()
  },
  onReorderApply: (tree) => props.onReorderApply?.(tree),
  emit: {
    reorderStart: () => emit('reorder-start'),
    reorderCancel: () => emit('reorder-cancel'),
    reorderApplied: (payload) => emit('reorder-applied', payload),
    reorderApplyError: (err) => emit('reorder-apply-error', err),
    reorderEnd: () => emit('reorder-end'),
  },
})

// Reorder-toolbar pending indicator = session moves + deferred deletes made in the session, so a delete
// in reorder mode no longer reads as "no pending changes" and Apply stays enabled.
const nestedPendingCount = computed<number>(
  () => movedCount.value + sessionDeferredDeletes.value.size,
)
const nestedPendingChanges = computed<boolean>(
  () => hasPendingChanges.value || sessionDeferredDeletes.value.size > 0,
)

const canAdd = computed(() => canInteract.value && props.showAddButton && !reorderMode.value)
const dragEnabled = computed(() => reorderMode.value && !isTouch.value && !props.disableDrag)

const addLabelResolved = computed(() =>
  props.addLabel ? t(props.addLabel) : t('common.sortable.add'),
)
const emptyTitleResolved = computed(() => props.emptyTitle ?? t('common.sortable.emptyTitle'))
const deleteConfirmTitleResolved = computed(
  () => props.deleteConfirmTitle ?? t('common.sortable.deleteConfirmTitle'),
)
const deleteConfirmTextResolved = computed(
  () =>
    props.deleteConfirmText ??
    (props.deleteMode === 'immediate'
      ? t('common.sortable.deleteConfirmText')
      : t('common.sortable.deleteConfirmTextDeferred')),
)

const reorderToggleVisible = computed<boolean>(
  (): boolean =>
    !props.readonly && props.showReorderToggle && !reorderMode.value && totalItemCount.value > 0,
)

const compactReorderButton = computed<boolean>((): boolean => !!props.title && isNarrow.value)

// Keys of every node that has children — the expand/collapse candidates.
const expandableKeys = computed<ListEditorKey[]>(() => {
  const out: ListEditorKey[] = []
  const walk = (nodes: NestedTreeNode<TItem>[]) => {
    for (const n of nodes) {
      if (n.children && n.children.length > 0) {
        out.push(keyOf(n.data))
        walk(n.children)
      }
    }
  }
  walk(modelValue.value.children)
  return out
})

const allExpanded = computed<boolean>(
  () =>
    expandableKeys.value.length > 0 &&
    expandableKeys.value.every((k) => childrenExpandedKeys.value.has(k)),
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
      props.title ||
      (slots as Record<string, unknown>).header ||
      (slots as Record<string, unknown>)['reorder-toggle'] ||
      reorderToggleVisible.value ||
      expandAllVisible.value ||
      reorderMode.value
    ),
)

// One Sortable instance per group so drag/drop moves items within/between groups;
// SortableJS owns the pointer events, onEnd reconciles via editor.moveTo().
const sortableInstances = ref<
  Array<{ stop: () => void; option?: (k: string, v: unknown) => void }>
>([])
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
const HANDLE_CLASS = 'a-le-drag-handle'

// Live drag state. `instruction` is recomputed on every pointermove and encodes
// where + at what depth the dragged item lands (sibling-above/below/make-child/blocked);
// the overlay reads it, onEnd applies it via `editor.moveTo`. SortableJS never moves
// the DOM (onMove always returns false) — hit-testing, depth and the mutation are all ours.
const dragState = ref<DragState | null>(null)

// Drop indicator anchor geometry, kept in sync with CSS (reorder-mode header
// padding-left = 12 + depth*24, drag handle = 20px). ANCHOR_X = 12 + half handle
// (10) = 22 puts the dot on the handle's centre; the line steps 24px per depth.
const INDENT_PX = 24
const ANCHOR_X = 22

const hitTestRow = (
  clientX: number,
  clientY: number,
): { el: HTMLElement; viewItem: DecoratedNestedViewItem<TItem> } | null => {
  const hit = document.elementFromPoint(clientX, clientY) as HTMLElement | null
  if (!hit) return null
  const wrapper = hit.closest('.a-le-row-wrapper') as HTMLElement | null
  if (!wrapper) return null
  // Only wrappers inside our rowsContainer — elementFromPoint could hit a
  // different ANestedSortableListEditor instance on the same page.
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
  // Hit-test the `.a-le-row` child, not the wrapper — the wrapper's height
  // balloons when children are rendered.
  const rowEl = hit.el.querySelector(':scope > .a-le-row') as HTMLElement | null
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
    containerPaddingLeft: ANCHOR_X,
  })
}

const onPointerMove = (e: PointerEvent) => {
  recomputeInstruction(e.clientX, e.clientY)
}

const applyInstruction = (inst: ExecutableInstruction, sourceKey: ListEditorKey) => {
  const ok = controller.moveTo(sourceKey, inst.parentKey, inst.index)
  if (!ok) {
    showWarningT('common.sortable.error.maxDeepExceed')
    forceRerender.value++
    nextTick(() => initSortables())
    return
  }
  markMoved(sourceKey)
  // makeChild: expand the new parent so the just-moved row doesn't vanish into a collapsed branch.
  if (inst.makeChild && inst.parentKey !== null) {
    childrenExpandedKeys.value.add(inst.parentKey)
  }
}

const initSortables = () => {
  destroySortables()
  if (!dragEnabled.value) return
  if (!rowsContainer.value) return
  const groups = Array.from(rowsContainer.value.querySelectorAll<HTMLElement>('.' + GROUP_CLASS))
  for (const group of groups) {
    const sortable = useSortable(group, [], {
      group: { name: 'a-nested', pull: true, put: true },
      handle: '.' + HANDLE_CLASS,
      animation: 0,
      ghostClass: DRAG_GHOST_CLASS,
      chosenClass: DRAG_CHOSEN_CLASS,
      dragClass: DRAG_CLASS,
      fallbackOnBody: true,
      forceFallback: true,
      fallbackTolerance: 3,
      onStart: (event) => {
        const draggedEl = event.item as HTMLElement
        const id = parseKey(draggedEl.getAttribute('data-id'))
        if (id === null) return
        const draggedNode = controller.findNode(id).node
        const subtreeDepth = draggedNode ? controller.calculateSubtreeDepth(draggedNode) : 1
        dragState.value = {
          sourceKey: id,
          sourceSubtreeDepth: subtreeDepth,
          instruction: null,
        }
        document.addEventListener('pointermove', onPointerMove, { passive: true })
      },
      onMove: (event) => {
        // Also track the pointer via SortableJS's stream — keeps `instruction`
        // in sync when the browser coalesces pointermove events during fast drags.
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
        // Refuse SortableJS's own DOM insertion — onEnd's `editor.moveTo` drives the move.
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
  // Numeric key only when `data-id` is a pure integer string (incl. negative temp
  // ids like "-1"); else a DocId/UUID. The old `n > 0` test sent negative temp ids
  // to the string branch, so a freshly-added row's move marked the wrong key.
  const n = stringToInt(raw)
  return String(n) === raw ? n : raw
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

// Rebuild sortables when the tree shape changes during drag mode, else newly rendered groups aren't draggable.
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

// Overlay visual props from the current instruction; `null` = hidden (no
// instruction, or blocked). The optional connector is a rail from the drop line
// up to the row whose level dictates the insert. Measured via getBoundingClientRect
// rather than CSS anchor positioning: Chrome's anchor-reachability rule excludes
// some deeply-nested descendants, so JS measurement is simpler and more reliable.
type OverlayVisual = {
  line: { top: number; left: number; right: number }
  connector: { top: number; height: number; left: number } | null
}

const overlayVisual = computed<OverlayVisual | null>(() => {
  const state = dragState.value
  if (!state || state.instruction === null || !rowsContainer.value) return null
  const inst = state.instruction
  // Blocked drops render nothing — the silent empty space is the "not here" signal.
  if (inst.type === 'blocked') return null
  const refWrapper = rowsContainer.value.querySelector<HTMLElement>(
    `.a-le-row-wrapper[data-id="${CSS.escape(String(inst.refKey))}"]`,
  )
  if (!refWrapper) return null
  const rowEl = refWrapper.querySelector<HTMLElement>(':scope > .a-le-row')
  const containerRect = rowsContainer.value.getBoundingClientRect()
  const rowRect = (rowEl ?? refWrapper).getBoundingClientRect()

  const lineLeft = ANCHOR_X + inst.depth * INDENT_PX
  const lineTop =
    inst.refEdge === 'top' ? rowRect.top - containerRect.top : rowRect.bottom - containerRect.top
  const line = { top: lineTop, left: lineLeft, right: 16 }

  let connector: OverlayVisual['connector'] = null
  if (inst.levelRowKey !== null) {
    const levelWrapper = rowsContainer.value.querySelector<HTMLElement>(
      `.a-le-row-wrapper[data-id="${CSS.escape(String(inst.levelRowKey))}"]`,
    )
    if (levelWrapper) {
      const levelRow = levelWrapper.querySelector<HTMLElement>(':scope > .a-le-row')
      const levelRect = (levelRow ?? levelWrapper).getBoundingClientRect()
      const levelCentreY = levelRect.top - containerRect.top + levelRect.height / 2
      if (levelCentreY < lineTop) {
        connector = {
          top: levelCentreY,
          height: lineTop - levelCentreY,
          left: lineLeft,
        }
      }
    }
  }

  return { line, connector }
})

// With a `factory`, the editor inserts through the controller; without one it
// stays emit-only so legacy `@add` consumers drive the insert. The `add` event
// fires either way.
const onAddClick = () => {
  if (!canAdd.value) return
  requestAutoOpen()
  if (props.factory) controller.addItem()
  emit('add', undefined)
}

const onRowAddAfterClick = (vi: NestedViewItem<TItem>) => {
  if (!canInteract.value) return
  requestAutoOpen()
  if (props.factory) controller.addAfter(vi.key, undefined, vi.childrenAllowed)
  emit('add', { afterId: vi.key, childrenAllowed: vi.childrenAllowed })
}

const onAddChildClick = (vi: NestedViewItem<TItem>) => {
  if (!canInteract.value) return
  if (!vi.canAddChild) return
  requestAutoOpen()
  childrenExpandedKeys.value.add(vi.key)
  emit('add-child', vi)
  // Append to the end of children, matching the root "Add item" semantic.
  // (Drag-drop make-child still lands at index 0 — its drop line sits just below the parent.)
  if (props.factory) controller.addChild(vi.key, undefined, true)
  emit('add', { parentId: vi.key, childrenAllowed: true })
}

const onEditClick = (vi: NestedViewItem<TItem>) => {
  if (!canInteract.value || reorderMode.value) return
  // Clicking edit while already editing closes the form, so the pencil toggles like the row header.
  if (editingKeys.value.has(vi.key)) {
    onCloseClick(vi)
    return
  }
  if (isInlineEdit.value) {
    beginEdit(vi)
  }
  emit('edit', vi)
}

// Toggles tree children visibility (distinct from the readonly-detail body below).
const onChevronClick = (vi: NestedViewItem<TItem>) => {
  if (props.disabled || props.loading) return
  const key = vi.key
  const currently = childrenExpandedKeys.value.has(key)
  if (currently) childrenExpandedKeys.value.delete(key)
  else childrenExpandedKeys.value.add(key)
  emit('item-expand', vi, !currently)
}

// Toggles the row's readonly-detail body (separate from tree children).
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

const {
  deleteDialog,
  deleteInFlight,
  deleteError,
  onDeleteClick: triggerDeleteClick,
  onDeleteDialogConfirm,
  onDeleteDialogCancel,
} = useDeleteDialog<TItem, NestedViewItem<TItem>>({
  onDeleteConfirm: (raw) => (props.onDeleteConfirm ? props.onDeleteConfirm(raw) : true),
  onDelete: (raw) => props.onDelete?.(raw),
  onDeleted: (vi) => {
    editingKeys.value.delete(vi.key)
    editingSnapshots.value.delete(vi.key)
    detailExpandedKeys.value.delete(vi.key)
    childrenExpandedKeys.value.delete(vi.key)
    const deferred = props.deleteMode === 'deferred'
    // A delete in reorder mode is a session change: deferred reverts on Cancel, immediate stays gone
    // (re-applied after Cancel's snapshot-restore).
    if (reorderMode.value) {
      if (deferred) sessionDeferredDeletes.value.add(vi.key)
      else sessionImmediateDeletes.value.add(vi.key)
    }
    // Controller owns removal (mirrors the flat editors): a deferred saved-row delete is tombstoned
    // (counts as unsaved); immediate skips it (already deleted on the backend). Runs before the
    // `deleted` emit so a consumer's handler still receives `vi.raw`.
    controller.deleteItem(vi.key, { trackDeleted: deferred })
    emit('deleted', vi)
  },
  disableDeleteConfirm: () => props.disableDeleteConfirm,
})

const onDeleteClick = async (vi: NestedViewItem<TItem>) => {
  if (!canInteract.value) return
  await triggerDeleteClick(vi)
}

const onSaveClick = async (vi: NestedViewItem<TItem>) => {
  if (props.onItemSave) await props.onItemSave(vi.raw)
  commitEdit(vi)
  emit('item-saved', vi)
}

const onCancelClick = (vi: NestedViewItem<TItem>) => {
  cancelEdit(vi)
}

const onCloseClick = (vi: NestedViewItem<TItem>) => {
  closeEdit(vi)
  emit('close', vi)
}

const moveUp = (id: ListEditorKey) => {
  if (controller.moveUp(id)) markMoved(id)
}
const moveDown = (id: ListEditorKey) => {
  if (controller.moveDown(id)) markMoved(id)
}
const moveTop = (id: ListEditorKey) => {
  if (controller.moveTop(id)) markMoved(id)
}
const moveBottom = (id: ListEditorKey) => {
  if (controller.moveBottom(id)) markMoved(id)
}
const doIndent = (vi: NestedViewItem<TItem>) => {
  if (!controller.indent(vi.key)) {
    showWarningT('common.sortable.error.maxDeepExceed')
    return
  }
  markMoved(vi.key)
  emit('indent', vi)
}
const doOutdent = (vi: NestedViewItem<TItem>) => {
  if (!controller.outdent(vi.key)) return
  markMoved(vi.key)
  emit('outdent', vi)
}

const resolveCompactText = (raw: TItem): string =>
  resolveCompactTextUtil(raw, { compactField: props.compactField })

// Row validation from the controller's gated `rowState` — red rail shows only
// once the row is unsaved or `validateAll()` ran.
// `editing` → the controller reads amber (not red) while the row is being filled in. (QA 85050 b7)
const resolveValidation = (raw: TItem, key?: ListEditorKey): ListEditorValidationState =>
  key === undefined ? null : controller.rowState(raw, key, editingKeys.value.has(key))

// Per-key actions cache for stable per-row identity (see AListEditor). Closures
// capture the stable key and look up the current vi via findVi at call time.
type ActionsBundle = {
  edit: () => void
  save: () => Promise<void> | void
  cancel: () => void
  close: () => void
  delete: () => Promise<void>
  addAfter: () => void
  addChild: () => void
  toggleExpand: () => void
  toggleDetail: () => void
  moveUp: () => void
  moveDown: () => void
  moveTop: () => void
  moveBottom: () => void
  indent: () => void
  outdent: () => void
  update: (data: TItem) => void
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
      addChild: () => {
        const vi = findVi(key)
        if (vi) onAddChildClick(vi)
      },
      toggleExpand: () => {
        const vi = findVi(key)
        if (vi) onChevronClick(vi)
      },
      toggleDetail: () => {
        const vi = findVi(key)
        if (vi) onDetailToggle(vi)
      },
      moveUp: () => moveUp(key),
      moveDown: () => moveDown(key),
      moveTop: () => moveTop(key),
      moveBottom: () => moveBottom(key),
      indent: () => {
        const vi = findVi(key)
        if (vi) doIndent(vi)
      },
      outdent: () => {
        const vi = findVi(key)
        if (vi) doOutdent(vi)
      },
      update: (data: TItem) => controller.updateItem(key, data),
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

const buildSlotProps = (vi: DecoratedNestedViewItem<TItem>) => ({
  item: { ...vi, validationState: resolveValidation(vi.raw as TItem, vi.key) },
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
  actions: getActions(vi.key),
})

const toolbarSlotProps = computed(() => ({
  applying: applying.value,
  hasPendingChanges: nestedPendingChanges.value,
  movedCount: nestedPendingCount.value,
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

const expandableKeySet = computed(() => new Set(expandableKeys.value))

const findVi = (key: ListEditorKey): DecoratedNestedViewItem<TItem> | undefined =>
  viewItemsDecorated.value.find((v) => v.key === key)

const keyboardNav = useKeyboardNav({
  viewItems: computed(() =>
    viewItemsDecorated.value.map((vi) => ({
      key: vi.key,
      expanded: vi.childrenExpanded,
      canExpand: expandableKeySet.value.has(vi.key),
      canIndent: true,
      canOutdent: true,
    })),
  ),
  variant: 'nested',
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
  onMoveUp: (key) => moveUp(key),
  onMoveDown: (key) => moveDown(key),
  onMoveTop: (key) => moveTop(key),
  onMoveBottom: (key) => moveBottom(key),
  onIndent: (key) => {
    const vi = findVi(key)
    if (vi) doIndent(vi)
  },
  onOutdent: (key) => {
    const vi = findVi(key)
    if (vi) doOutdent(vi)
  },
  onToggleChildren: (key) => {
    const vi = findVi(key)
    if (vi) onChevronClick(vi)
  },
  onCancelReorder: () => cancelReorderMode(),
})

const moveToPositionDialogOpen = ref<boolean>(false)
const moveToPositionTarget = shallowRef<DecoratedNestedViewItem<TItem> | null>(null)
const moveToPositionContext = computed<{
  parentId: ListEditorKey | null
  total: number
  currentIndex: number
} | null>(() => {
  const target = moveToPositionTarget.value
  if (!target) return null
  const found = controller.findNode(target.key)
  const siblings = found.parent?.children ?? modelValue.value.children
  const idx = siblings.findIndex((s) => keyOf(s.data) === target.key)
  return {
    parentId: found.parent ? keyOf(found.parent.data) : null,
    total: siblings.length,
    currentIndex: idx,
  }
})
const moveToPositionLabel = computed<string>(() =>
  moveToPositionTarget.value ? resolveCompactText(moveToPositionTarget.value.raw) : '',
)
const openMoveToPosition = (vi: DecoratedNestedViewItem<TItem>) => {
  if (!props.showMoveToPosition) return
  moveToPositionTarget.value = vi
  moveToPositionDialogOpen.value = true
}
const onMoveToPositionConfirm = (newIndex: number) => {
  const ctx = moveToPositionContext.value
  const target = moveToPositionTarget.value
  moveToPositionTarget.value = null
  if (!ctx || !target) return
  if (newIndex === ctx.currentIndex) return
  if (controller.moveTo(target.key, ctx.parentId, newIndex)) {
    markMoved(target.key)
  }
}

const changeParentDialogOpen = ref<boolean>(false)
const changeParentTarget = shallowRef<DecoratedNestedViewItem<TItem> | null>(null)
const openChangeParent = (vi: DecoratedNestedViewItem<TItem>) => {
  if (!props.showChangeParent) return
  changeParentTarget.value = vi
  changeParentDialogOpen.value = true
}
const onChangeParentConfirm = (parentId: ListEditorKey | null, position: 'first' | 'last') => {
  const target = changeParentTarget.value
  changeParentTarget.value = null
  if (!target) return
  // Sibling count under the new parent so 'last' resolves to the right index ('first' = 0).
  let siblingCount = 0
  if (parentId === null) {
    siblingCount = modelValue.value.children.length
  } else {
    const found = controller.findNode(parentId)
    siblingCount = found.node?.children?.length ?? 0
  }
  const targetIndex = position === 'first' ? 0 : siblingCount
  if (controller.moveTo(target.key, parentId, targetIndex)) {
    markMoved(target.key)
    if (parentId !== null) childrenExpandedKeys.value.add(parentId)
  }
}

// Aggregated display flags + helpers passed into each <LeNestedRow>.
const rowContext = computed(() => ({
  reorderMode: reorderMode.value,
  readonly: props.readonly,
  canInteract: canInteract.value,
  dragEnabled: dragEnabled.value,
  showExpandToggle: props.showExpandToggle,
  showEditButton: props.showEditButton,
  showDeleteButton: props.showDeleteButton,
  showAddChildButton: props.showAddChildButton,
  showAddAfterAction: props.showAddAfterAction,
  showMoveToPosition: props.showMoveToPosition,
  showChangeParent: props.showChangeParent,
  showInlineSaveFooter: showInlineSaveFooter.value,
  statusField: props.statusField,
  effectiveCloseVariant: effectiveCloseVariant.value,
  keyboardNav,
  isRowClickable,
  resolveCompactText,
  resolveValidation: (raw: TItem, key?: ListEditorKey) => resolveValidation(raw, key),
  buildSlotProps,
}))

// Event callback bundle passed to each row.
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
  openMoveToPosition,
  openChangeParent,
}

const rootViewItems = computed(() => viewItemsDecorated.value.filter((v) => v.parentKey === null))

// Imperative aliases mirroring the legacy ASortableNested signatures so existing
// consumers keep working. They assume the caller persists server-side, so they
// re-baseline via `controller.commit()` (rows don't render "unsaved" after the
// call) and return the live model. New consumers should use the controller handle directly.

/** @deprecated Use `addItem(data, { afterId, childrenAllowed })` on the handle. */
const addAfterId = (targetId: ListEditorKey | null, data: TItem, childrenAllowed: boolean) => {
  controller.addItem(data, { afterId: targetId ?? undefined, childrenAllowed })
  nextTick(() => controller.commit())
  return modelValue.value
}
/** @deprecated Use `addChild(parentKey, data, childrenAllowed)` on the handle. */
const addChildToId = (targetId: ListEditorKey, data: TItem, childrenAllowed: boolean) => {
  childrenExpandedKeys.value.add(targetId)
  // Legacy "prepend as first child" semantic (canonical `addChild` appends to the end).
  controller.addItem(data, { parentId: targetId, asFirstChild: true, childrenAllowed })
  nextTick(() => controller.commit())
  return modelValue.value
}
/** @deprecated Use `deleteItem(id)` on the handle. */
const removeById = (id: ListEditorKey) => {
  controller.deleteItem(id)
  editingKeys.value.delete(id)
  editingSnapshots.value.delete(id)
  detailExpandedKeys.value.delete(id)
  childrenExpandedKeys.value.delete(id)
  nextTick(() => controller.commit())
}
/** @deprecated Use `updateItem(id, data)` on the handle. */
const updateData = (
  id: ListEditorKey,
  data: TItem,
  _children: unknown = null,
  _position: unknown = null,
  _markUnsaved: unknown = null,
) => {
  controller.updateItem(id, data)
  nextTick(() => controller.commit())
}

// Total distinct unconfirmed changes (added/edited/moved/reparented rows + deferred deletions) — a
// delete counts even though its row is gone. Drives the unsaved-section label + the exposed handle.
const unsavedCount = controller.unsavedCount

// Re-baseline as saved, clear the moved set, close open edits. Legacy name kept.
const clearUnsavedState = () => {
  controller.commit()
  movedKeys.value = new Set()
  clearEditing()
}

// Registers this editor as a named unsaved-changes section when a label is passed.
useUnsavedSection(() =>
  props.unsavedSectionLabel
    ? { label: props.unsavedSectionLabel, dirty: unsavedCount.value > 0 }
    : [],
)

// Expose the controller handle plus legacy aliases and reorder/expand controls.
// Entries after the spread override controller methods where the historic name or
// return shape differs (e.g. `viewItems` is this component's expand-aware list).
// Reveal for a blocked save: open invalid rows AND expand the offender's ancestor chain so a
// collapsed nested row becomes visible. Shared by the exposed validateAll + scope reveal-on-touch.
const revealNestedInvalid = (): boolean =>
  validateAllAndReveal(controller, (key) => {
    let ancestor = controller.findNode(key).parent
    while (ancestor) {
      childrenExpandedKeys.value.add(keyOf(ancestor.data))
      ancestor = controller.findNode(keyOf(ancestor.data)).parent
    }
    const vi = controller.viewItems.value.find((v) => v.key === key)
    if (vi) beginEdit(vi)
  })

// Auto-bridge the editor's aggregate validity into the consumer's `validation-scope` collector so a
// plain `$invalid` save gate blocks (and reveals) a collapsed invalid row. No-op without the prop.
// eslint-disable-next-line vue/no-setup-props-reactivity-loss -- construction-time opt-in, read once
useListEditorScopeValidity({
  hasErrors: controller.hasErrors,
  validationScope: props.validationScope,
  reveal: revealNestedInvalid,
})

defineExpose<
  NestedListEditorHandle<TItem> & {
    addAfterId: typeof addAfterId
    addChildToId: typeof addChildToId
    removeById: typeof removeById
    updateData: typeof updateData
    resetDirtyBaseline: () => void
    hasUnsavedChanges: typeof controller.hasUnsaved
    unsavedCount: typeof unsavedCount
    clearUnsavedState: () => void
    enterReorderMode: () => void
    cancelReorderMode: () => void
    applyReorder: () => Promise<void>
    expand: (id: ListEditorKey) => void
    collapse: (id: ListEditorKey) => void
    toggleExpand: (id: ListEditorKey) => void
    expandDetail: (id: ListEditorKey) => void
    collapseDetail: (id: ListEditorKey) => void
  }
>({
  ...controller,
  validateAll: revealNestedInvalid,
  // Legacy aliases (pre-v2 ASortableNested API).
  addAfterId,
  addChildToId,
  removeById,
  updateData,
  resetDirtyBaseline,
  hasUnsavedChanges: controller.hasUnsaved,
  unsavedCount,
  clearUnsavedState,
  // Expand-aware flattened view (controller's own `viewItems` ignores collapse state).
  viewItems: flatViewItems,
  enterReorderMode,
  cancelReorderMode,
  applyReorder,
  expand: (id: ListEditorKey) => childrenExpandedKeys.value.add(id),
  collapse: (id: ListEditorKey) => childrenExpandedKeys.value.delete(id),
  toggleExpand: (id: ListEditorKey) => {
    if (childrenExpandedKeys.value.has(id)) childrenExpandedKeys.value.delete(id)
    else childrenExpandedKeys.value.add(id)
  },
  expandDetail: (id: ListEditorKey) => detailExpandedKeys.value.add(id),
  collapseDetail: (id: ListEditorKey) => detailExpandedKeys.value.delete(id),
})
</script>

<template>
  <div
    ref="rootEl"
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
            <template v-if="reorderMode">
              <!-- Reorder-mode header: pending count + Cancel/Apply, sitting where
                   the "Reorder" button lives in view mode (not a bottom toolbar). -->
              <slot
                name="reorder-toolbar"
                v-bind="toolbarSlotProps"
              >
                <LeStatus
                  :class="{ 'a-le-toolbar-status--pending': nestedPendingChanges }"
                  :has-pending-changes="nestedPendingChanges"
                  :pending-count="nestedPendingCount"
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
                  :disabled="applying || !nestedPendingChanges"
                  @click="applyReorder"
                >
                  {{ t('common.sortable.reorderApply') }}
                </VBtn>
              </slot>
            </template>
            <template v-else>
              <VBtn
                v-if="expandAllVisible && compactReorderButton"
                variant="tonal"
                color="primary"
                icon
                size="x-small"
                @click="toggleExpandAll"
              >
                <VIcon
                  :icon="allExpanded ? 'mdi-unfold-less-horizontal' : 'mdi-unfold-more-horizontal'"
                  size="18"
                />
                <VTooltip
                  activator="parent"
                  location="bottom"
                  :text="
                    allExpanded ? t('common.sortable.collapseAll') : t('common.sortable.expandAll')
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
                  allExpanded ? t('common.sortable.collapseAll') : t('common.sortable.expandAll')
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
            </template>
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
            :add-label="addLabelResolved"
            :can-add="canAdd"
            @add="onAddClick"
          />
        </slot>
      </div>

      <div
        v-else
        :key="forceRerender"
        ref="rowsContainer"
        class="a-nested-list-editor__rows"
        :class="{ 'a-nested-list-editor__rows--dragging': dragState !== null }"
      >
        <div
          :class="[GROUP_CLASS, 'a-nested-list-editor__group--root']"
          data-parent-id=""
        >
          <LeNestedRow
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
          </LeNestedRow>
        </div>

        <!-- Drop indicator overlay (valid drops only): horizontal line at a row
             edge (depth in `left`) + an optional vertical connector rail to the
             row whose level the insert matches. -->
        <template v-if="overlayVisual !== null">
          <div
            v-if="overlayVisual.connector !== null"
            class="a-nested-list-editor__drop-connector"
            :style="{
              left: `${overlayVisual.connector.left}px`,
              top: `${overlayVisual.connector.top}px`,
              height: `${overlayVisual.connector.height}px`,
            }"
          />
          <div
            class="a-nested-list-editor__drop-line"
            :style="{
              top: `${overlayVisual.line.top}px`,
              left: `${overlayVisual.line.left}px`,
              right: `${overlayVisual.line.right}px`,
            }"
          >
            <span class="a-nested-list-editor__drop-line-dot" />
          </div>
        </template>
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
      :total="moveToPositionContext?.total ?? 0"
      :current-index="moveToPositionContext?.currentIndex ?? 0"
      :item-label="moveToPositionLabel"
      @confirm="onMoveToPositionConfirm"
    />

    <LeChangeParentDialog
      v-model="changeParentDialogOpen"
      :tree="modelValue"
      :source-key="changeParentTarget?.key ?? null"
      :key-field="keyFieldName"
      :max-depth="maxDepth"
      :resolve-label="resolveCompactText"
      :calculate-subtree-depth="controller.calculateSubtreeDepth"
      @confirm="onChangeParentConfirm"
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

// Nested-variant rules — depth-aware padding, tree toggle caret, children
// groups, drop indicator overlay, drag clone.
.a-nested-list-editor {
  // Depth-aware left padding — caret column + indent per depth level.
  .a-le-row-header {
    padding: var(--le-row-pad-y) 12px var(--le-row-pad-y)
      calc(16px + var(--nested-depth, 0) * var(--le-indent));
  }

  // Row wrappers + inter-row group layout.
  &__rows {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  &__group {
    display: flex;
    flex-direction: column;
  }

  // Re-apply the `font` shorthand (shared class uses longhand for flat variants)
  // so the nested variant keeps its explicit line-height reset.
  .a-le-toolbar-status {
    font: 500 13px/1 var(--v-font-body, inherit);
  }
}

.a-le-row-wrapper {
  display: flex;
  flex-direction: column;
}

.a-nested-list-editor {
  // Root rows get a bolder title weight to anchor the hierarchy without header rows.
  .a-le-row:not(.a-le-row--child) .a-le-title {
    font-weight: 600;
  }

  // Reorder mode — flat-variant padding offset by the row's indent level.
  .a-le-row--reorder .a-le-row-header {
    padding-left: calc(12px + var(--nested-depth, 0) * var(--le-indent));
    padding-right: 8px;
    gap: 8px;
  }

  // Active (editing / readonly-expanded) tree-toggle picks up the primary tint
  // so the header reads "active" together with the title color.
  .a-le-row--editing &__tree-toggle,
  .a-le-row--expanded &__tree-toggle {
    color: var(--le-primary);
  }

  // Children wrapper — depth conveyed by the row's padding-left indent alone.
  &__children {
    position: relative;
  }

  // Triangle-caret toggle — circular text-style button (24×24), transparent
  // with a subtle tinted circle on hover.
  &__tree-toggle {
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
    transition:
      background 0.15s,
      color 0.15s;

    &:hover {
      background: rgb(0 0 0 / 5%);
      color: var(--le-on-surface);
    }

    &:focus-visible {
      outline: none;
      background: rgb(0 0 0 / 8%);
    }
  }

  // Reserve caret column width on leaf rows so titles align across siblings.
  &__tree-toggle--spacer,
  &__tree-toggle--empty {
    width: 24px;
    height: 24px;
    background: transparent;
    visibility: hidden;
    pointer-events: none;
  }

  // Pure CSS right-pointing triangle; rotates to down when the row is open.
  &__tree-toggle-caret {
    width: 0;
    height: 0;
    border-left: 5px solid currentcolor;
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
    border-right: 0;
    transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    transform: translateX(1px); // optical centering — triangle leans left
  }

  &__tree-toggle--open &__tree-toggle-caret {
    transform: translate(0, 1px) rotate(90deg);
  }

  // Dragged subtree (source + descendants) dimmed and non-hittable. `!important`
  // on display beats SortableJS's inline `display: none` under `forceFallback`.
  .a-le-row-wrapper.a-le-row--chosen,
  .a-le-row-wrapper.a-le-row-wrapper--drop-disabled {
    display: flex !important;
    opacity: 0.4 !important;
    pointer-events: none !important;
  }

  // Hide SortableJS's placeholder — our overlay is the sole landing indicator.
  .a-le-row--ghost {
    display: none !important;
  }

  // No floating clone — the line overlay carries all the "where it lands" info.
  // Wrapper selector beats the `.row-wrapper--drop-disabled` rule the clone inherits.
  .a-le-row-wrapper.a-le-row--drag {
    display: none !important;
  }

  // Drop indicator line — 2px primary stroke with an 8px left terminal dot,
  // absolute-positioned inside `__rows`.
  &__drop-line {
    position: absolute;
    height: 2px;
    margin-top: -1px;
    background: var(--le-primary);
    pointer-events: none;
    z-index: 4;
    border-radius: 1px;
  }

  &__drop-line-dot {
    position: absolute;
    left: -4px;
    top: 50%;
    width: 8px;
    height: 8px;
    background: var(--le-primary);
    border-radius: 50%;
    transform: translateY(-50%);
  }

  // Connector rail — vertical line linking the drop line up to the level-match row.
  &__drop-connector {
    position: absolute;
    width: 2px;
    margin-left: -1px;
    background: var(--le-primary);
    opacity: 0.5;
    pointer-events: none;
    z-index: 3;
  }

  // While dragging, dim the add-button so focus stays on the drag target.
  &__rows--dragging .a-le-row-add {
    opacity: 0.4;
  }

  // "+N" children indicator — hidden in the normal DOM, visible only inside the
  // SortableJS drag clone so the user sees the whole branch will follow.
  &__drag-count {
    display: none;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    padding: 2px 8px;
    font: 500 11px/1 var(--v-font-body, inherit);
    letter-spacing: 0.02em;
    color: var(--le-primary);
    background: var(--le-primary-container);
    border-radius: var(--le-radius-pill);
    flex-shrink: 0;
  }

  .a-le-row--drag &__drag-count {
    display: inline-flex;
  }
}

// Desktop — depth-aware padding-left aligns the inline form with the title column:
// 16 (pad) + 24 (caret) + 10 (gap) = 50, plus depth*indent.
@container le-shell (min-width: 769px) {
  .a-nested-list-editor {
    .a-le-row--editing .a-le-row-body,
    .a-le-row--expanded .a-le-row-body,
    .a-le-row--editing .a-le-row-footer,
    .a-le-row--expanded .a-le-row-footer {
      padding-left: calc(50px + var(--nested-depth, 0) * var(--le-indent));
      padding-right: 16px;
    }
  }
}

// Narrow / mobile — tighter indent so deep branches fit, taller touch rows,
// always-visible actions, status badge dropped to make room for the title.
/* stylelint-disable selector-max-compound-selectors */
@container le-shell (max-width: 768px) {
  .a-nested-list-editor {
    --le-indent: 18px;
    --le-row-min-height: 48px;
    --le-row-pad-y: 10px;

    .a-le-row:not(.a-le-row--editing) .a-le-status {
      display: none;
    }

    .a-le-row .a-le-action--edit,
    .a-le-row .a-le-action--delete,
    .a-le-row .a-le-action--menu,
    .a-le-row .a-le-action--up,
    .a-le-row .a-le-action--down,
    .a-le-row .a-le-action--add-child {
      opacity: 1;
    }
  }
}
/* stylelint-enable selector-max-compound-selectors */
</style>
