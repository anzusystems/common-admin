<script setup lang="ts" generic="TItem extends Record<string, any>">
import { computed, ref, useSlots, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
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

  onDeleteConfirm?: (item: TItem) => Promise<boolean> | boolean
  onDelete?: (item: TItem) => Promise<void> | void
  onItemSave?: (item: TItem) => Promise<void> | void
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
  onDeleteConfirm: undefined,
  onDelete: undefined,
  onItemSave: undefined,
})

const emit = defineEmits<{
  add: [positionHint: PositionHint | undefined]
  edit: [item: ListViewItem<TItem>]
  deleted: [item: ListViewItem<TItem>]
  close: [item: ListViewItem<TItem>]
  'item-saved': [item: ListViewItem<TItem>]
  'item-expand': [item: ListViewItem<TItem>, expanded: boolean]
}>()

const modelValue = defineModel<TItem[]>({ required: true })

const { t } = useI18n()
const slots = useSlots()
const display = useDisplay()

const isTouch = computed<boolean>(() => display.platform.value.touch)

const effectiveCloseVariant = computed<'icon' | 'labeled'>(() => {
  if (props.closeVariant === 'icon') return 'icon'
  if (props.closeVariant === 'labeled') return 'labeled'
  return display.smAndDown.value ? 'icon' : 'labeled'
})

// Options are captured once at setup; list-editor config is expected to be stable.
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

const addLabelResolved = computed(() => props.addLabel ?? t('common.sortable.add'))
const emptyTitleResolved = computed(() => props.emptyTitle ?? t('common.sortable.emptyTitle'))
const emptyTextResolved = computed(() => props.emptyText ?? t('common.sortable.emptyText'))
const deleteConfirmTitleResolved = computed(
  () => props.deleteConfirmTitle ?? t('common.sortable.deleteConfirmTitle'),
)
const deleteConfirmTextResolved = computed(
  () => props.deleteConfirmText ?? t('common.sortable.deleteConfirmText'),
)

const canInteract = computed(() => !props.readonly && !props.disabled && !props.loading)
const canAdd = computed(() => canInteract.value && props.showAddButton)

const headerVisible = computed(() => !!(props.title || slots.header))

const isInlineEdit = computed(() => !props.chips && !!slots.item)

const hasReadonlyDetail = computed(() => !props.chips && !!slots['item-readonly'])

// Per-row edit footer (Save + Cancel) is only meaningful if the consumer wants a
// per-item persist callback. Without it the expectation is that the parent form's
// global save flushes everything, so we hide the per-row buttons by default.
const showInlineSaveFooter = computed(() => !!props.onItemSave)

const isItemDirty = (vi: ListViewItem<TItem>): boolean => {
  const baseline = dirtyBaseline.value.get(vi.key)
  if (baseline === undefined) return true
  return baseline !== JSON.stringify(vi.raw)
}

const viewItemsDecorated = computed<DecoratedViewItem<TItem>[]>(() =>
  editor.viewItems.value.map((vi) => ({
    ...vi,
    editing: editingKeys.value.has(vi.key),
    expanded: expandedKeys.value.has(vi.key),
    loading: props.loadingKeys?.has(vi.key) ?? false,
    dirty: isItemDirty(vi),
  })),
)

const isEmpty = computed(() => viewItemsDecorated.value.length === 0)

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
  if (!canInteract.value) return
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
  if (props.disabled || props.loading) return false
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
  touch: isTouch.value,
  actions: {
    edit: () => onEditClick(vi),
    save: () => onSaveClick(vi),
    cancel: () => onCancelClick(vi),
    close: () => onCloseClick(vi),
    delete: () => onDeleteClick(vi),
    addAfter: () => onRowAddAfterClick(vi),
    toggleExpand: () => onExpandClick(vi),
  },
})

defineExpose({
  addItem: editor.addItem,
  deleteItem: editor.deleteItem,
  updateItem: editor.updateItem,
  moveItem: editor.moveItem,
  recalculatePositions: editor.recalculatePositions,
  viewItems: editor.viewItems,
  resetDirtyBaseline: captureDirtyBaseline,
})
</script>

