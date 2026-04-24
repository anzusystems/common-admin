<script setup lang="ts" generic="TItem extends Record<string, any>">
import { computed, ref, useSlots, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { useSortable } from '@vueuse/integrations/useSortable'
import { useListEditor } from '@/labs/listEditor/composables/useListEditor'
import { cloneDeep } from '@/utils/common'
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
  reorderDisabled?: boolean
  disableDrag?: boolean
  toolbarMode?: 'internal' | 'external'
  toolbarBottomOffset?: number
  showMoveToPosition?: boolean

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
  reorderDisabled: false,
  disableDrag: false,
  toolbarMode: 'internal',
  toolbarBottomOffset: 12,
  showMoveToPosition: false,
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

const modelValue = defineModel<TItem[]>({ required: true })
const mode = defineModel<ReorderMode>('mode', { default: 'view' })

const { t } = useI18n()
const slots = useSlots()
const display = useDisplay()

const isTouch = computed<boolean>(() => display.platform.value.touch)

const effectiveCloseVariant = computed<'icon' | 'labeled'>(() => {
  if (props.closeVariant === 'icon') return 'icon'
  if (props.closeVariant === 'labeled') return 'labeled'
  return display.smAndDown.value ? 'icon' : 'labeled'
})

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const editor = useListEditor<TItem>(modelValue, {
  keyField: props.keyField,
  positionField: props.positionField,
  positionMultiplier: props.positionMultiplier,
  updatePosition: props.updatePosition,
})

const editingKeys = ref<Set<ListEditorKey>>(new Set())
const expandedKeys = ref<Set<ListEditorKey>>(new Set())
const editingSnapshots = ref(new Map<ListEditorKey, TItem>()) as import('vue').Ref<
  Map<ListEditorKey, TItem>
>

// Initial snapshot of each item, keyed by row key. Compared against current data to
// detect "dirty" (unsaved) rows. Reset externally after a successful parent-form save.
const dirtyBaseline = ref(new Map<ListEditorKey, string>()) as import('vue').Ref<
  Map<ListEditorKey, string>
>
const captureDirtyBaseline = () => {
  const next = new Map<ListEditorKey, string>()
  modelValue.value.forEach((item) => {
    next.set(item[props.keyField] as ListEditorKey, JSON.stringify(item))
  })
  dirtyBaseline.value = next
}
captureDirtyBaseline()

// Auto-open the most-recently-added row after an @add emit is handled by the parent.
const pendingAutoOpen = ref(false)
watch(
  () => modelValue.value.map((it) => it[props.keyField] as ListEditorKey),
  (newKeys, oldKeys) => {
    if (!pendingAutoOpen.value) return
    pendingAutoOpen.value = false
    const oldSet = new Set(oldKeys)
    const addedKey = newKeys.find((k) => !oldSet.has(k))
    if (addedKey === undefined) return
    const newItem = modelValue.value.find(
      (it) => (it[props.keyField] as ListEditorKey) === addedKey,
    )
    if (!newItem) return
    if (!isInlineEdit.value) return
    if (!editingSnapshots.value.has(addedKey)) {
      editingSnapshots.value.set(addedKey, cloneDeep(newItem) as TItem)
    }
    editingKeys.value.add(addedKey)
    expandedKeys.value.delete(addedKey)
  },
)

const deleteDialog = ref(false)
const deleteTarget = ref<ListViewItem<TItem> | null>(null)
const deleteInFlight = ref(false)
const deleteError = ref<string | null>(null)

const snapshot = ref<TItem[] | null>(null)
const applying = ref(false)
const applyError = ref<string | null>(null)

const rowsContainer = useTemplateRef<HTMLElement>('rowsContainer')

const reorderMode = computed(() => mode.value === 'reorder')
const canInteract = computed(() => !props.readonly && !props.disabled && !props.loading)
const canEnterReorder = computed(
  () => canInteract.value && !props.reorderDisabled && modelValue.value.length > 1,
)
const canAdd = computed(() => canInteract.value && props.showAddButton && !reorderMode.value)
// Chips mode keeps drag always-on (no mode toggle) on non-touch devices.
const dragEnabled = computed(
  () => (reorderMode.value || props.chips) && !isTouch.value && !props.disableDrag,
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
    !props.chips
    && props.showReorderToggle
    && !reorderMode.value
    && modelValue.value.length > 0,
)

// When there IS a title and viewport is narrow, the reorder button shrinks to an
// icon-only round button to keep the single-line header from overflowing.
const compactReorderButton = computed<boolean>(
  (): boolean => !!props.title && display.smAndDown.value,
)

const headerVisible = computed<boolean>(
  (): boolean =>
    !!(props.title || slots.header || slots['reorder-toggle'] || reorderToggleVisible.value),
)

const isInlineEdit = computed(() => !props.chips && !!slots.item)

const hasReadonlyDetail = computed(() => !props.chips && !!slots['item-readonly'])

// Per-row edit footer (Save + Cancel) is only meaningful if the consumer wants a
// per-item persist callback. Without it the expectation is that the parent form's
// global save flushes everything, so we hide the per-row buttons by default.
const showInlineSaveFooter = computed(() => !!props.onItemSave)

const snapshotKeyIndex = computed<Map<ListEditorKey, number>>(() => {
  const map = new Map<ListEditorKey, number>()
  if (!snapshot.value) return map
  snapshot.value.forEach((item, idx) => {
    map.set(item[props.keyField] as ListEditorKey, idx)
  })
  return map
})

const isItemDirty = (vi: ListViewItem<TItem>): boolean => {
  const baseline = dirtyBaseline.value.get(vi.key)
  if (baseline === undefined) return true
  return baseline !== JSON.stringify(vi.raw)
}

const viewItemsDecorated = computed<DecoratedViewItem<TItem>[]>(() => {
  const total = modelValue.value.length
  return editor.viewItems.value.map((vi) => {
    const initialIdx = snapshotKeyIndex.value.get(vi.key)
    const moved = initialIdx !== undefined && initialIdx !== vi.index
    const dirty = isItemDirty(vi)
    return {
      ...vi,
      editing: editingKeys.value.has(vi.key),
      expanded: expandedKeys.value.has(vi.key),
      loading: props.loadingKeys?.has(vi.key) ?? false,
      dirty,
      moved,
      unsaved: dirty || moved,
      canMoveUp: vi.index > 0,
      canMoveDown: vi.index < total - 1,
    }
  })
})

const isEmpty = computed(() => viewItemsDecorated.value.length === 0)

const movedCount = computed(() => viewItemsDecorated.value.filter((v) => v.moved).length)
const hasPendingChanges = computed(() => movedCount.value > 0)

const resolveCompactText = (raw: TItem, key: ListEditorKey): string => {
  const pick = (v: unknown): string | null =>
    v == null || v === '' ? null : String(v)
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

// Skip SortableJS entirely on touch devices — touch users reorder via arrows + menu,
// so the drag/drop library is never needed and there is no point paying its setup cost.
// The one-shot reads below are intentional: touch detection is fixed at setup time,
// and dragEnabled's initial value seeds SortableJS; later changes flow via the watch.
/* eslint-disable vue/no-ref-object-reactivity-loss */
if (!isTouch.value) {
  const sortable = useSortable(rowsContainer, modelValue, {
    handle: '.a-sortable-list-editor__drag-handle',
    animation: 150,
    ghostClass: 'a-sortable-list-editor__row--ghost',
    chosenClass: 'a-sortable-list-editor__row--chosen',
    dragClass: 'a-sortable-list-editor__row--drag',
    disabled: !dragEnabled.value,
    onEnd: () => {
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
  pendingAutoOpen.value = true
  emit('add', undefined)
}

const onRowAddAfterClick = (vi: ListViewItem<TItem>) => {
  if (!canInteract.value) return
  pendingAutoOpen.value = true
  emit('add', { afterId: vi.key })
}

const onEditClick = (vi: ListViewItem<TItem>) => {
  if (!canInteract.value || reorderMode.value) return
  if (isInlineEdit.value) {
    if (!editingSnapshots.value.has(vi.key)) {
      editingSnapshots.value.set(vi.key, cloneDeep(vi.raw) as TItem)
    }
    editingKeys.value.add(vi.key)
    expandedKeys.value.delete(vi.key)
  }
  emit('edit', vi)
}

const onExpandClick = (vi: ListViewItem<TItem>) => {
  if (props.disabled || props.loading || reorderMode.value) return
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
  if (reorderMode.value) return false
  if (vi.editing || vi.expanded) return true
  if (!props.readonly && props.showEditButton) return true
  if (props.readonly && hasReadonlyDetail.value) return true
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

const performDelete = async (vi: ListViewItem<TItem>): Promise<boolean> => {
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
  expandedKeys.value.delete(vi.key)
  emit('deleted', vi)
  return true
}

const onDeleteClick = async (vi: ListViewItem<TItem>) => {
  if (!canInteract.value) return
  if (props.disableDeleteConfirm || props.chips) {
    await performDelete(vi)
    return
  }
  deleteTarget.value = vi
  deleteError.value = null
  deleteDialog.value = true
}

const onDeleteDialogConfirm = async () => {
  if (!deleteTarget.value) return
  const ok = await performDelete(deleteTarget.value as ListViewItem<TItem>)
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

const onSaveClick = async (vi: ListViewItem<TItem>) => {
  if (props.onItemSave) {
    await props.onItemSave(vi.raw)
  }
  editingKeys.value.delete(vi.key)
  editingSnapshots.value.delete(vi.key)
  emit('item-saved', vi)
}

const onCancelClick = (vi: ListViewItem<TItem>) => {
  const snap = editingSnapshots.value.get(vi.key)
  if (snap) {
    editor.updateItem(vi.key, snap as TItem)
  }
  editingKeys.value.delete(vi.key)
  editingSnapshots.value.delete(vi.key)
}

const onCloseClick = (vi: ListViewItem<TItem>) => {
  editingKeys.value.delete(vi.key)
  editingSnapshots.value.delete(vi.key)
  expandedKeys.value.delete(vi.key)
  emit('close', vi)
}

const moveUp = (idx: number) => {
  if (idx <= 0) return
  editor.moveItem(idx, idx - 1)
}
const moveDown = (idx: number) => {
  if (idx >= modelValue.value.length - 1) return
  editor.moveItem(idx, idx + 1)
}
const moveTop = (idx: number) => {
  if (idx <= 0) return
  editor.moveItem(idx, 0)
}
const moveBottom = (idx: number) => {
  if (idx >= modelValue.value.length - 1) return
  editor.moveItem(idx, modelValue.value.length - 1)
}

const enterReorderMode = () => {
  if (!canEnterReorder.value || reorderMode.value) return
  editingKeys.value.clear()
  editingSnapshots.value.clear()
  expandedKeys.value.clear()
  snapshot.value = cloneDeep(modelValue.value)
  applyError.value = null
  mode.value = 'reorder'
  emit('reorder-start')
}

const cancelReorderMode = () => {
  if (!reorderMode.value) return
  if (snapshot.value) {
    modelValue.value = snapshot.value as TItem[]
  }
  snapshot.value = null
  applyError.value = null
  applying.value = false
  mode.value = 'view'
  emit('reorder-cancel')
  emit('reorder-end')
}

const applyReorder = async () => {
  if (!reorderMode.value) return
  const items = cloneDeep(modelValue.value)
  applyError.value = null
  if (props.onReorderApply) {
    applying.value = true
    try {
      await props.onReorderApply(items)
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
  emit('reorder-applied', items)
  emit('reorder-end')
}

// Ensure inline editors are closed when entering reorder mode externally (v-model:mode)
watch(mode, (newMode, oldMode) => {
  if (newMode === 'reorder' && oldMode !== 'reorder') {
    if (!snapshot.value) {
      snapshot.value = cloneDeep(modelValue.value)
    }
    editingKeys.value.clear()
    editingSnapshots.value.clear()
    expandedKeys.value.clear()
  }
  if (newMode === 'view' && oldMode === 'reorder' && snapshot.value) {
    snapshot.value = null
    applyError.value = null
    applying.value = false
  }
})

const buildSlotProps = (vi: DecoratedViewItem<TItem>) => ({
  item: { ...vi, validationState: resolveValidation(vi.raw as TItem) },
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
  actions: {
    edit: () => onEditClick(vi),
    save: () => onSaveClick(vi),
    cancel: () => onCancelClick(vi),
    close: () => onCloseClick(vi),
    delete: () => onDeleteClick(vi),
    addAfter: () => onRowAddAfterClick(vi),
    toggleExpand: () => onExpandClick(vi),
    moveUp: () => moveUp(vi.index),
    moveDown: () => moveDown(vi.index),
    moveTop: () => moveTop(vi.index),
    moveBottom: () => moveBottom(vi.index),
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

defineExpose({
  addItem: editor.addItem,
  deleteItem: editor.deleteItem,
  updateItem: editor.updateItem,
  moveItem: editor.moveItem,
  recalculatePositions: editor.recalculatePositions,
  viewItems: editor.viewItems,
  resetDirtyBaseline: captureDirtyBaseline,
  enterReorderMode,
  cancelReorderMode,
  applyReorder,
})
</script>

<template>
  <div
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
      },
    ]"
  >
    <div class="a-sortable-list-editor__card">
      <div
        v-if="headerVisible"
        class="a-sortable-list-editor__header"
      >
        <slot
          name="header"
          :title="title"
          v-bind="reorderToggleSlotProps"
        >
          <h3
            v-if="title"
            class="a-sortable-list-editor__title-heading"
          >
            {{ title }}
          </h3>
          <div class="a-sortable-list-editor__header-actions">
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
        class="a-sortable-list-editor__state a-sortable-list-editor__state--loading"
      >
        <VProgressCircular
          indeterminate
          color="primary"
          size="32"
        />
      </div>

      <div
        v-else-if="error"
        class="a-sortable-list-editor__state a-sortable-list-editor__state--error"
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
        class="a-sortable-list-editor__state a-sortable-list-editor__state--empty"
      >
        <slot
          name="empty"
          :readonly="readonly"
          :disabled="disabled"
          :actions="{ add: onAddClick }"
        >
          <div class="a-sortable-list-editor__empty">
            <h3 class="a-sortable-list-editor__empty-title">
              {{ emptyTitleResolved }}
            </h3>
            <p class="a-sortable-list-editor__empty-text">
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
        ref="rowsContainer"
        class="a-sortable-list-editor__rows"
      >
        <div
          v-for="vi in viewItemsDecorated"
          :key="String(vi.key)"
          class="a-sortable-list-editor__row"
          :class="{
            'a-sortable-list-editor__row--two-rows': twoRows === 'always',
            'a-sortable-list-editor__row--editing': vi.editing,
            'a-sortable-list-editor__row--expanded': vi.expanded,
            'a-sortable-list-editor__row--unsaved': vi.unsaved,
            'a-sortable-list-editor__row--reorder': reorderMode,
            'a-sortable-list-editor__row--clickable': isRowClickable(vi),
            [`a-sortable-list-editor__row--validation-${resolveValidation(vi.raw)}`]:
              resolveValidation(vi.raw) !== null,
          }"
        >
          <slot
            name="before-item"
            v-bind="buildSlotProps(vi)"
          />

          <div
            class="a-sortable-list-editor__row-header"
            @click="onRowClick(vi)"
          >
            <VIcon
              v-if="dragEnabled"
              icon="mdi-drag"
              size="20"
              class="a-sortable-list-editor__drag-handle"
            />

            <div class="a-sortable-list-editor__row-main">
              <slot
                name="item-compact"
                v-bind="buildSlotProps(vi)"
              >
                <span class="a-sortable-list-editor__title">
                  {{ resolveCompactText(vi.raw, vi.key) }}
                </span>
              </slot>
              <span
                v-if="vi.unsaved"
                class="a-sortable-list-editor__unsaved-label"
              >
                <VIcon
                  icon="mdi-circle-medium"
                  size="12"
                />
                {{ t('common.sortable.unsaved') }}
              </span>
            </div>

            <div
              v-if="!vi.editing && !vi.expanded && !reorderMode"
              class="a-sortable-list-editor__status"
            >
              <slot
                name="item-status"
                v-bind="buildSlotProps(vi)"
              >
                <span
                  v-if="statusField && vi.raw[statusField] != null && vi.raw[statusField] !== ''"
                  class="a-sortable-list-editor__status-badge"
                >
                  {{ vi.raw[statusField] }}
                </span>
              </slot>
            </div>

            <div class="a-sortable-list-editor__actions">
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
                  class="a-sortable-list-editor__action a-sortable-list-editor__action--chip-close"
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
                    class="a-sortable-list-editor__action a-sortable-list-editor__action--up"
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
                    class="a-sortable-list-editor__action a-sortable-list-editor__action--down"
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
                    class="a-sortable-list-editor__action a-sortable-list-editor__action--menu"
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
                <template v-else-if="vi.editing || vi.expanded">
                  <VBtn
                    v-if="vi.editing && showDeleteButton && canInteract"
                    icon
                    size="small"
                    variant="text"
                    density="comfortable"
                    class="a-sortable-list-editor__action a-sortable-list-editor__action--delete"
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
                    v-if="effectiveCloseVariant === 'icon'"
                    icon="mdi-close"
                    size="small"
                    variant="text"
                    :active="false"
                    class="a-sortable-list-editor__action a-sortable-list-editor__action--close"
                    @click.stop="onCloseClick(vi)"
                  >
                    <VIcon icon="mdi-close" />
                    <VTooltip
                      activator="parent"
                      location="bottom"
                      :text="t('common.sortable.close')"
                    />
                  </VBtn>
                  <VBtn
                    v-else
                    variant="text"
                    size="small"
                    rounded="pill"
                    prepend-icon="mdi-close"
                    :active="false"
                    class="a-sortable-list-editor__action a-sortable-list-editor__action--close"
                    @click.stop="onCloseClick(vi)"
                  >
                    {{ t('common.sortable.close') }}
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
                    class="a-sortable-list-editor__action a-sortable-list-editor__action--edit"
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
                    class="a-sortable-list-editor__action a-sortable-list-editor__action--delete"
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
                </template>
              </slot>
            </div>
          </div>

          <template v-if="vi.editing && !reorderMode && $slots.item">
            <div class="a-sortable-list-editor__row-body">
              <div
                v-if="$slots['item-status']"
                class="a-sortable-list-editor__body-status"
              >
                <slot
                  name="item-status"
                  v-bind="buildSlotProps(vi)"
                />
              </div>
              <slot
                name="item"
                v-bind="buildSlotProps(vi)"
              />
            </div>
            <slot
              name="item-footer"
              v-bind="buildSlotProps(vi)"
            >
              <div
                v-if="showInlineSaveFooter"
                class="a-sortable-list-editor__row-footer"
              >
                <div class="a-sortable-list-editor__row-footer-spacer" />
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
            v-else-if="vi.expanded && !reorderMode && $slots['item-readonly']"
            class="a-sortable-list-editor__row-body"
          >
            <div
              v-if="$slots['item-status']"
              class="a-sortable-list-editor__body-status"
            >
              <slot
                name="item-status"
                v-bind="buildSlotProps(vi)"
              />
            </div>
            <slot
              name="item-readonly"
              v-bind="buildSlotProps(vi)"
            />
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
          class="a-sortable-list-editor__row-add"
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
        class="a-sortable-list-editor__toolbar"
        :style="{ bottom: `${toolbarBottomOffset}px` }"
      >
        <div
          class="a-sortable-list-editor__toolbar-status"
          :class="{ 'a-sortable-list-editor__toolbar-status--pending': hasPendingChanges }"
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
        <div class="a-sortable-list-editor__toolbar-actions">
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

<style lang="scss" scoped>
.a-sortable-list-editor {
  --asle-border: rgb(0 0 0 / 12%);
  --asle-surface: rgb(var(--v-theme-surface, 255 255 255));
  --asle-surface-container: rgb(var(--v-theme-surface-variant, 245 245 245) / 25%);
  --asle-primary: rgb(var(--v-theme-primary, 63 106 216));
  --asle-primary-container: rgb(var(--v-theme-primary, 63 106 216) / 12%);
  --asle-primary-state: rgb(var(--v-theme-primary, 63 106 216) / 4%);
  --asle-primary-state-press: rgb(var(--v-theme-primary, 63 106 216) / 12%);
  --asle-success-container: rgb(var(--v-theme-success, 58 196 125) / 18%);
  --asle-warning-container: rgb(var(--v-theme-warning, 251 140 0) / 18%);
  --asle-error-container: rgb(var(--v-theme-error, 217 37 80) / 18%);
  --asle-on-surface: rgb(var(--v-theme-on-surface, 51 51 51));
  --asle-on-surface-variant: rgb(var(--v-theme-on-surface-variant, 102 102 102));
  --asle-radius: 12px;
  --asle-radius-full: 9999px;
  --asle-elev-1: 0 1px 2px rgb(0 0 0 / 12%), 0 1px 3px 1px rgb(0 0 0 / 6%);
  --asle-elev-3: 0 1px 3px rgb(0 0 0 / 16%), 0 4px 8px 3px rgb(0 0 0 / 10%);
  --asle-row-min-height: 48px;

  position: relative;
}

.a-sortable-list-editor--disabled,
.a-sortable-list-editor--readonly {
  opacity: 0.85;
}

.a-sortable-list-editor--disabled {
  pointer-events: none;
}

.a-sortable-list-editor__card {
  background: var(--asle-surface);
  border: 1px solid var(--asle-border);
  border-radius: var(--asle-radius);
  overflow: hidden;
  box-shadow: var(--asle-elev-1);
}

.a-sortable-list-editor__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 20px;
  border-bottom: 1px solid var(--asle-border);
  background: var(--asle-surface);
  height: 60px;
  flex-shrink: 0;
}

.a-sortable-list-editor__header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}

.a-sortable-list-editor__title-heading {
  font-weight: 500;
  font-size: 1rem;
  line-height: 1.4;
  color: var(--asle-on-surface);
  margin: 0;
}

.a-sortable-list-editor__state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
}

.a-sortable-list-editor__state--error {
  padding: 16px;
}

.a-sortable-list-editor__state--error :deep(.v-alert) {
  width: 100%;
}

.a-sortable-list-editor__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  padding: 16px;
}

.a-sortable-list-editor__empty-title {
  font-size: 1rem;
  font-weight: 500;
  margin: 0;
  color: var(--asle-on-surface);
}

.a-sortable-list-editor__empty-text {
  font-size: 0.875rem;
  color: var(--asle-on-surface-variant);
  margin: 0 0 12px;
}

.a-sortable-list-editor__rows {
  display: flex;
  flex-direction: column;
}

.a-sortable-list-editor__row {
  position: relative;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--asle-border);
  background: var(--asle-surface);
  transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.a-sortable-list-editor__row:last-of-type {
  border-bottom: none;
}

.a-sortable-list-editor__row-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  min-height: var(--asle-row-min-height);
  flex-shrink: 0;
  position: relative;
}

.a-sortable-list-editor__row--clickable .a-sortable-list-editor__row-header {
  cursor: pointer;
}

.a-sortable-list-editor__row--clickable:not(
    .a-sortable-list-editor__row--editing,
    .a-sortable-list-editor__row--expanded
  ):hover
  .a-sortable-list-editor__row-header {
  background: var(--asle-primary-state);
}

.a-sortable-list-editor__row--clickable:not(
    .a-sortable-list-editor__row--editing,
    .a-sortable-list-editor__row--expanded
  ):active
  .a-sortable-list-editor__row-header {
  background: var(--asle-primary-state-press);
}

.a-sortable-list-editor__row--editing,
.a-sortable-list-editor__row--expanded {
  background: var(--asle-primary-container);
}

.a-sortable-list-editor__row--editing::before,
.a-sortable-list-editor__row--expanded::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--asle-primary);
  z-index: 1;
}

.a-sortable-list-editor__row--unsaved {
  background: var(--asle-warning-container);
}

.a-sortable-list-editor__row--unsaved::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: rgb(var(--v-theme-warning, 251 140 0));
  z-index: 2;
}

.a-sortable-list-editor__row--reorder .a-sortable-list-editor__row-header {
  padding: 0 12px;
  gap: 8px;
}

.a-sortable-list-editor__row--two-rows:not(
    .a-sortable-list-editor__row--editing,
    .a-sortable-list-editor__row--expanded
  )
  .a-sortable-list-editor__row-header {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: 'title title' 'status actions';
  align-items: center;
  gap: 4px 8px;
  padding: 10px 16px;
  min-height: auto;
}

.a-sortable-list-editor__row--two-rows .a-sortable-list-editor__row-main {
  grid-area: title;
  min-width: 0;
}

.a-sortable-list-editor__row--two-rows .a-sortable-list-editor__row-main .a-sortable-list-editor__title {
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.35;
  font-weight: 500;
}

.a-sortable-list-editor__row--two-rows .a-sortable-list-editor__status {
  grid-area: status;
}

.a-sortable-list-editor__row--two-rows .a-sortable-list-editor__actions {
  grid-area: actions;
  margin-left: 0;
}

/* stylelint-disable selector-max-compound-selectors */
.a-sortable-list-editor__row--validation-invalid::after,
.a-sortable-list-editor__row--validation-warning::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}

