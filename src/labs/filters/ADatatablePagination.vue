<script lang="ts" setup>
import { computed, inject, watch } from 'vue'
import { isNull, isUndefined } from '@/utils/common'
import { useI18n } from 'vue-i18n'
import { DatatablePaginationKey } from '@/labs/filters/filterInjectionKeys'
import { useThrottleFn } from '@vueuse/core'

withDefaults(
  defineProps<{
    itemsPerPageOptions?: number[]
    hideRecordsPerPage?: boolean
  }>(),
  {
    itemsPerPageOptions: () => [10, 25, 50],
    hideRecordsPerPage: false,
  }
)
const emit = defineEmits<{
  (e: 'change'): void
}>()

const pagination = inject(DatatablePaginationKey)

if (isUndefined(pagination)) {
  throw new Error('Incorrect provide/inject config.')
}

const { t } = useI18n()

const lastPage = computed(() => {
  return Math.ceil(pagination.value.totalCount / pagination.value.rowsPerPage)
})

const displayedFrom = computed(() => {
  return pagination.value.page * pagination.value.rowsPerPage - pagination.value.rowsPerPage + 1
})

const displayedTo = computed(() => {
  return (
    pagination.value.page * pagination.value.rowsPerPage -
    pagination.value.rowsPerPage +
    pagination.value.currentViewCount
  )
})

const disabledFirstAndPrev = computed(() => {
  return pagination.value.page === 1
})

const disabledLast = computed(() => {
  return !isNull(pagination.value.hasNextPage) || pagination.value.page === lastPage.value
})

const disabledNext = computed(() => {
  return (
    (isNull(pagination.value.hasNextPage) && pagination.value.page === lastPage.value) ||
    pagination.value.hasNextPage === false
  )
})

const computedTotalCountText = computed(() => {
  if (!isNull(pagination.value.hasNextPage)) {
    return pagination.value.hasNextPage ? displayedTo.value + 1 + '+' : displayedTo.value
  }
  return pagination.value.totalCount
})

watch(
  () => pagination.value.rowsPerPage,
  (newValue, oldValue) => {
    if (newValue !== oldValue) {
      pagination.value.page = 1
      emit('change')
    }
  }
)

watch(
  () => pagination.value.page,
  (newValue, oldValue) => {
    if (newValue !== oldValue) {
      emit('change')
    }
  }
)

const onClickFirst = useThrottleFn(() => {
  pagination.value.page = 1
}, 300)

const onClickLast = useThrottleFn(() => {
  pagination.value.page = lastPage.value
}, 300)

const onClickPrev = useThrottleFn(() => {
  pagination.value.page = pagination.value.page - 1
}, 300)

const onClickNext = useThrottleFn(() => {
  pagination.value.page = pagination.value.page + 1
}, 300)
</script>

<template>
  <div class="anzu-data-footer">
    <div
      v-if="!hideRecordsPerPage"
      class="anzu-data-footer__page-limit"
    >
      {{ t('common.system.datatable.itemsPerPage') }}:
      <VBtnToggle
        v-model="pagination.rowsPerPage"
        class="ml-2"
        density="compact"
        mandatory
        data-cy="table-size"
      >
        <VBtn
          v-for="item in itemsPerPageOptions"
          :key="item"
          :color="item === pagination.rowsPerPage ? 'secondary' : ''"
          :value="item"
          density="compact"
          size="small"
          variant="text"
        >
          {{ item }}
        </VBtn>
      </VBtnToggle>
    </div>
    <div class="anzu-data-footer__pagination">
      {{ displayedFrom }} - {{ displayedTo }} {{ t('common.system.datatable.from') }} {{ computedTotalCountText }}
    </div>
    <div class="anzu-data-footer__icons-before">
      <VBtn
        :disabled="disabledFirstAndPrev"
        icon="mdi-page-first"
        size="small"
        variant="text"
        @click.stop="onClickFirst"
      />
      <VBtn
        :disabled="disabledFirstAndPrev"
        icon="mdi-chevron-left"
        size="small"
        variant="text"
        @click.stop="onClickPrev"
      />
    </div>
    <div class="current-page">
      <span>{{ pagination.page }}</span>
    </div>
    <div class="anzu-data-footer__icons-after">
      <VBtn
        :disabled="disabledNext"
        icon="mdi-chevron-right"
        size="small"
        variant="text"
        @click.stop="onClickNext"
      />
      <VBtn
        :disabled="disabledLast"
        icon="mdi-page-last"
        size="small"
        variant="text"
        @click.stop="onClickLast"
      />
    </div>
  </div>
</template>

<style lang="scss">
.anzu-data-footer {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  font-size: 0.75rem;
  padding: 0 8px;

  > div.current-page {
    padding-left: 10px;
    padding-right: 10px;
    user-select: none;
    min-width: 40px;
    display: flex;
    text-align: center;
    align-items: center;
    justify-content: center;
  }

  &__page-limit {
    display: flex;
    align-items: center;
    flex: 0 0 0;
    justify-content: flex-end;
    white-space: nowrap;
    margin-right: 14px;
  }

  &__pagination {
    display: block;
    text-align: center;
    margin: 0 32px 0 24px;
  }
}
</style>