<template>
  <div
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
    <div class="a-list-editor__card">
      <div
        v-if="headerVisible"
        class="a-list-editor__header"
      >
        <slot
          name="header"
          :title="title"
        >
          <h3
            v-if="title"
            class="a-list-editor__title-heading"
          >
            {{ title }}
          </h3>
        </slot>
      </div>

      <div
        v-if="loading"
        class="a-list-editor__state a-list-editor__state--loading"
      >
        <VProgressCircular
          indeterminate
          color="primary"
          size="32"
        />
      </div>

      <div
        v-else-if="error"
        class="a-list-editor__state a-list-editor__state--error"
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
        class="a-list-editor__state a-list-editor__state--empty"
      >
        <slot
          name="empty"
          :readonly="readonly"
          :disabled="disabled"
          :actions="{ add: onAddClick }"
        >
          <div class="a-list-editor__empty">
            <h3 class="a-list-editor__empty-title">
              {{ emptyTitleResolved }}
            </h3>
            <p class="a-list-editor__empty-text">
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

      <template v-else>
        <div
          v-for="vi in viewItemsDecorated"
          :key="String(vi.key)"
          class="a-list-editor__row"
          :class="{
            'a-list-editor__row--two-rows': twoRows === 'always',
            'a-list-editor__row--editing': vi.editing,
            'a-list-editor__row--expanded': vi.expanded,
            'a-list-editor__row--dirty': vi.dirty,
            'a-list-editor__row--clickable': isRowClickable(vi),
            [`a-list-editor__row--validation-${resolveValidation(vi.raw)}`]:
              resolveValidation(vi.raw) !== null,
          }"
        >
          <slot
            name="before-item"
            v-bind="buildSlotProps(vi)"
          />

          <div
            class="a-list-editor__row-header"
            @click="onRowClick(vi)"
          >
            <div class="a-list-editor__row-main">
              <slot
                name="item-compact"
                v-bind="buildSlotProps(vi)"
              >
                <span class="a-list-editor__title">
                  {{ resolveCompactText(vi.raw, vi.key) }}
                </span>
              </slot>
              <span
                v-if="vi.dirty"
                class="a-list-editor__unsaved-label"
              >
                <VIcon
                  icon="mdi-circle-medium"
                  size="12"
                />
                {{ t('common.sortable.unsaved') }}
              </span>
            </div>

            <div
              v-if="!vi.editing && !vi.expanded"
              class="a-list-editor__status"
            >
              <slot
                name="item-status"
                v-bind="buildSlotProps(vi)"
              >
                <span
                  v-if="statusField && vi.raw[statusField] != null && vi.raw[statusField] !== ''"
                  class="a-list-editor__status-badge"
                >
                  {{ vi.raw[statusField] }}
                </span>
              </slot>
            </div>

            <div class="a-list-editor__actions">
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
                  class="a-list-editor__action a-list-editor__action--chip-close"
                  @click.stop="onDeleteClick(vi)"
                >
                  <VIcon
                    icon="mdi-close"
                    size="14"
                  />
                </VBtn>
                <template v-else-if="vi.editing || vi.expanded">
                  <VBtn
                    v-if="vi.editing && showDeleteButton && canInteract"
                    icon
                    size="small"
                    variant="text"
                    density="comfortable"
                    class="a-list-editor__action a-list-editor__action--delete"
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
                    class="a-list-editor__action a-list-editor__action--close"
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
                    class="a-list-editor__action a-list-editor__action--close"
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
                    class="a-list-editor__action a-list-editor__action--edit"
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
                    class="a-list-editor__action a-list-editor__action--delete"
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
                    class="a-list-editor__action a-list-editor__action--menu"
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

          <template v-if="vi.editing && $slots.item">
            <div class="a-list-editor__row-body">
              <div
                v-if="$slots['item-status']"
                class="a-list-editor__body-status"
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
                class="a-list-editor__row-footer"
              >
                <div class="a-list-editor__row-footer-spacer" />
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
            v-else-if="vi.expanded && $slots['item-readonly']"
            class="a-list-editor__row-body"
          >
            <div
              v-if="$slots['item-status']"
              class="a-list-editor__body-status"
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
          class="a-list-editor__row-add"
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
  </div>
</template>

<style lang="scss" scoped>
.a-list-editor {
  --ale-border: rgb(0 0 0 / 12%);
  --ale-border-strong: rgb(0 0 0 / 38%);
  --ale-surface: rgb(var(--v-theme-surface, 255 255 255));
  --ale-surface-container: rgb(var(--v-theme-surface-variant, 245 245 245) / 25%);
  --ale-primary: rgb(var(--v-theme-primary, 63 106 216));
  --ale-primary-container: rgb(var(--v-theme-primary, 63 106 216) / 12%);
  --ale-primary-state: rgb(var(--v-theme-primary, 63 106 216) / 4%);
  --ale-primary-state-press: rgb(var(--v-theme-primary, 63 106 216) / 12%);
  --ale-success-container: rgb(var(--v-theme-success, 58 196 125) / 18%);
  --ale-warning-container: rgb(var(--v-theme-warning, 251 140 0) / 18%);
  --ale-error-container: rgb(var(--v-theme-error, 217 37 80) / 18%);
  --ale-on-surface: rgb(var(--v-theme-on-surface, 51 51 51));
  --ale-on-surface-variant: rgb(var(--v-theme-on-surface-variant, 102 102 102));
  --ale-radius: 12px;
  --ale-radius-sm: 8px;
  --ale-radius-full: 9999px;
  --ale-elev-1: 0 1px 2px rgb(0 0 0 / 12%), 0 1px 3px 1px rgb(0 0 0 / 6%);
  --ale-row-min-height: 48px;

  position: relative;
}

