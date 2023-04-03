<script lang="ts" setup>
import { computed, watch } from 'vue'
import { cloneDeep, isNull } from '@/utils/common'
import type { Pagination } from '@/types/Pagination'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    modelValue: Pagination
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
  (e: 'update:modelValue', data: Pagination): void
}>()

const modelValueComputed = computed({
  get() {
    return props.modelValue
  },
  set(newValue: Pagination) {
    emit('update:modelValue', cloneDeep(newValue))
  },
})

const { t } = useI18n()

const lastPage = computed(() => {
  return Math.ceil(modelValueComputed.value.totalCount / modelValueComputed.value.rowsPerPage)
})

const displayedFrom = computed(() => {
  return modelValueComputed.value.page * modelValueComputed.value.rowsPerPage - modelValueComputed.value.rowsPerPage + 1
})

const displayedTo = computed(() => {
  return (
    modelValueComputed.value.page * modelValueComputed.value.rowsPerPage -
    modelValueComputed.value.rowsPerPage +
    modelValueComputed.value.currentViewCount
  )
})

const disabledFirstAndPrev = computed(() => {
  return modelValueComputed.value.page === 1
})

const disabledLast = computed(() => {
  return !isNull(modelValueComputed.value.hasNextPage) || modelValueComputed.value.page === lastPage.value
})

const disabledNext = computed(() => {
  return (
    (isNull(modelValueComputed.value.hasNextPage) && modelValueComputed.value.page === lastPage.value) ||
    modelValueComputed.value.hasNextPage === false
  )
})

const computedTotalCountText = computed(() => {
  if (!isNull(modelValueComputed.value.hasNextPage)) {
    return modelValueComputed.value.hasNextPage ? displayedTo.value + 1 + '+' : displayedTo.value
  }
  return modelValueComputed.value.totalCount
})

const rowsPerPageComputed = computed(() => {
  return modelValueComputed.value.rowsPerPage
})
watch(rowsPerPageComputed, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    modelValueComputed.value.page = 1
    emit('change')
  }
})
const pageComputed = computed(() => {
  return modelValueComputed.value.page
})
watch(pageComputed, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    emit('change')
  }
})

const onClickFirst = () => {
  modelValueComputed.value.page = 1
}

const onClickLast = () => {
  modelValueComputed.value.page = lastPage.value
}

const onClickPrev = () => {
  modelValueComputed.value.page = modelValueComputed.value.page - 1
}

const onClickNext = () => {
  modelValueComputed.value.page = modelValueComputed.value.page + 1
}
</script>

<template>
  <div class="anzu-data-footer">
    <div
      v-if="!hideRecordsPerPage"
      class="anzu-data-footer__page-limit"
    >
      {{ t('common.system.datatable.itemsPerPage') }}:
      <VBtnToggle
        v-model="modelValueComputed.rowsPerPage"
        class="ml-2"
        density="compact"
        mandatory
        data-cy="table-size"
      >
        <VBtn
          v-for="item in itemsPerPageOptions"
          :key="item"
          :color="item === modelValueComputed.rowsPerPage ? 'secondary' : ''"
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
      <span>{{ modelValueComputed.page }}</span>
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
