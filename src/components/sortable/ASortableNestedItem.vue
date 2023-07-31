<script setup lang="ts">
import { inject, provide } from 'vue'
import { computed } from 'vue'
import type { SortableNestedItem } from '@/components/sortable/sortableNestedActions'
import { cloneDeep, isUndefined } from '@/utils/common'
import { NESTED_HANDLE_CLASS, SortableLevel } from '@/components/sortable/sortableNestedActions'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    item: SortableNestedItem | any
    disableDraggable: boolean
    maxDepth: number
    showAddAfterButton: boolean
    showAddChildButton: boolean
    showDeleteButton?: boolean
    showEditButton?: boolean
  }>(),
  {}
)
const emit = defineEmits<{
  (e: 'onAddAfter', item: SortableNestedItem): void
  (e: 'onAddChild', item: SortableNestedItem): void
  (e: 'onDelete', item: SortableNestedItem): void
  (e: 'onEdit', item: SortableNestedItem): void
}>()

const onDeleteClick = (item: SortableNestedItem | MouseEvent | KeyboardEvent) => {
  if ('data' in item) {
    emit('onDelete', item)
    return
  }
  emit('onDelete', cloneDeep(props.item))
}

const onEditClick = (item: SortableNestedItem | MouseEvent | KeyboardEvent) => {
  if ('data' in item) {
    emit('onEdit', item)
    return
  }
  emit('onEdit', cloneDeep(props.item))
}

const onAddAfterClick = (item: SortableNestedItem | MouseEvent | KeyboardEvent) => {
  if ('data' in item) {
    emit('onAddAfter', item)
    return
  }
  emit('onAddAfter', cloneDeep(props.item))
}

const onAddChildClick = (item: SortableNestedItem | MouseEvent | KeyboardEvent) => {
  if ('data' in item) {
    emit('onAddChild', item)
    return
  }
  emit('onAddChild', cloneDeep(props.item))
}

const level = inject<number>(SortableLevel, 1)
provide<number>(SortableLevel, level + 1)

const showAddChildButtonComputed = computed(() => {
  return (
    props.showAddChildButton &&
    !isUndefined(props.item.children) &&
    props.item.children.length === 0 &&
    level < props.maxDepth
  )
})

const { t } = useI18n()
</script>

<template>
  <div
    class="a-sortable-nested-widget__container"
    :class="'a-sortable-nested-widget__container--level-' + level"
    :data-id="item.data.id"
  >
    <div class="a-sortable-nested-widget__nested">
      <div class="a-sortable-nested-widget__item">
        <VIcon
          :class="{
            [NESTED_HANDLE_CLASS]: true,
            [NESTED_HANDLE_CLASS + '--disabled']: disableDraggable,
          }"
          icon="mdi-drag"
        />
        <div class="a-sortable-nested-widget__content">
          <slot
            name="item"
            :item="item"
          />
        </div>
        <div class="a-sortable-nested-widget__buttons">
          <VBtn
            v-if="showEditButton"
            icon
            size="x-small"
            variant="text"
            class="mx-1"
            @click.stop="onEditClick"
          >
            <VIcon icon="mdi-pencil" />
            <VTooltip
              anchor="bottom"
              activator="parent"
              :text="t('common.sortable.edit')"
            />
          </VBtn>
          <VBtn
            v-if="showDeleteButton"
            icon
            size="x-small"
            variant="text"
            class="mx-1"
            @click.stop="onDeleteClick"
          >
            <VIcon icon="mdi-trash-can-outline" />
            <VTooltip
              anchor="bottom"
              activator="parent"
              :text="t('common.sortable.remove')"
            />
          </VBtn>
          <slot
            name="buttons"
            :item="item"
          />
          <VBtn
            v-if="showAddAfterButton || showAddChildButtonComputed"
            icon
            size="x-small"
            variant="text"
            class="mx-1"
          >
            <VIcon icon="mdi-dots-vertical" />
            <VTooltip
              anchor="bottom"
              activator="parent"
              :text="t('common.sortable.more')"
            />
            <VMenu activator="parent">
              <VList density="compact">
                <VListItem
                  v-if="showAddAfterButton"
                  @click.stop="onAddAfterClick"
                >
                  {{ t('common.sortable.addAfter') }}
                </VListItem>
                <VListItem
                  v-if="showAddChildButtonComputed"
                  @click.stop="onAddChildClick"
                >
                  {{ t('common.sortable.addChild') }}
                </VListItem>
              </VList>
            </VMenu>
          </VBtn>
        </div>
      </div>
      <div
        v-if="level < maxDepth && !isUndefined(item.children)"
        class="a-sortable-nested-widget__group"
        :class="{ 'a-sortable-nested-widget__group--empty': item.children.length === 0 }"
        :data-id="item.data.id"
      >
        <ASortableNestedItem
          v-for="child of item.children"
          :key="child.data.id"
          :item="child"
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
          <!-- @vue-ignore -->
          <template #item="{ item: itemSlot }">
            <slot
              name="item"
              :item="itemSlot as any"
            />
          </template>
          <!-- @vue-ignore -->
          <template #buttons="{ item: buttonSlot }">
            <slot
              name="buttons"
              :item="buttonSlot as any"
            />
          </template>
        </ASortableNestedItem>
      </div>
    </div>
  </div>
</template>
