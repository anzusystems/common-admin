<script setup lang="ts" generic="TItem extends Record<string, any>">
import { computed, provide, ref, useSlots, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { useKeyboardNav } from '@/labs/listEditor/composables/useKeyboardNav'
import { useValidationRegistry } from '@/labs/listEditor/composables/useValidationRegistry'
import { ListEditorUnsavedKeysKey } from '@/labs/listEditor/composables/useListEditorItemValidation'
import { useListEditor } from '@/labs/listEditor/composables/useListEditor'
import { resolveCompactText as resolveCompactTextUtil } from '@/labs/listEditor/composables/resolveCompactText'
import { useUnsavedKeysSync } from '@/labs/listEditor/composables/useUnsavedKeysSync'
import { useUnsavedSection } from '@/labs/unsavedGuard/useUnsavedSection'
import { useDirtyBaseline } from '@/labs/listEditor/composables/useDirtyBaseline'
import { useDeleteDialog } from '@/labs/listEditor/composables/useDeleteDialog'
import { useInlineEditing } from '@/labs/listEditor/composables/useInlineEditing'
import LeDeleteDialog from '@/labs/listEditor/internal/LeDeleteDialog.vue'
import LeEmptyState from '@/labs/listEditor/internal/LeEmptyState.vue'
import LeUnsavedLabel from '@/labs/listEditor/internal/LeUnsavedLabel.vue'
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
}

// Hoisted for vite-plugin-dts d.ts rollup.
export interface RowActions<TItem> {
  edit: () => void
  save: () => Promise<void> | void
  cancel: () => void
  close: () => void
  delete: () => Promise<void>
  addAfter: () => void
  toggleExpand: () => void
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
  /** Aliases `dirty` here (no reorder mode → no `moved` to OR). Same field name as on sortable/nested variants. */
  unsaved: boolean
  touch: boolean
  actions: RowActions<TItem>
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
export interface HeaderSlotProps {
  title: string | null
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

  disableRowClick?: boolean
  disableDeleteConfirm?: boolean
  /** Disable unsaved-state tracking — no dirty markers, never feeds `unsaved-keys`. */
  disableUnsaved?: boolean
  deleteConfirmTitle?: string | null
  deleteConfirmText?: string | null

  closeVariant?: 'auto' | 'icon' | 'labeled'

  /**
   * Render every row's `#item` slot expanded by default — no edit pencil, no
   * inline Save/Cancel footer, no row-click toggle. Use when the editor has
   * no reorder affordance and the consumer wants all forms visible at once
   * (e.g. ThirdPartyTracker, bookmarks dialog).
   */
  defaultExpanded?: boolean

  loadingKeys?: Set<ListEditorKey> | null

  getValidationState?: (item: TItem, key: ListEditorKey, index: number) => ListEditorValidationState

  onDeleteConfirm?: (item: TItem) => Promise<boolean> | boolean
  onDelete?: (item: TItem) => Promise<void> | void
  onItemSave?: (item: TItem) => Promise<void> | void

  /**
   * Editor-managed add: the add button and "add after this item" insert
   * `itemFactory()` into the model directly (positions renumbered when
   * `update-position` is on) and emit `added` — the `add` event does NOT fire,
   * so no consumer push handler is needed.
   */
  itemFactory?: () => TItem
  /**
   * Editor-managed delete: a confirmed delete removes the row from the model
   * itself. `deleted` still fires as a notification — consumers keep side
   * effects but must not splice the model themselves.
   */
  manageDelete?: boolean
  /**
   * Registers this editor as a named unsaved-changes section under the given
   * (already translated) label — replaces the per-consumer `useUnsavedSection`
   * call for the common one-editor case.
   */
  unsavedSectionLabel?: string
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
  disableRowClick: false,
  disableDeleteConfirm: false,
  disableUnsaved: false,
  deleteConfirmTitle: null,
  deleteConfirmText: null,
  closeVariant: 'auto',
  defaultExpanded: false,
  loadingKeys: null,
  getValidationState: undefined,
  onDeleteConfirm: undefined,
  onDelete: undefined,
  onItemSave: undefined,
  itemFactory: undefined,
  manageDelete: false,
  unsavedSectionLabel: undefined,
})

