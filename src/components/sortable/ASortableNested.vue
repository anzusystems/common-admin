<script setup lang="ts">
import type { SortableEvent } from 'sortablejs'
import { computed, nextTick, onBeforeUnmount, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SortableNested, SortableNestedEmit, SortableNestedItem } from '@/components/sortable/sortableNestedActions'
import { cloneDeep, isNull, isUndefined } from '@/utils/common'
import { WIDGET_HTML_ID_PREFIX } from '@/components/sortable/sortableUtils'
import {
  NESTED_CHOSEN_CLASS,
  NESTED_DRAG_CLASS,
  NESTED_GHOST_CLASS,
  NESTED_GROUP_CLASS,
  NESTED_HANDLE_CLASS, useSortableNestedActions
} from '@/components/sortable/sortableNestedActions'
import { useSortable } from '@vueuse/integrations/useSortable'
import { stringToInt } from '@/utils/string'
import ASortableNestedItem from '@/components/sortable/ASortableNestedItem.vue'
import ADialogToolbar from '@/components/ADialogToolbar.vue'

const props = withDefaults(
  defineProps<{
    modelValue: SortableNested
    maxDepth: number
    disableDraggable?: boolean
    rootClassName?: string
    widgetIdentifierId?: string | undefined
    disableDefaultSort?: boolean
    showAddAfterButton?: boolean
    showAddLastButton?: boolean
    showAddChildButton?: boolean
    showDeleteButton?: boolean
    showEditButton?: boolean
  }>(),
  {
    disableDraggable: false,
    rootClassName: 'a-sortable-nested-widget',
    widgetIdentifierId: undefined,
    disableDefaultSort: false,
    showAddAfterButton: false,
    showAddLastButton: false,
    showAddChildButton: false,
    showDeleteButton: false,
    showEditButton: false,
  }
)
const emit = defineEmits<SortableNestedEmit>()

const model = toRef(() => props.modelValue)

const onAddAfterClick = (data: SortableNestedItem) => {
  emit('onAddAfter', data)
}

const onAddChildClick = (data: SortableNestedItem) => {
  emit('onAddChild', data)
}

const onDeleteClick = (data: SortableNestedItem) => {
  itemToRemove.value = data
  removeDialog.value = true
}

const onEditClick = (data: SortableNestedItem) => {
  emit('onEdit', data)
}

const onAddLastClick = () => {
  if (props.modelValue.children.length > 0) {
    emit('onAddLast', cloneDeep(props.modelValue.children[props.modelValue.children.length - 1]))
    return
  }
  emit('onAddLast', null)
}

const { t } = useI18n()

const widgetHtmlId = computed(() => {
  return isUndefined(props.widgetIdentifierId) ? WIDGET_HTML_ID_PREFIX + randomUuid.value : props.widgetIdentifierId
})

const widgetClass = computed(() => {
  return props.rootClassName + ' ' + (dragging.value ? props.rootClassName + '--dragging' : '')
})

const initSortables = () => {
  if (props.disableDraggable) return
  if (!widgetEl.value) return
  const nestedSortables = Array.from(widgetEl.value.querySelectorAll<HTMLElement>('.' + NESTED_GROUP_CLASS))
  sortableInstances.value = []
  for (let i = 0; i < nestedSortables.length; i++) {
    sortableInstances.value[i] = useSortable(nestedSortables[i], [], {
      group: {
        name: 'nested',
        pull: true,
        put: true,
      },
      handle: '.' + NESTED_HANDLE_CLASS,
      ghostClass: NESTED_GHOST_CLASS,
      dragClass: NESTED_DRAG_CLASS,
      chosenClass: NESTED_CHOSEN_CLASS,
      fallbackOnBody: true,
      swapThreshold: 0.65,
      forceFallback: true,
      fallbackTolerance: 3,
      onUpdate: () => {},
      onStart: () => {
        dragging.value = true
      },
      onEnd: (event: SortableEvent) => {
        dragging.value = false
        nextTick(() => {
          const id = stringToInt(event.item.getAttribute('data-id') ?? '0')
          if (id < 1) return
          const newIndex = event.newIndex
          if (isUndefined(newIndex)) return
          const oldIndex = event.oldIndex
          if (isUndefined(oldIndex)) return
          let parentId: number | null = null
          const parentEl = event.item.parentElement
          if (!isNull(parentEl)) {
            parentId = stringToInt(parentEl.getAttribute('data-id') ?? '0')
            if (parentId === 0) parentId = null
          }
          const needsRefresh = moveArrayElement(id, parentId, newIndex, oldIndex, props.maxDepth)
          emit('onEnd', needsRefresh)
        })
      },
    })
  }
}

const {
  dragging,
  widgetEl,
  randomUuid,
  removeDialog,
  itemToRemove,
  forceRerender,
  moveArrayElement,
  addAfterId,
  addChildToId,
  removeById,
  updateData,
  destroy,
  refresh,
  onRemoveDialogConfirm,
  sortableInstances,
} = useSortableNestedActions(model, initSortables, emit)