.a-sortable-list-editor__row--validation-invalid:not(
    .a-sortable-list-editor__row--editing,
    .a-sortable-list-editor__row--unsaved
  )::after {
  background: rgb(var(--v-theme-error, 217 37 80));
}

.a-sortable-list-editor__row--validation-warning:not(
    .a-sortable-list-editor__row--editing,
    .a-sortable-list-editor__row--unsaved
  )::after {
  background: rgb(var(--v-theme-warning, 251 140 0));
}
/* stylelint-enable selector-max-compound-selectors */

.a-sortable-list-editor__row-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.a-sortable-list-editor__row-body {
  padding: 12px 16px 8px;
}

.a-sortable-list-editor__body-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.a-sortable-list-editor__row-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 16px 16px;
  background: transparent;
  border-top: none;
}

.a-sortable-list-editor__row-footer-spacer {
  flex: 1 1 auto;
}

.a-sortable-list-editor__title {
  flex: 1 1 auto;
  font-size: 0.92rem;
  font-weight: 400;
  letter-spacing: 0.01em;
  color: var(--asle-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.a-sortable-list-editor__row--editing .a-sortable-list-editor__row-main,
.a-sortable-list-editor__row--expanded .a-sortable-list-editor__row-main {
  font-weight: 700;
  color: var(--asle-primary);
}

.a-sortable-list-editor__unsaved-label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.7rem;
  color: rgb(var(--v-theme-warning, 251 140 0));
  font-weight: 500;
  background: transparent;
  border: 1px solid rgb(var(--v-theme-warning, 251 140 0));
  padding: 2px 8px;
  border-radius: var(--asle-radius-full);
  white-space: nowrap;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.a-sortable-list-editor__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.a-sortable-list-editor__status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  padding: 3px 10px;
  border-radius: var(--asle-radius-full);
  background: var(--asle-success-container);
  color: var(--asle-on-surface);
  font-weight: 500;
  letter-spacing: 0.02em;
  white-space: nowrap;
  flex-shrink: 0;
}

.a-sortable-list-editor__actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 0;
}

