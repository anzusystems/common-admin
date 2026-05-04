<script setup lang="ts" generic="TItem extends Record<string, any>">
import { computed, ref, shallowRef, useSlots, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { useSortable } from '@vueuse/integrations/useSortable'
import { useListEditor } from '@/labs/listEditor/composables/useListEditor'
import { useDirtyBaseline } from '@/labs/listEditor/composables/useDirtyBaseline'
import { useDeleteDialog } from '@/labs/listEditor/composables/useDeleteDialog'
import { useInlineEditing } from '@/labs/listEditor/composables/useInlineEditing'
import { useReorderMode } from '@/labs/listEditor/composables/useReorderMode'
import LeDeleteDialog from '@/labs/listEditor/internal/LeDeleteDialog.vue'
import LeEmptyState from '@/labs/listEditor/internal/LeEmptyState.vue'
import LeStatus from '@/labs/listEditor/internal/LeStatus.vue'
import LeUnsavedLabel from '@/labs/listEditor/internal/LeUnsavedLabel.vue'
import LeDragHandle from '@/labs/listEditor/internal/LeDragHandle.vue'
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

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const editor = useListEditor<TItem>(modelValue, {
  keyField: props.keyField,
  positionField: props.positionField,
  positionMultiplier: props.positionMultiplier,
  updatePosition: props.updatePosition,
})

const expandedKeys = ref<Set<ListEditorKey>>(new Set())

// Initial snapshot of each item, keyed by row key. Compared against current data to
// detect "dirty" (unsaved) rows. Reset externally after a successful parent-form save.
// `position` is deliberately stripped out: drag-drop rewrites it on every row
// whose flat index shifts as a side-effect, and flagging those unmoved rows
// as dirty would paint ghost "unsaved" markers. The per-row visual cue is
// what matters; position data still flows to the parent on apply.
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { captureDirtyBaseline, isItemDirty } = useDirtyBaseline<TItem>(
  () =>
    modelValue.value.map((item) => ({
      key: item[props.keyField] as ListEditorKey,
      data: item,
    })),
  { excludeFields: [props.positionField] },
)

// Keys the user has actively moved during this reorder session. Clearing
// this set is part of "mark current data as saved" — paired with
// captureDirtyBaseline in the exposed resetDirtyBaseline so the orange
// badges go away when consumers confirm a server save.
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
  () => canInteract.value && !props.reorderDisabled && modelValue.value.length > 1,
)

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
  onEnter: () => {
    clearEditing()
    expandedKeys.value.clear()
  },
  onExternalEnter: () => {
    clearEditing()
    expandedKeys.value.clear()
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
    !props.chips && props.showReorderToggle && !reorderMode.value && modelValue.value.length > 0,
)

// When there IS a title and viewport is narrow, the reorder button shrinks to an
// icon-only round button to keep the single-line header from overflowing.
const compactReorderButton = computed<boolean>(
  (): boolean => !!props.title && display.smAndDown.value,
)

const headerVisible = computed<boolean>(
  (): boolean =>
    !!(
      props.title ||
      slots.header ||
      slots['reorder-toggle'] ||
      reorderToggleVisible.value ||
      reorderMode.value
    ),
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

const viewItemsDecorated = computed<DecoratedViewItem<TItem>[]>(() => {
  const total = modelValue.value.length
  return editor.viewItems.value.map((vi) => {
    const moved = movedKeys.value.has(vi.key)
    const dirty = isItemDirty(vi.key, vi.raw)
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

// Skip SortableJS entirely on touch devices — touch users reorder via arrows + menu,
// so the drag/drop library is never needed and there is no point paying its setup cost.
// The one-shot reads below are intentional: touch detection is fixed at setup time,
// and dragEnabled's initial value seeds SortableJS; later changes flow via the watch.
/* eslint-disable vue/no-ref-object-reactivity-loss */
if (!isTouch.value) {
  const sortable = useSortable(rowsContainer, modelValue, {
    handle: '.a-le-drag-handle',
    animation: 150,
    // Force the fallback renderer so `dragClass` is applied to a CSS-controlled
    // clone that follows the cursor — gives us a custom, row-shaped ghost
    // instead of the opaque browser-native drag bitmap.
    forceFallback: true,
    fallbackTolerance: 3,
    fallbackOnBody: true,
    ghostClass: 'a-le-row--ghost',
    chosenClass: 'a-le-row--chosen',
    dragClass: 'a-le-row--drag',
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
  if (!canInteract.value || reorderMode.value) return
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
    editor.deleteItem(vi.key)
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
  resetDirtyBaseline,
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
              <!-- Reorder-mode header: pending-changes count + Cancel/Apply.
                   Replaces the old sticky bottom toolbar — the actions sit
                   where the "Reorder" button lives in view mode. -->
              <slot
                name="reorder-toolbar"
                v-bind="toolbarSlotProps"
              >
                <LeStatus
                  :class="{ 'a-le-toolbar-status--pending': hasPendingChanges }"
                  :has-pending-changes="hasPendingChanges"
                  :pending-count="movedCount"
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
                  :disabled="applying || !hasPendingChanges"
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
          class="a-le-row"
          :class="{
            'a-le-row--two-rows': twoRows === 'always',
            'a-le-row--editing': vi.editing,
            'a-le-row--expanded': vi.expanded,
            'a-le-row--unsaved': vi.unsaved,
            'a-le-row--reorder': reorderMode,
            'a-le-row--clickable': isRowClickable(vi),
            [`a-le-row--validation-${resolveValidation(vi.raw)}`]:
              resolveValidation(vi.raw) !== null,
          }"
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

          <template v-if="vi.editing && !reorderMode && $slots.item">
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
                v-if="showInlineSaveFooter"
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
            v-else-if="vi.expanded && !reorderMode && $slots['item-readonly']"
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

  // Reorder-mode trims the row-header padding since the drag handle already
  // eats some of the horizontal rhythm.
  .a-le-row--reorder .a-le-row-header {
    padding-left: 12px;
    padding-right: 8px;
    gap: 8px;
  }

  // Validation rail — excludes both `--editing` and `--unsaved` so the
  // primary + warning rails (higher priority states) aren't overwritten by
  // a validation-error stripe.
  /* stylelint-disable selector-max-compound-selectors */
  .a-le-row--validation-invalid::after,
  .a-le-row--validation-warning::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
  }

  .a-le-row--validation-invalid:not(.a-le-row--editing, .a-le-row--unsaved)::after {
    background: var(--le-error-fg);
  }

  .a-le-row--validation-warning:not(.a-le-row--editing, .a-le-row--unsaved)::after {
    background: var(--le-warning);
  }
  /* stylelint-enable selector-max-compound-selectors */

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
    .a-le-row .a-le-action--menu {
      opacity: 1;
    }
  }
}
/* stylelint-enable selector-max-compound-selectors */
</style>