.a-list-editor--disabled,
.a-list-editor--readonly {
  opacity: 0.85;
}

.a-list-editor--disabled {
  pointer-events: none;
}

.a-list-editor__card {
  background: var(--ale-surface);
  border: 1px solid var(--ale-border);
  border-radius: var(--ale-radius);
  overflow: hidden;
  box-shadow: var(--ale-elev-1);
}

.a-list-editor__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 20px;
  border-bottom: 1px solid var(--ale-border);
  background: var(--ale-surface);
  height: 60px;
  flex-shrink: 0;
}

.a-list-editor__title-heading {
  font-weight: 500;
  font-size: 1rem;
  line-height: 1.4;
  color: var(--ale-on-surface);
  margin: 0;
}

.a-list-editor__state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
}

.a-list-editor__state--error {
  padding: 16px;
}

.a-list-editor__state--error :deep(.v-alert) {
  width: 100%;
}

.a-list-editor__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  padding: 16px;
}

.a-list-editor__empty-title {
  font-size: 1rem;
  font-weight: 500;
  margin: 0;
  color: var(--ale-on-surface);
}

.a-list-editor__empty-text {
  font-size: 0.875rem;
  color: var(--ale-on-surface-variant);
  margin: 0 0 12px;
}

.a-list-editor__row {
  position: relative;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--ale-border);
  transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.a-list-editor__row:last-of-type {
  border-bottom: none;
}

.a-list-editor__row-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  min-height: var(--ale-row-min-height);
  flex-shrink: 0;
  position: relative;
}

.a-list-editor__row--clickable .a-list-editor__row-header {
  cursor: pointer;
}

.a-list-editor__row--clickable:not(.a-list-editor__row--editing, .a-list-editor__row--expanded):hover
  .a-list-editor__row-header {
  background: var(--ale-primary-state);
}

.a-list-editor__row--clickable:not(.a-list-editor__row--editing, .a-list-editor__row--expanded):active
  .a-list-editor__row-header {
  background: var(--ale-primary-state-press);
}

.a-list-editor__row--editing,
.a-list-editor__row--expanded {
  background: var(--ale-primary-container);
}

.a-list-editor__row--editing::before,
.a-list-editor__row--expanded::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--ale-primary);
  z-index: 1;
}

/* Dirty (unsaved) takes precedence over editing/expanded: orange stripe + tinted bg. */
.a-list-editor__row--dirty {
  background: var(--ale-warning-container);
}

.a-list-editor__row--dirty::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: rgb(var(--v-theme-warning, 251 140 0));
  z-index: 2;
}

.a-list-editor__unsaved-label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.7rem;
  color: rgb(var(--v-theme-warning, 251 140 0));
  font-weight: 500;
  background: transparent;
  border: 1px solid rgb(var(--v-theme-warning, 251 140 0));
  padding: 2px 8px;
  border-radius: var(--ale-radius-full);
  white-space: nowrap;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.a-list-editor__row--two-rows:not(
    .a-list-editor__row--editing,
    .a-list-editor__row--expanded
  )
  .a-list-editor__row-header {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: 'title title' 'status actions';
  align-items: center;
  gap: 4px 8px;
  padding: 10px 16px;
  min-height: auto;
}

.a-list-editor__row--two-rows .a-list-editor__row-main {
  grid-area: title;
  min-width: 0;
}

.a-list-editor__row--two-rows .a-list-editor__row-main .a-list-editor__title {
  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.35;
  font-weight: 500;
}

.a-list-editor__row--two-rows .a-list-editor__status {
  grid-area: status;
}

.a-list-editor__row--two-rows .a-list-editor__actions {
  grid-area: actions;
  margin-left: 0;
}

.a-list-editor__row--validation-invalid::after,
.a-list-editor__row--validation-warning::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
}

.a-list-editor__row--validation-invalid:not(.a-list-editor__row--editing)::after {
  background: rgb(var(--v-theme-error, 217 37 80));
}

.a-list-editor__row--validation-warning:not(.a-list-editor__row--editing)::after {
  background: rgb(var(--v-theme-warning, 251 140 0));
}

.a-list-editor__row-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.a-list-editor__row-body {
  padding: 12px 16px 8px;
}

.a-list-editor__body-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.a-list-editor__row-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 16px 16px;
  background: transparent;
  border-top: none;
}

.a-list-editor__row-footer-spacer {
  flex: 1 1 auto;
}