@media (width >= 960px) {
  .a-sortable-list-editor__row:not(.a-sortable-list-editor__row--reorder)
    .a-sortable-list-editor__actions {
    margin-left: 24px;
  }
}

.a-sortable-list-editor__action--edit,
.a-sortable-list-editor__action--delete,
.a-sortable-list-editor__action--up,
.a-sortable-list-editor__action--down {
  opacity: 0;
  transition: opacity 0.15s;
}

.a-sortable-list-editor__row:hover .a-sortable-list-editor__action--edit,
.a-sortable-list-editor__row:hover .a-sortable-list-editor__action--delete,
.a-sortable-list-editor__row:hover .a-sortable-list-editor__action--up,
.a-sortable-list-editor__row:hover .a-sortable-list-editor__action--down,
.a-sortable-list-editor__row:focus-within .a-sortable-list-editor__action--edit,
.a-sortable-list-editor__row:focus-within .a-sortable-list-editor__action--delete,
.a-sortable-list-editor__row:focus-within .a-sortable-list-editor__action--up,
.a-sortable-list-editor__row:focus-within .a-sortable-list-editor__action--down {
  opacity: 1;
}

.a-sortable-list-editor--touch .a-sortable-list-editor__action--edit,
.a-sortable-list-editor--touch .a-sortable-list-editor__action--delete,
.a-sortable-list-editor--touch .a-sortable-list-editor__action--up,
.a-sortable-list-editor--touch .a-sortable-list-editor__action--down {
  opacity: 1;
}

