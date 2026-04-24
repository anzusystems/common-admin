<script setup lang="ts" generic="TItem extends Record<string, any>">
import { computed, ref, useSlots, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { useListEditor } from '@/labs/listEditor/composables/useListEditor'
import { useDirtyBaseline } from '@/labs/listEditor/composables/useDirtyBaseline'
import { useDeleteDialog } from '@/labs/listEditor/composables/useDeleteDialog'
import { useInlineEditing } from '@/labs/listEditor/composables/useInlineEditing'
import ALeDeleteDialog from '@/labs/listEditor/internal/ALeDeleteDialog.vue'
import ALeEmptyState from '@/labs/listEditor/internal/ALeEmptyState.vue'
import ALeUnsavedLabel from '@/labs/listEditor/internal/ALeUnsavedLabel.vue'
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

const expandedKeys = ref<Set<ListEditorKey>>(new Set())

const rowsContainer = useTemplateRef<HTMLElement>('rowsContainer')

const isInlineEdit = computed(() => !props.chips && !!slots.item)
const hasReadonlyDetail = computed(() => !props.chips && !!slots['item-readonly'])

// Initial snapshot of each item, keyed by row key. Compared against current data to
// detect "dirty" (unsaved) rows. Reset externally after a successful parent-form save.
const { captureDirtyBaseline, isItemDirty } = useDirtyBaseline<TItem>(() =>
  modelValue.value.map((item) => ({
    key: item[props.keyField] as ListEditorKey,
    data: item,
  })),
)

const {
  editingKeys,
  editingSnapshots,
  beginEdit,
  cancelEdit,
  commitEdit,
  closeEdit,
  requestAutoOpen,
} = useInlineEditing<TItem, ListViewItem<TItem>>({
  rowsContainer,
  rowSelector: '.a-list-editor__row',
  isInlineEdit,
  restoreSnapshot: (key, data) => editor.updateItem(key, data),
  watchKeys: () => modelValue.value.map((it) => it[props.keyField] as ListEditorKey),
  findEntry: (key) => {
    const hit = modelValue.value.find(
      (it) => (it[props.keyField] as ListEditorKey) === key,
    )
    return hit ? { data: hit } : null
  },
  afterAutoOpen: (key) => {
    expandedKeys.value.delete(key)
  },
})

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

// Per-row edit footer (Save + Cancel) is only meaningful if the consumer wants a
// per-item persist callback. Without it the expectation is that the parent form's
// global save flushes everything, so we hide the per-row buttons by default.
const showInlineSaveFooter = computed(() => !!props.onItemSave)

const viewItemsDecorated = computed<DecoratedViewItem<TItem>[]>(() =>
  editor.viewItems.value.map((vi) => ({
    ...vi,
    editing: editingKeys.value.has(vi.key),
    expanded: expandedKeys.value.has(vi.key),
    loading: props.loadingKeys?.has(vi.key) ?? false,
    dirty: isItemDirty(vi.key, vi.raw),
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
    <div
      ref="rowsContainer"
      class="a-list-editor__card"
    >
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
          <ALeEmptyState
            block-class="a-list-editor"
            :title="emptyTitleResolved"
            :text="emptyTextResolved"
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
              <ALeUnsavedLabel
                v-if="vi.dirty"
                class="a-list-editor__unsaved-label"
              />
            </div>

            <div
              v-if="!chips"
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
                <template v-else>
                  <VBtn
                    v-if="showEditButton && canInteract"
                    icon
                    size="small"
                    variant="tonal"
                    color="primary"
                    density="comfortable"
                    :class="[
                      'mx-1',
                      'a-list-editor__action',
                      'a-list-editor__action--edit',
                    ]"
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
                    :class="[
                      'mx-1',
                      'a-list-editor__action',
                      'a-list-editor__action--delete',
                    ]"
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
                    :class="[
                      'mx-1',
                      'a-list-editor__action',
                      'a-list-editor__action--menu',
                    ]"
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
              <div class="a-list-editor__form">
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
            <div class="a-list-editor__form">
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

    <ALeDeleteDialog
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

<style lang="scss" scoped>
@use './styles/tokens' as tokens;
@use './styles/shared' as shared;

// Tokens + container setup live on the root block.
.a-list-editor {
  @include tokens.le-tokens;
  @include tokens.le-shell-container;
}

// Shared rule pack — emitted at top level so the selectors stay bare
// (`.a-list-editor__row`) rather than nested under the root block, matching
// the pre-refactor CSS output.
@include shared.le-card('.a-list-editor');
@include shared.le-header-block('.a-list-editor');
@include shared.le-state-and-empty('.a-list-editor');
@include shared.le-row-primitives('.a-list-editor', $unsaved: '--dirty');
@include shared.le-row-hover('.a-list-editor');
@include shared.le-row-active('.a-list-editor');
@include shared.le-row-add('.a-list-editor');
@include shared.le-two-rows-layout('.a-list-editor');
@include shared.le-action-visibility('.a-list-editor');
@include shared.le-chips-shared('.a-list-editor');

// Variant-specific rules, nested.
.a-list-editor {
  // Validation rail (AListEditor-specific — the sortable variant excludes
  // `--unsaved` too, the nested variant doesn't surface validation visuals).
  &__row--validation-invalid::after,
  &__row--validation-warning::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
  }

  &__row--validation-invalid:not(&__row--editing)::after {
    background: rgb(var(--v-theme-error, 217 37 80));
  }

  &__row--validation-warning:not(&__row--editing)::after {
    background: rgb(var(--v-theme-warning, 251 140 0));
  }

  // Chips — row-header padding (12 px left for the flat variant vs 8 px in
  // sortable, which reserves room for the drag handle).
  &--chips &__row-header {
    padding: 2px 4px 2px 12px;
    gap: 4px;
    min-height: 28px;
  }
}

// Container-query driven desktop layout — adds the primary rail + soft gradient
// to the form area. No padding-left override: the flat variant has no caret /
// depth indent, so the body aligns with the row title (16 px). Rail + gradient
// extend to the footer so Cancel/Save sits on the same continuous surface as
// the form.
@container le-shell (min-width: 769px) {
  @include shared.le-editing-body-rail('.a-list-editor', $unsaved: '--dirty');
}

// Narrow-container / mobile layout — taller rows for comfortable touch
// targets, always-visible actions, and the status badge drops out to make room.
/* stylelint-disable selector-max-compound-selectors */
@container le-shell (max-width: 768px) {
  .a-list-editor {
    --le-row-min-height: 48px;
    --le-row-pad-y: 10px;

    &__row:not(&__row--editing) &__status {
      display: none;
    }

    &__row &__action--edit,
    &__row &__action--delete,
    &__row &__action--menu {
      opacity: 1;
    }
  }
}
/* stylelint-enable selector-max-compound-selectors */

@media (width <= 600px) {
  @include shared.le-two-rows-mobile-layout('.a-list-editor');
}
</style>