onBeforeUnmount(() => {
  destroy()
})

nextTick(() => {
  widgetEl.value = document.querySelector('#' + widgetHtmlId.value)
  initSortables()
})

watch(
  () => props.disableDraggable,
  async (newValue) => {
    destroy()
    if (newValue === false) initSortables()
  }
)

defineExpose({
  refresh,
  addAfterId,
  addChildToId,
  removeById,
  updateData,
})
</script>

<template>
  <div>
    <div
      :id="widgetHtmlId"
      :class="widgetClass"
    >
      <div
        :key="forceRerender"
        :class="NESTED_GROUP_CLASS"
      >
        <ASortableNestedItem
          v-for="item of modelValue.children"
          :key="item.data.id"
          :item="item"
          :disable-draggable="disableDraggable"
          :max-depth="maxDepth"
          :show-add-after-button="showAddAfterButton"
          :show-add-child-button="showAddChildButton"
          :show-delete-button="showDeleteButton"
          :show-edit-button="showEditButton"
          @on-add-after="onAddAfterClick"
          @on-add-child="onAddChildClick"
          @on-delete="onDeleteClick"
          @on-edit="onEditClick"
        >
          <template #item="{ item: itemSlot }">
            <slot
              name="item"
              :item="itemSlot"
            />
          </template>
          <template #buttons="{ item: buttonsSlot }">
            <slot
              name="buttons"
              :item="buttonsSlot"
            />
          </template>
        </ASortableNestedItem>
      </div>
    </div>
    <VBtn
      v-if="showAddLastButton"
      size="small"
      prepend-icon="mdi-plus"
      @click.stop="onAddLastClick"
    >
      Add new item @end
    </VBtn>
    <VDialog
      v-model="removeDialog"
      :width="500"
    >
      <VCard v-if="removeDialog">
        <ADialogToolbar @on-cancel="removeDialog = false">
          {{ t('todo.modalConfirmDelete') }}
        </ADialogToolbar>
        <VCardActions>
          <VSpacer />
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

$class-name-root: 'a-sortable-nested-widget';
$bg-color: #fff;
$border-color: lightgray;
$border-color-hover: gray;
$ghost-bg-color: color.scale(#3f6ad8, $lightness: 95%);
$item-space: 10px;
$ident: 40px;

.#{$class-name-root} {
  &__container {
    position: relative;
    background-color: $bg-color;
    margin-left: ($ident + $item-space);

    &::before {
      content: '';
      position: absolute;
      top: -($item-space);
      left: -($ident);
      border-left: 1px solid $border-color;
      border-bottom: 1px solid $border-color;
      width: $ident;
      height: ($ident + $item-space);
    }

    &::after {
      position: absolute;
      content: '';
      top: ($ident - 1px);
      left: -($ident);
      border-left: 1px solid $border-color;
      border-top: 1px solid $border-color;
      width: $ident;
      height: 100%;
    }

    &:last-child::after {
      display: none;
    }

    &--level-2 {
      .#{$class-name-root}__item {
        background-color: color.scale($bg-color, $lightness: -4%);
      }
    }

    &--level-3 {
      .#{$class-name-root}__item {
        background-color: color.scale($bg-color, $lightness: -8%);
      }
    }

    &--level-4 {
      .#{$class-name-root}__item {
        background-color: color.scale($bg-color, $lightness: -12%);
      }
    }

    &--level-5 {
      .#{$class-name-root}__item {
        background-color: color.scale($bg-color, $lightness: -16%);
      }
    }
  }

  > .#{$class-name-root}__group > .#{$class-name-root}__container:first-child:before {
    border-bottom: none;
  }

  &__item {
    width: 100%;
    display: flex;
    border: 1px solid $border-color;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    border-radius: 5px;
    margin-bottom: 10px;

    &:hover {
      border-color: $border-color-hover;

      .#{$class-name-root}__buttons {
        opacity: 1;
      }
    }

    &:hover + div {
      div {
        border-color: $border-color-hover;

        &::after,
        &::before {
          border-color: $border-color-hover;
        }
      }
    }
  }

  &__content {
    width: 100%;
  }

  &__nested {
    width: 100%;
  }

  &__handle {
    cursor: move;
    margin-right: 6px;

    &--disabled {
      opacity: 0;
      cursor: default;
    }
  }

  &__ghost {
    .#{$class-name-root}__item {
      background-color: $ghost-bg-color !important;
    }
  }

  &__buttons {
    opacity: 0;
    display: flex;
  }

  &--dragging {
    .#{$class-name-root}__group--empty {
      padding-bottom: 20px;
    }
  }

  &__chosen {
    .#{$class-name-root}__container {
      margin-left: 0;
    }
  }

  &__drag {
    &::before,
    &::after {
      opacity: 0;
    }
  }
}
</style>