const emit = defineEmits<{
  add: [positionHint: PositionHint | undefined]
  added: [payload: { item: TItem; index: number }]
  edit: [item: ListViewItem<TItem>]
  deleted: [item: ListViewItem<TItem>]
  close: [item: ListViewItem<TItem>]
  'item-saved': [item: ListViewItem<TItem>]
  'item-expand': [item: ListViewItem<TItem>, expanded: boolean]
}>()

defineSlots<{
  header?: (props: HeaderSlotProps) => unknown
  empty?: (props: EmptySlotProps) => unknown
  'add-button'?: (props: AddButtonSlotProps) => unknown
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

const { t } = useI18n()
const slots = useSlots()
const display = useDisplay()

const rootEl = useTemplateRef<HTMLElement>('rootEl')

const isTouch = computed<boolean>(() => display.platform.value.touch)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const editor = useListEditor<TItem>(modelValue, {
  keyField: props.keyField,
  positionField: props.positionField,
  positionMultiplier: props.positionMultiplier,
  updatePosition: props.updatePosition,
})

const expandedKeys = ref<Set<ListEditorKey>>(new Set())

const rowsContainer = useTemplateRef<HTMLElement>('rowsContainer')

const isInlineEdit = computed(() => !props.chips && !!slots.item)
const hasReadonlyDetail = computed(() => !props.chips && !!slots['item-readonly'])

// Initial snapshot of each item, keyed by row key. Compared against current data to
// detect "dirty" (unsaved) rows. Reset externally after a successful parent-form save.
const { captureDirtyBaseline, rebaselineKey, isItemDirty, ignoreNextSourceChange } =
  useDirtyBaseline<TItem>(
  () =>
    modelValue.value.map((item) => ({
      key: item[props.keyField] as ListEditorKey,
      data: item,
    })),
  { source: modelValue },
)

const {
  editingKeys,
  editingSnapshots,
  beginEdit,
  cancelEdit,
  commitEdit,
  closeEdit,
  requestAutoOpen,
  clearEditing,
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

const addLabelResolved = computed(() =>
  props.addLabel ? t(props.addLabel) : t('common.sortable.add'),
)
const emptyTitleResolved = computed(() => props.emptyTitle ?? t('common.sortable.emptyTitle'))
const deleteConfirmTitleResolved = computed(
  () => props.deleteConfirmTitle ?? t('common.sortable.deleteConfirmTitle'),
)
const deleteConfirmTextResolved = computed(
  () => props.deleteConfirmText ?? t('common.sortable.deleteConfirmText'),
)

const canInteract = computed(() => !props.readonly && !props.disabled && !props.loading)
const canAdd = computed(() => canInteract.value && props.showAddButton)

const headerVisible = computed(() => !!(props.title || slots.header))

// Per-row edit footer (Save + Cancel) is only meaningful if the consumer wants a
// per-item persist callback. Without it the expectation is that the parent form's
// global save flushes everything, so we hide the per-row buttons by default.
const showInlineSaveFooter = computed(() => !!props.onItemSave)

// Decoupled dirty pass: depends only on modelValue (via stringifyContent
// reading nested fields) and dirtyBaseline. Editing/expanded/loading flag
// changes do NOT re-trigger this — viewItemsDecorated reads dirtyKeys.has()
// instead of calling isItemDirty inline, so we avoid stringifying every
// row whenever the user clicks edit on one row.
const dirtyKeys = computed<Set<ListEditorKey>>(() => {
  const out = new Set<ListEditorKey>()
  for (const item of modelValue.value) {
    const key = item[props.keyField] as ListEditorKey
    if (isItemDirty(key, item)) out.add(key)
  }
  return out
})

// Per-key decorator cache: we reuse the cached object when its base view item
// AND every flag matches, giving slot consumers a stable reference for rows
// whose state didn't change. Saves allocation on every render where only one
// row's flag flipped.
const decoratorCache = new Map<ListEditorKey, DecoratedViewItem<TItem>>()
const viewItemsDecorated = computed<DecoratedViewItem<TItem>[]>(() => {
  const next: DecoratedViewItem<TItem>[] = []
  const liveKeys = new Set<ListEditorKey>()
  for (const vi of editor.viewItems.value) {
    liveKeys.add(vi.key)
    const editing = editingKeys.value.has(vi.key)
    const expanded = expandedKeys.value.has(vi.key)
    const loading = props.loadingKeys?.has(vi.key) ?? false
    const dirty = props.disableUnsaved ? false : dirtyKeys.value.has(vi.key)
    const cached = decoratorCache.get(vi.key)
    if (
      cached &&
      cached.raw === vi.raw &&
      cached.index === vi.index &&
      cached.position === vi.position &&
      cached.editing === editing &&
      cached.expanded === expanded &&
      cached.loading === loading &&
      cached.dirty === dirty
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
  variant: 'flat',
  isReorderMode: ref(false),
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
})

const resolveCompactText = (raw: TItem): string =>
  resolveCompactTextUtil(raw, { compactField: props.compactField })

const { resolveValidation } = useValidationRegistry<TItem>({
  getValidationState: (item, key, index) => props.getValidationState?.(item, key, index) ?? null,
})

// Managed add (itemFactory): the editor inserts the item itself; finalize
// renumbers positions when update-position is on, possibly replacing the
// inserted object — locate it by key and emit the finalized one.
const addViaFactory = (positionHint?: PositionHint): void => {
  const item = props.itemFactory!()
  // The editor writes the model by reassignment; without this, the dirty
  // baseline's initial-fill watch would treat the FIRST add into an
  // empty-at-mount list as async data landing and baseline it (the new row
  // would never read as unsaved/invalid).
  ignoreNextSourceChange()
  const result = editor.addItem(item, positionHint)
  const index = result.findIndex(
    (x) => (x[props.keyField] as ListEditorKey) === (item[props.keyField] as ListEditorKey),
  )
  emit('added', { item: (index === -1 ? item : result[index]) as TItem, index })
}

const onAddClick = () => {
  if (!canAdd.value) return
  requestAutoOpen()
  if (props.itemFactory) {
    addViaFactory()
    return
  }
  emit('add', undefined)
}

const onRowAddAfterClick = (vi: ListViewItem<TItem>) => {
  if (!canInteract.value) return
  requestAutoOpen()
  if (props.itemFactory) {
    addViaFactory({ afterId: vi.key })
    return
  }
  emit('add', { afterId: vi.key })
}

const onEditClick = (vi: ListViewItem<TItem>) => {
  if (!canInteract.value) return
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
  if (props.defaultExpanded) return false
  if (props.disabled || props.loading) return false
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
    if (props.manageDelete) {
      ignoreNextSourceChange()
      editor.deleteItem(vi.key)
    }
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

// Per-key actions cache: each row's `actions` bundle is allocated once and
// reused on every render. Slot consumers receive a stable identity for
// `actions.update` etc., so they don't see prop-ref churn that would
// trigger spurious re-renders. Closures capture the row key (stable) and
// look up the current decorator via `findVi(key)` on call.
type ActionsBundle = {
  edit: () => void
  save: () => Promise<void> | void
  cancel: () => void
  close: () => void
  delete: () => Promise<void>
  addAfter: () => void
  toggleExpand: () => void
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
      update: (data: TItem) => editor.updateItem(key, data),
    }
    actionsCache.set(key, actions)
  }
  return actions
}
// Garbage-collect cache entries for keys that have left the model.
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
  editing: vi.editing || props.defaultExpanded,
  dirty: vi.dirty,
  unsaved: vi.dirty,
  touch: isTouch.value,
  actions: getActions(vi.key),
})

const unsavedKeysModel = defineModel<Set<ListEditorKey>>('unsavedKeys', {
  default: () => new Set<ListEditorKey>(),
})

const internalUnsavedKeys = computed<Set<ListEditorKey>>(() => {
  const out = new Set<ListEditorKey>()
  for (const vi of viewItemsDecorated.value) {
    if (vi.dirty) out.add(vi.key)
  }
  return out
})
// Let row validity sentinels surface 'invalid' as soon as their row is unsaved.
// Includes each unsaved row's id/position too, so the lookup matches whatever
// key the sentinel registers under (which may differ from the editor's key-field).
const unsavedValidationKeys = computed<Set<ListEditorKey>>(() => {
  const out = new Set<ListEditorKey>()
  for (const vi of viewItemsDecorated.value) {
    if (!vi.dirty) continue
    out.add(vi.key)
    const raw = vi.raw as Record<string, any>
    if (raw.id !== undefined && raw.id !== null) out.add(raw.id)
    if (raw.position !== undefined && raw.position !== null) out.add(raw.position)
  }
  return out
})
provide(ListEditorUnsavedKeysKey, unsavedValidationKeys)

const { hasUnsavedChanges, unsavedCount, clearUnsavedState } = useUnsavedKeysSync({
  unsavedKeysModel,
  internalUnsavedKeys,
  onClearAll: () => {
    captureDirtyBaseline()
    // Collapse open inline-edit forms once the parent persisted — the rows are
    // saved, so leaving them in edit mode would be stale.
    clearEditing()
  },
  onClearKey: (key) => rebaselineKey(key),
})

// Registers this editor as a named unsaved-changes section when the consumer
// passes a label — replaces the per-consumer useUnsavedSection boilerplate.
useUnsavedSection(() =>
  props.unsavedSectionLabel
    ? { label: props.unsavedSectionLabel, dirty: unsavedCount.value > 0 }
    : [],
)

defineExpose({
  addItem: editor.addItem,
  deleteItem: editor.deleteItem,
  updateItem: editor.updateItem,
  moveItem: editor.moveItem,
  recalculatePositions: editor.recalculatePositions,
  viewItems: editor.viewItems,
  resetDirtyBaseline: captureDirtyBaseline,
  hasUnsavedChanges,
  unsavedCount,
  clearUnsavedState,
})
</script>

<template>
  <div
    ref="rootEl"
    class="a-list-editor"
    :class="[
      `a-list-editor--two-rows-${twoRows}`,
      {
        'a-list-editor--readonly': readonly,
        'a-list-editor--disabled': disabled,
        'a-list-editor--touch': isTouch,
        'a-list-editor--chips': chips,
      },
    ]"
  >
    <div
      ref="rowsContainer"
      class="a-le-card"
    >
      <div
        v-if="headerVisible"
        class="a-le-header"
      >
        <slot
          name="header"
          :title="title"
        >
          <h3
            v-if="title"
            class="a-le-title-heading"
          >
            {{ title }}
          </h3>
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

      <template v-else>
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
            'a-le-row--unsaved': vi.dirty,
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
            <div class="a-le-row-main">
              <slot
                name="item-compact"
                v-bind="buildSlotProps(vi)"
              >
                <span class="a-le-title">
                  {{ resolveCompactText(vi.raw) }}
                </span>
              </slot>
              <LeUnsavedLabel
                v-if="vi.dirty"
                :dot-only="chips"
              />
            </div>

            <div
              v-if="!chips"
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
                <template v-else>
                  <VBtn
                    v-if="showEditButton && canInteract && !defaultExpanded"
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
                        <VListItem @click="onRowAddAfterClick(vi)">
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

          <template v-if="(vi.editing || defaultExpanded) && $slots.item">
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
                v-if="showInlineSaveFooter && !defaultExpanded"
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
            v-else-if="$slots['item-readonly'] && (readonly || vi.expanded)"
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
      </template>

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

// Variant-specific rules, scoped under the AListEditor root.
.a-list-editor {
  // Chips — row-header padding (12 px left for the flat variant vs 8 px in
  // sortable, which reserves room for the drag handle).
  &--chips .a-le-row-header {
    padding: 2px 4px 2px 12px;
    gap: 4px;
    min-height: 28px;
  }
}

// Narrow-container / mobile layout — taller rows, always-visible actions,
// status badge dropped to make room.
/* stylelint-disable selector-max-compound-selectors */
@container le-shell (max-width: 768px) {
  .a-list-editor {
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