/* Disabled reorder arrows: when the row is hovered/focused (or on touch where
   they are always visible), render them clearly muted — but still hidden when the
   row is idle on non-touch devices, matching the enabled arrow's hover-reveal. */
.a-sortable-list-editor__row:hover .a-sortable-list-editor__action--up.v-btn--disabled,
.a-sortable-list-editor__row:hover .a-sortable-list-editor__action--down.v-btn--disabled,
.a-sortable-list-editor__row:focus-within .a-sortable-list-editor__action--up.v-btn--disabled,
.a-sortable-list-editor__row:focus-within .a-sortable-list-editor__action--down.v-btn--disabled,
.a-sortable-list-editor--touch .a-sortable-list-editor__action--up.v-btn--disabled,
.a-sortable-list-editor--touch .a-sortable-list-editor__action--down.v-btn--disabled {
  opacity: 0.3;
}

.a-sortable-list-editor__drag-handle {
  cursor: grab;
  flex-shrink: 0;
  padding: 4px 0;
}

.a-sortable-list-editor__drag-handle:active {
  cursor: grabbing;
}

.a-sortable-list-editor__row--ghost {
  opacity: 0.4;
}

.a-sortable-list-editor__row--chosen {
  background: var(--asle-primary-state);
}

.a-sortable-list-editor__row--drag {
  box-shadow: var(--asle-elev-3);
  background: var(--asle-surface);
}

