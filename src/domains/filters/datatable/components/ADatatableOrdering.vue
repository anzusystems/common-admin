<script lang="ts" setup>
import { computed, inject, type Ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  type DatatableOrderingOption,
  type DatatableOrderingOptions,
  SORT_BY_SCORE,
} from '@/domains/filters/datatable/utils/datatableColumns'
import { SortOrder } from '@/domains/api/types/SortOrder'
import { isUndefined } from '@/shared/utils/common'
import { DatatablePaginationKey } from '@/domains/filters/utils/filterInjectionKeys'

import type { Pagination } from '@/domains/api/composables/pagination'

const props = withDefaults(
  defineProps<{
    variant?: 'id' | 'createdAt' | 'most-relevant'
    customOptions?: undefined | DatatableOrderingOptions
    paginationUpdateCustomCb?: ((option: DatatableOrderingOption, pagination: Ref<Pagination>) => void) | undefined
  }>(),
  {
    variant: 'id',
    customOptions: undefined,
    paginationUpdateCustomCb: undefined,
  }
)
const emit = defineEmits<{
  (e: 'sortByChange', data: DatatableOrderingOption): void
}>()

const modelValue = defineModel<number>('modelValue', {
  default: 1,
  required: false,
})

const pagination = inject(DatatablePaginationKey)

if (isUndefined(pagination)) {
  throw new Error('Incorrect provide/inject config.')
}

const { t } = useI18n()

const defaultItemsCreatedAt: DatatableOrderingOptions = [
  {
    id: 1,
    titleT: 'common.system.datatable.ordering.mostRecent',
    sortBy: { key: 'createdAt', order: SortOrder.Desc },
  },
  {
    id: 2,
    titleT: 'common.system.datatable.ordering.oldest',
    sortBy: { key: 'createdAt', order: SortOrder.Asc },
  },
]

const defaultItemsId: DatatableOrderingOptions = [
  {
    id: 1,
    titleT: 'common.system.datatable.ordering.mostRecent',
    sortBy: { key: 'id', order: SortOrder.Desc },
  },
  {
    id: 2,
    titleT: 'common.system.datatable.ordering.oldest',
    sortBy: { key: 'id', order: SortOrder.Asc },
  },
]

const defaultItemsMostRelevant: DatatableOrderingOptions = [
  {
    id: 3,
    titleT: 'common.system.datatable.ordering.mostRelevant',
    sortBy: { key: SORT_BY_SCORE, order: SortOrder.Desc },
  },
  {
    id: 1,
    titleT: 'common.system.datatable.ordering.mostRecent',
    sortBy: { key: 'createdAt', order: SortOrder.Desc },
  },
  {
    id: 2,
    titleT: 'common.system.datatable.ordering.oldest',
    sortBy: { key: 'createdAt', order: SortOrder.Asc },
  },
]

const activeTitle = computed(() => {
  const found = options.value.find((item: any) => item.id === modelValue.value)
  if (found) return t(found.titleT)
  return ''
})

const options = computed(() => {
  if (props.customOptions) return props.customOptions
  if (props.variant === 'most-relevant') return defaultItemsMostRelevant
  if (props.variant === 'id') return defaultItemsId
  return defaultItemsCreatedAt
})

const onItemClick = (item: DatatableOrderingOption) => {
  modelValue.value = item.id
}

const paginationUpdateDefault = (found: DatatableOrderingOption) => {
  if (!found.sortBy) {
    pagination.value = {
      ...pagination.value,
      sortBy: null,
    }
    emit('sortByChange', found)
    return
  }
  pagination.value.sortBy = found.sortBy
  emit('sortByChange', found)
}

watch(modelValue, (newValue, oldValue) => {
  if (newValue === oldValue) return
  const found = options.value.find((option) => {
    return option.id === newValue
  })
  if (isUndefined(found)) {
    return
  }
  if (isUndefined(props.paginationUpdateCustomCb)) {
    paginationUpdateDefault(found)
    return
  }
  props.paginationUpdateCustomCb(found, pagination)
})

// A getter, not the ref: the admins also set `pagination.value.sortBy` in place, which a shallow
// watch of the ref never sees.
watch(
  () => ({ key: pagination.value.sortBy?.key, order: pagination.value.sortBy?.order }),
  (newValue, oldValue) => {
    if (newValue.key === oldValue?.key && newValue.order === oldValue?.order) {
      return
    }
    const found = options.value.find((option) => {
      return newValue.key === option.sortBy?.key && newValue.order === option.sortBy?.order
    })
    if (isUndefined(found)) {
      return
    }
    modelValue.value = found.id
  },
  { immediate: true }
)
</script>

<template>
  <div class="d-flex align-center justify-center">
    <div class="text-body-small mr-1">{{ t('common.system.datatable.ordering.title') }}:</div>
    <VBtn
      variant="text"
      rounded="xl"
      size="small"
      class="text-medium-emphasis"
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
            <VListItemTitle :class="{ 'font-weight-bold': item.id === modelValue }">
              {{ t(item.titleT) }}
            </VListItemTitle>
          </VListItem>
        </VList>
      </VMenu>
    </VBtn>
  </div>
</template>
