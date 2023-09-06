<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { computed, ref } from 'vue'
import type { DocId, IntegerId, IntegerIdNullable } from '@/types/common'
import type { SortableNested, SortableNestedItem } from '@/components/sortable/sortableNestedActions'
import ASortableNested from '@/components/sortable/ASortableNested.vue'
import ASortable from '@/components/sortable/ASortable.vue'
import { isNull } from '@/utils/common'
import type { SortableItemNewPositions } from '@/components/sortable/sortableUtils'
import type { SortableItem, SortablePropItem } from '@/components/sortable/sortableActions'

interface BasicItemDemo extends Record<string, any> {
  id: number
  text: string
  position: number
}

interface NestedDemoData extends Record<string, any> {
  text: string
  position: number
  id: IntegerId
  parent: IntegerIdNullable
}

const itemsBasic = ref<Array<BasicItemDemo>>([
  { id: 1, text: 'One', position: 1 },
  { id: 2, text: 'Two', position: 2 },
  { id: 3, text: 'Tree', position: 3 },
  { id: 4, text: 'Four', position: 4 },
])

const itemsBasicDirty = ref(new Set<DocId | IntegerId>())
const itemsBasicDirtyArray = computed(() => Array.from(itemsBasicDirty.value))

const itemsNested = ref<SortableNested>({
  meta: { dirty: false },
  children: [
    {
      data: {
        id: 444,
        parent: null,
        position: 1,
        text: 'Projects',
      },
      meta: { dirty: false },
      children: [
        {
          meta: { dirty: false },
          data: {
            id: 1,
            position: 1,
            parent: 444,
            text: 'Frontend',
          },
          children: [
            {
              meta: { dirty: false },
              data: {
                id: 2,
                position: 1,
                parent: 1,
                text: 'Vue',
              },
              children: [],
            },
            {
              meta: { dirty: false },
              data: {
                id: 4,
                position: 2,
                parent: 1,
                text: 'React',
              },
              children: [],
            },
            {
              meta: { dirty: false },
              data: {
                id: 6,
                position: 3,
                parent: 1,
                text: 'Angular',
              },
              children: [],
            },
          ],
        },
        {
          meta: { dirty: false },
          data: {
            id: 7,
            position: 2,
            parent: 444,
            text: 'Backend',
          },
          children: [
            {
              meta: { dirty: false },
              data: {
                id: 789,
                position: 1,
                parent: 7,
                text: 'Symfony',
              },
              children: [],
            },
          ],
        },
      ],
    },
    {
      meta: { dirty: false },
      data: {
        id: 8,
        position: 2,
        parent: null,
        text: 'Photos disallowed to create tree (no children)',
      },
    },
    {
      meta: { dirty: false },
      data: {
        id: 9,
        position: 3,
        parent: null,
        text: 'Videos',
      },
      children: [
        {
          meta: { dirty: false },
          data: {
            id: 79,
            position: 1,
            parent: 9,
            text: 'Youtube',
          },
          children: [],
        },
      ],
    },
  ],
})

const toRemoveBasic = ref(1)
const toRemoveIndexBasic = ref(1)
const toRemoveNested = ref(1)
const toAddIndexBasic = ref(1)

const confirmDeleteNested = () => {
  if (nestedComponent.value) {
    const needsRefresh = nestedComponent.value.removeById(toRemoveNested.value)
    console.log(needsRefresh)
  }
}
const confirmDeleteBasic = () => {
  if (basicComponent.value) {
    const needsRefresh = basicComponent.value.removeById(toRemoveBasic.value)
    console.log(needsRefresh)
  }
}

const confirmDeleteIndexBasic = () => {
  if (basicComponent.value) {
    const needsRefresh = basicComponent.value.removeByIndex(toRemoveIndexBasic.value)
    console.log(needsRefresh)
  }
}

const confirmAddIndexBasic = () => {
  if (basicComponent.value) {
    const needsRefresh = basicComponent.value.addAfterIndex(toAddIndexBasic.value, {
      id: 0,
      text: 'Lorem I',
      position: 0,
    })
    console.log(needsRefresh)
  }
}

const nestedComponent = ref<InstanceType<typeof ASortableNested> | null>(null)
const basicComponent = ref<InstanceType<typeof ASortable> | null>(null)

const onAddAfterClickNested = (item: SortableNestedItem) => {
  if (nestedComponent.value) {
    const needsRefresh = nestedComponent.value.addAfterId(
      item.data.id,
      {
        id: Date.now(),
        text: 'Lorem',
        position: 0,
      },
      true
    )
    console.log(needsRefresh)
  }
}
const onAddChildClickNested = (item: SortableNestedItem) => {
  if (nestedComponent.value) {
    nestedComponent.value.addChildToId(item.data.id, { id: Date.now(), text: 'Lorem', position: 0 }, true)
  }
}
const onAddLastClickNested = (item: SortableNestedItem | null) => {
  if (nestedComponent.value) {
    const needsRefresh = nestedComponent.value.addAfterId(
      isNull(item) ? null : item.data.id,
      { id: Date.now(), text: 'Lorem', position: 0 },
      true
    )
    console.log(needsRefresh)
  }
}
const onSortableNestedEnd = (data: SortableItemNewPositions) => {
  console.log(data)
}