.a-list-editor__title {
  flex: 1 1 auto;
  font-size: 0.92rem;
  font-weight: 400;
  letter-spacing: 0.01em;
  color: var(--ale-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.a-list-editor__row--editing .a-list-editor__row-main,
.a-list-editor__row--expanded .a-list-editor__row-main {
  font-weight: 700;
  color: var(--ale-primary);
}

.a-list-editor__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.a-list-editor__status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  padding: 3px 10px;
  border-radius: var(--ale-radius-full);
  background: var(--ale-success-container);
  color: var(--ale-on-surface);
  font-weight: 500;
  letter-spacing: 0.02em;
  white-space: nowrap;
  flex-shrink: 0;
}

.a-list-editor__actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 0;
}

@media (width >= 960px) {
  .a-list-editor__actions {
    margin-left: 24px;
  }
}

.a-list-editor__action--edit,
.a-list-editor__action--delete,
.a-list-editor__action--menu {
  opacity: 0;
  transition: opacity 0.15s;
}

.a-list-editor__row:hover .a-list-editor__action--edit,
.a-list-editor__row:hover .a-list-editor__action--delete,
.a-list-editor__row:hover .a-list-editor__action--menu,
.a-list-editor__row:focus-within .a-list-editor__action--edit,
.a-list-editor__row:focus-within .a-list-editor__action--delete,
.a-list-editor__row:focus-within .a-list-editor__action--menu {
  opacity: 1;
}

.a-list-editor--touch .a-list-editor__action--edit,
.a-list-editor--touch .a-list-editor__action--delete,
.a-list-editor--touch .a-list-editor__action--menu {
  opacity: 1;
}

.a-list-editor__row-add {
  width: 100%;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ale-primary);
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  border-top: 1px solid var(--ale-border);
  background: var(--ale-surface-container);
  letter-spacing: 0.02em;
  transition: background-color 0.15s;
  text-align: left;
  font-family: inherit;
}

.a-list-editor__row-add:hover {
  background: var(--ale-primary-container);
}

.a-list-editor__row-add:focus-visible {
  outline: 2px solid var(--ale-primary);
  outline-offset: -2px;
}

@media (width <= 600px) {
  .a-list-editor--two-rows-mobile
    .a-list-editor__row:not(
      .a-list-editor__row--editing,
      .a-list-editor__row--expanded
    )
    .a-list-editor__row-header {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas: 'title title' 'status actions';
    align-items: center;
    gap: 4px 8px;
    padding: 10px 16px;
    min-height: auto;
  }

  .a-list-editor--two-rows-mobile .a-list-editor__row-main {
    grid-area: title;
    min-width: 0;
  }

  .a-list-editor--two-rows-mobile .a-list-editor__row-main .a-list-editor__title {
    white-space: normal;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.35;
    font-weight: 500;
  }

  .a-list-editor--two-rows-mobile .a-list-editor__status {
    grid-area: status;
  }

  .a-list-editor--two-rows-mobile .a-list-editor__actions {
    grid-area: actions;
    margin-left: 0;
  }
}

/* Additional fallback: coarse-pointer devices (matches touch detection via CSS). */
@media (hover: none) {
  .a-list-editor__action--edit,
  .a-list-editor__action--delete,
  .a-list-editor__action--menu {
    opacity: 1;
  }
}

/* Chips layout — flat inline-flex pills, single-line, close-X always visible. */
.a-list-editor--chips .a-list-editor__card {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  border-radius: var(--ale-radius);
  box-shadow: none;
}

.a-list-editor--chips .a-list-editor__header {
  flex: 1 1 100%;
  padding: 4px 8px 8px;
  border-bottom: none;
  min-height: auto;
}

.a-list-editor--chips .a-list-editor__row {
  border-bottom: none;
  background: var(--ale-primary-container);
  border-radius: var(--ale-radius-full);
  flex: 0 0 auto;
  max-width: 100%;
}

.a-list-editor--chips .a-list-editor__row-header {
  padding: 2px 4px 2px 12px;
  gap: 4px;
  min-height: 28px;
}

.a-list-editor--chips .a-list-editor__row-main {
  gap: 6px;
}

.a-list-editor--chips .a-list-editor__title {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--ale-primary);
}

.a-list-editor--chips .a-list-editor__action--chip-close {
  opacity: 0.7;
  transition: opacity 0.15s;
}

.a-list-editor--chips .a-list-editor__action--chip-close:hover {
  opacity: 1;
}

.a-list-editor--chips .a-list-editor__row-add {
  flex: 0 0 auto;
  width: auto;
  border-top: none;
  border: 1px dashed var(--ale-border);
  border-radius: var(--ale-radius-full);
  padding: 4px 12px;
  font-size: 0.82rem;
  background: transparent;
}

.a-list-editor--chips .a-list-editor__row-add:hover {
  background: var(--ale-primary-state);
}
</style>