.a-sortable-list-editor__row-add {
  width: 100%;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--asle-primary);
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  border-top: 1px solid var(--asle-border);
  background: var(--asle-surface-container);
  letter-spacing: 0.02em;
  transition: background-color 0.15s;
  text-align: left;
  font-family: inherit;
}

.a-sortable-list-editor__row-add:hover {
  background: var(--asle-primary-container);
}

.a-sortable-list-editor__row-add:focus-visible {
  outline: 2px solid var(--asle-primary);
  outline-offset: -2px;
}

.a-sortable-list-editor__toolbar {
  position: sticky;
  z-index: 5;
  margin-top: 12px;
  padding: 12px 16px;
  background: var(--asle-surface);
  border: 1px solid var(--asle-border);
  border-radius: 16px;
  box-shadow: var(--asle-elev-3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.a-sortable-list-editor__toolbar-status {
  font-size: 0.9rem;
  color: var(--asle-on-surface);
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.a-sortable-list-editor__toolbar-status--pending {
  color: rgb(var(--v-theme-warning, 251 140 0));
}

.a-sortable-list-editor__toolbar-actions {
  display: inline-flex;
  gap: 8px;
  flex-shrink: 0;
}

@media (width <= 600px) {
  .a-sortable-list-editor--two-rows-mobile
    .a-sortable-list-editor__row:not(
      .a-sortable-list-editor__row--editing,
      .a-sortable-list-editor__row--expanded
    )
    .a-sortable-list-editor__row-header {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas: 'title title' 'status actions';
    align-items: center;
    gap: 4px 8px;
    padding: 10px 16px;
    min-height: auto;
  }

  .a-sortable-list-editor--two-rows-mobile .a-sortable-list-editor__row-main {
    grid-area: title;
    min-width: 0;
  }

  .a-sortable-list-editor--two-rows-mobile
    .a-sortable-list-editor__row-main
    .a-sortable-list-editor__title {
    white-space: normal;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.35;
    font-weight: 500;
  }

  .a-sortable-list-editor--two-rows-mobile .a-sortable-list-editor__status {
    grid-area: status;
  }

  .a-sortable-list-editor--two-rows-mobile .a-sortable-list-editor__actions {
    grid-area: actions;
    margin-left: 0;
  }
}

@media (hover: none) {
  .a-sortable-list-editor__action--edit,
  .a-sortable-list-editor__action--delete,
  .a-sortable-list-editor__action--up,
  .a-sortable-list-editor__action--down {
    opacity: 1;
  }
}

/* Chips layout — flat inline-flex pills, drag always on (non-touch), close-X always visible. */
.a-sortable-list-editor--chips .a-sortable-list-editor__card {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  border-radius: var(--asle-radius);
  box-shadow: none;
}

.a-sortable-list-editor--chips .a-sortable-list-editor__header {
  flex: 1 1 100%;
  padding: 4px 8px 8px;
  border-bottom: none;
  min-height: auto;
}

.a-sortable-list-editor--chips .a-sortable-list-editor__rows {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1 1 100%;
}

.a-sortable-list-editor--chips .a-sortable-list-editor__row {
  border-bottom: none;
  background: var(--asle-primary-container);
  border-radius: var(--asle-radius-full);
  flex: 0 0 auto;
  max-width: 100%;
}

.a-sortable-list-editor--chips .a-sortable-list-editor__row-header {
  padding: 2px 4px 2px 8px;
  gap: 4px;
  min-height: 28px;
}

.a-sortable-list-editor--chips .a-sortable-list-editor__row-main {
  gap: 6px;
}

.a-sortable-list-editor--chips .a-sortable-list-editor__title {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--asle-primary);
}

.a-sortable-list-editor--chips .a-sortable-list-editor__drag-handle {
  padding: 0;
  font-size: 16px;
}

.a-sortable-list-editor--chips .a-sortable-list-editor__action--chip-close {
  opacity: 0.7;
  transition: opacity 0.15s;
}

.a-sortable-list-editor--chips .a-sortable-list-editor__action--chip-close:hover {
  opacity: 1;
}

.a-sortable-list-editor--chips .a-sortable-list-editor__row-add {
  flex: 0 0 auto;
  width: auto;
  border-top: none;
  border: 1px dashed var(--asle-border);
  border-radius: var(--asle-radius-full);
  padding: 4px 12px;
  font-size: 0.82rem;
  background: transparent;
}

.a-sortable-list-editor--chips .a-sortable-list-editor__row-add:hover {
  background: var(--asle-primary-state);
}
</style>