const onAddAfterClickBasic = (item: SortableItem<BasicItemDemo>) => {
  if (basicComponent.value) {
    const needsRefresh = basicComponent.value.addAfterId(item.raw.id, { id: Date.now(), text: 'Lorem 2', position: 0 })
    console.log(item.index)
    console.log(needsRefresh)
  }
}

const onAddLastClickBasic = (item: SortablePropItem | null) => {
  console.log(item)
}
const onSortableBasicEnd = (data: SortableItemNewPositions) => {
  console.log(data)
}
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardText>
      <h2 class="text-h5 mt-5 mb-2">
        ASortableNested <span class="text-caption">dirty: {{ itemsNested.meta.dirty }}</span>
      </h2>
      <ASortableNested
        ref="nestedComponent"
        v-model="itemsNested"
        class="mb-2"
        :max-depth="3"
        show-add-after-button
        show-add-child-button
        show-delete-button
        show-edit-button
        @on-add-after="onAddAfterClickNested"
        @on-add-child="onAddChildClickNested"
        @on-add-last="onAddLastClickNested"
        @on-end="onSortableNestedEnd"
      >
        <template #item="{ item }: { item: SortableNestedItem<NestedDemoData> }">
          <div class="text-caption text-medium-emphasis">
            id: {{ item.data.id }} / pos: {{ item.data.position }} / dirty: {{ item.meta.dirty }}
          </div>
          <VTextField
            v-model="item.data.text"
            hide-details
          />
        </template>
        <template #buttons>
          <VBtn
            class="mx-1"
            icon
            variant="text"
            size="x-small"
          >
            T
          </VBtn>
        </template>
      </ASortableNested>
      <div class="my-3 w-100 d-flex">
        <div style="width: 300px">
          <VTextField
            v-model.number="toRemoveNested"
            type="number"
            label="remove id"
          />
        </div>
        <VBtn @click.stop="confirmDeleteNested">
          confirm remove
        </VBtn>
      </div>
      <pre class="my-5">{{ itemsNested }}</pre>
      <h2 class="text-h5 mt-5 mb-2">
        ASortable simple example without updating position
      </h2>
      <ASortable v-model="itemsBasic">
        <template #item="{ item }: { item: SortableItem<BasicItemDemo> }">
          {{ item.raw.id }} {{ item.raw.text }}
        </template>
      </ASortable>

      <h2 class="text-h5 mt-5 mb-2">
        ASortable disabled dragging
      </h2>
      <ASortable
        v-model="itemsBasic"
        disable-draggable
      >
        <template #item="{ item }: { item: SortableItem<BasicItemDemo> }">
          {{ item.raw.id }} {{ item.raw.text }}
        </template>
      </ASortable>

      <h2 class="text-h5 mt-5 mb-2">
        ASortable with changing of position field and dirty and all buttons
      </h2>
      <ASortable
        ref="basicComponent"
        v-model="itemsBasic"
        v-model:dirty="itemsBasicDirty"
        update-position
        show-edit-button
        show-delete-button
        show-add-after-button
        show-add-last-button
        @on-add-after="onAddAfterClickBasic"
        @on-add-last="onAddLastClickBasic"
        @on-end="onSortableBasicEnd"
      >
        <template #item="{ item }: { item: SortableItem<BasicItemDemo> }">
          id: {{ item.raw.id }} / {{ item.raw.text }} / position: {{ item.raw.position }}
        </template>
      </ASortable>
      <div
        v-if="itemsBasicDirty.size > 0"
        class="my-5"
      >
        dirty:
        <div
          v-for="dirty in itemsBasicDirtyArray"
          :key="dirty"
        >
          {{ dirty }}
        </div>
      </div>
      <div class="my-3 w-100 d-flex">
        <div style="width: 300px">
          <VTextField
            v-model.number="toRemoveBasic"
            type="number"
            label="remove id"
          />
        </div>
        <VBtn @click.stop="confirmDeleteBasic">
          confirm remove
        </VBtn>
      </div>
      <div class="my-3 w-100 d-flex">
        <div style="width: 300px">
          <VTextField
            v-model.number="toRemoveIndexBasic"
            type="number"
            label="remove index"
          />
        </div>
        <VBtn @click.stop="confirmDeleteIndexBasic">
          confirm remove
        </VBtn>
      </div>
      <div class="my-3 w-100 d-flex">
        <div style="width: 300px">
          <VTextField
            v-model.number="toAddIndexBasic"
            type="number"
            label="add after index"
          />
        </div>
        <VBtn @click.stop="confirmAddIndexBasic">
          confirm add after index
        </VBtn>
      </div>
    </VCardText>
  </VCard>
</template>
