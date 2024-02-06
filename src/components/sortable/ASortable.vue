<script setup lang="ts">
import { useSortable } from '@vueuse/integrations/useSortable'
import type { SortableEvent } from 'sortablejs'
import { Comment, computed, nextTick, onBeforeUnmount, toRef, useSlots, watch, withModifiers } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SortableEmit, SortableItem, SortablePropItem } from '@/components/sortable/sortableActions'
import {
  CHOSEN_CLASS,
  DRAG_CLASS,
  GHOST_CLASS,
  GROUP_CLASS,
  HANDLE_CLASS,
  useSortableActions,
} from '@/components/sortable/sortableActions'
import type { DocId, IntegerId } from '@/types/common'
import { cloneDeep, isUndefined } from '@/utils/common'
import { WIDGET_HTML_ID_PREFIX } from '@/components/sortable/sortableUtils'
import ADialogToolbar from '@/components/ADialogToolbar.vue'

const props = withDefaults(
  defineProps<{
    modelValue: SortablePropItem[] | any
    dirty?: Set<DocId | IntegerId>
    keyField?: string
    disableDraggable?: boolean
    rootClassName?: string
    widgetIdentifierId?: string | undefined
    disableDefaultSort?: boolean
    updatePosition?: boolean
    positionField?: string
    positionMultiplier?: number
    showAddAfterButton?: boolean
    showAddLastButton?: boolean
    showDeleteButton?: boolean
    showEditButton?: boolean
    addLastButtonT?: string
  }>(),
  {
    dirty: () => new Set<DocId | IntegerId>(),
    keyField: 'position',
    disableDraggable: false,
    rootClassName: 'a-sortable-widget',
    widgetIdentifierId: undefined,
    disableDefaultSort: false,
    updatePosition: false,
    positionField: 'position',
    positionMultiplier: 1,
    showAddAfterButton: false,
    showAddLastButton: false,
    showDeleteButton: false,
    showEditButton: false,
    addLastButtonT: 'common.sortable.addNewAtEnd',
  }
)
const emit = defineEmits<SortableEmit>()

const model = toRef(() => props.modelValue)

const { t } = useI18n()

const onAddAfterClick = (data: SortableItem) => {
  emit('onAddAfter', data)
}

const onDeleteClick = (data: SortableItem) => {
  itemToRemove.value = data
  removeDialog.value = true
}

const onEditClick = (data: SortableItem) => {
  emit('onEdit', data)
}

const onAddLastClick = () => {
  if (props.modelValue.length > 0) {
    emit('onAddLast', cloneDeep(props.modelValue[props.modelValue.length - 1]))
    return
  }
  emit('onAddLast', null)
}

const widgetHtmlId = computed(() => {
  return isUndefined(props.widgetIdentifierId) ? WIDGET_HTML_ID_PREFIX + randomUuid.value : props.widgetIdentifierId
})

const initSortable = () => {
  if (props.disableDraggable) return
  if (!widgetEl.value) return
  const nestedSortable = widgetEl.value.querySelector<HTMLElement>('.' + GROUP_CLASS)
  if (!nestedSortable) return
  sortableInstance.value = useSortable(nestedSortable, [], {
    handle: '.' + HANDLE_CLASS,
    ghostClass: GHOST_CLASS,
    dragClass: DRAG_CLASS,
    chosenClass: CHOSEN_CLASS,
    onEnd: async (event: SortableEvent) => {
      if (props.disableDefaultSort || isUndefined(event.oldIndex) || isUndefined(event.newIndex)) return
      const needsRefresh = moveArrayElement(event.oldIndex, event.newIndex)
      emit('onEnd', needsRefresh)
    },
    onStart() {
      emit('onStart')
    },
  })
}

const {
  items,
  forceRerender,
  dirtyLocal,
  moveArrayElement,
  itemToRemove,
  removeDialog,
  destroy,
  refresh,
  onRemoveDialogConfirm,
  sortableInstance,
  widgetEl,
  randomUuid,
  addAfterId,
  removeById,
  updateData,
  addAfterIndex,
  removeByIndex,
  updateDataAtIndex,
} = useSortableActions(model, initSortable, props, emit)

onBeforeUnmount(() => {
  destroy()
})

nextTick(() => {
  widgetEl.value = document.querySelector('#' + widgetHtmlId.value)
  initSortable()
})

watch(
  () => props.disableDraggable,
  async (newValue) => {
    destroy()
    if (newValue === false) initSortable()
  }
)

watch(
  () => props.dirty,
  (newValue) => {
    dirtyLocal.value = newValue
  }
)

defineExpose({
  refresh,
  addAfterId,
  addAfterIndex,
  removeById,
  removeByIndex,
  updateData,
  updateDataAtIndex,
})
</script>

