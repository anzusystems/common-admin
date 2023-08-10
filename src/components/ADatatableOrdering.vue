<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DatatableOrderingOption, DatatableOrderingOptions } from '@/composables/system/datatableColumns'
import { isUndefined } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'most-relevant'
    modelValue?: number
    customOptions?: undefined | DatatableOrderingOptions
  }>(),
  {
    variant: 'default',
    modelValue: 1,
    customOptions: undefined,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: number): void
  (e: 'sortByChange', data: DatatableOrderingOption): void
}>()

const { t } = useI18n()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const active = ref(props.modelValue)

const modelValueComputed = computed({
  get() {
    return props.modelValue
  },
  set(newValue: number) {
    active.value = newValue
    emit('update:modelValue', newValue)
  },
})

const defaultItems: DatatableOrderingOptions = [
  { id: 1, titleT: 'common.system.datatable.ordering.mostRecent', sortBy: { key: 'createdAt', order: 'desc' } },
  { id: 2, titleT: 'common.system.datatable.ordering.oldest', sortBy: { key: 'createdAt', order: 'asc' } },
]

const defaultItemsMostRelevant: DatatableOrderingOptions = [
  { id: 3, titleT: 'common.system.datatable.ordering.mostRelevant' },
  { id: 1, titleT: 'common.system.datatable.ordering.mostRecent', sortBy: { key: 'createdAt', order: 'desc' } },
  { id: 2, titleT: 'common.system.datatable.ordering.oldest', sortBy: { key: 'createdAt', order: 'asc' } },
]

const activeTitle = computed(() => {
  const found = options.value.find((item: any) => item.id === active.value)
  if (found) return t(found.titleT)
  return ''
})

const options = computed(() => {
  if (props.customOptions) return props.customOptions
  if (props.variant === 'most-relevant') return defaultItemsMostRelevant
  return defaultItems
})

const onItemClick = (item: DatatableOrderingOption) => {
  modelValueComputed.value = item.id
}

watch(
  active,
  (newValue, oldValue) => {
    if (isUndefined(oldValue) || newValue === oldValue) return
    const found = options.value.find((item: any) => item.id === newValue)
    if (found) emit('sortByChange', found)
  },
  { immediate: true }
)

watch(
  modelValueComputed,
  (newValue, oldValue) => {
    if (isUndefined(oldValue) || newValue === oldValue) return
    active.value = newValue
  },
  { immediate: true }
)
</script>

<template>
  <div class="d-flex align-center justify-center">
    <div class="text-caption mr-1">
      {{ t('common.system.datatable.ordering.title') }}:
    </div>
    <VBtn
      variant="text"
      rounded="xl"
      size="small"
      append-icon="mdi-chevron-down"
    >
      {{ activeTitle }}
      <VMenu
        activator="parent"
        location="bottom"
        close-on-content-click
      >
        <VList
          density="compact"
          class="pa-0"
        >
          <VListItem
            v-for="item in options"
            :key="item.id"
            @click="onItemClick(item)"
          >
            <VListItemTitle :class="{ 'font-weight-bold': item.id === active }">
              {{ t(item.titleT) }}
            </VListItemTitle>
          </VListItem>
        </VList>
      </VMenu>
    </VBtn>
  </div>
</template>