<template>
  <div>
    <div
      :id="widgetHtmlId"
      :class="rootClassName"
    >
      <div
        :key="forceRerender"
        :class="GROUP_CLASS"
      >
        <div
          v-for="item of items"
          :key="item.key"
        >
          <div class="a-sortable-widget__before">
            <slot
              name="itemBefore"
              :item="item"
            />
          </div>
          <div class="a-sortable-widget__item">
            <VIcon
              :class="{
              [HANDLE_CLASS]: true,
              [HANDLE_CLASS + '--disabled']: disableDraggable,
            }"
              icon="mdi-drag"
            />
            <div class="a-sortable-widget__content">
              <slot
                name="item"
                :item="item"
              />
            </div>
            <div class="a-sortable-widget__buttons">
              <VBtn
                v-if="showEditButton"
                icon
                size="x-small"
                variant="text"
                class="mx-1"
                @click.stop="onEditClick(item)"
              >
                <VIcon icon="mdi-pencil"/>
                <VTooltip
                  anchor="bottom"
                  activator="parent"
                  text="Edit"
                />
              </VBtn>
              <VBtn
                v-if="showDeleteButton"
                icon
                size="x-small"
                variant="text"
                class="mx-1"
                @click.stop="onDeleteClick(item)"
              >
                <VIcon icon="mdi-trash-can-outline"/>
                <VTooltip
                  anchor="bottom"
                  activator="parent"
                  text="Remove"
                />
              </VBtn>
              <slot
                name="buttons"
                :item="item"
              />
              <VBtn
                v-if="showAddAfterButton"
                icon
                size="x-small"
                variant="text"
                class="mx-1"
              >
                <VIcon icon="mdi-dots-vertical"/>
                <VTooltip
                  anchor="bottom"
                  activator="parent"
                  text="More options"
                />
                <VMenu activator="parent">
                  <VList density="compact">
                    <VListItem
                      v-if="showAddAfterButton"
                      @click.stop="onAddAfterClick(item)"
                    >
                      Add new item after
                    </VListItem>
                  </VList>
                </VMenu>
              </VBtn>
            </div>
          </div>
          <div class="a-sortable-widget__after">
            <slot
              name="itemAfter"
              :item="item"
            />
          </div>
        </div>
      </div>
    </div>
    <slot
      name="add-last-activator"
      :props="{ onClick: withModifiers(() => onAddLastClick(), ['stop']) }"
    >
      <VBtn
        v-if="showAddLastButton"
        size="small"
        prepend-icon="mdi-plus"
        class="ma-1"
        @click.stop="onAddLastClick"
      >
        {{ t(addLastButtonT) }}
      </VBtn>
    </slot>
    <VDialog
      v-model="removeDialog"
      :width="500"
    >
      <VCard v-if="removeDialog">
        <ADialogToolbar @on-cancel="removeDialog = false">
          {{ t('common.system.modal.confirmDelete') }}
        </ADialogToolbar>
        <VCardActions>
          <VSpacer/>
          <ABtnTertiary @click.stop="removeDialog = false">
            {{ t('common.button.cancel') }}
          </ABtnTertiary>
          <ABtnPrimary @click.stop="onRemoveDialogConfirm">
            {{ t('common.button.delete') }}
          </ABtnPrimary>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style lang="scss">
@use 'sass:color';

// todo dark theme colors

$class-name-root: 'a-sortable-widget';
$bg-color: #fff;
$border-color: lightgray;
$border-color-hover: gray;
$ghost-bg-color: color.scale(#3f6ad8, $lightness: 95%);

.#{$class-name-root} {
  &__item {
    position: relative;
    display: flex;
    align-items: center;
    padding: 6px 0 6px 4px;
    background-color: $bg-color;
    border: 1px solid $border-color;
    border-bottom: none;

    &:first-child {
      border-top-left-radius: 5px;
      border-top-right-radius: 5px;
    }

    &:last-child {
      border-bottom-left-radius: 5px;
      border-bottom-right-radius: 5px;
      border-bottom: 1px solid $border-color;
    }

    &:hover {
      border-color: $border-color-hover;

      .#{$class-name-root}__buttons {
        opacity: 1;
      }
    }

    &:hover + & {
      border-top: 1px solid $border-color-hover;
    }
  }

  &__content {
    width: 100%;
  }

  &__before {
    width: 100%;
  }

  &__after {
    width: 100%;
  }

  &__handle {
    cursor: move;
    margin: 6px;

    &--disabled {
      opacity: 0;
      cursor: default;
    }
  }

  &__ghost {
    background-color: $ghost-bg-color;
  }

  &__buttons {
    opacity: 0;
    display: flex;
  }
}
</style>
