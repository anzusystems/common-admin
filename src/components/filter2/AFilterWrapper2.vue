<script lang="ts" setup>
import AFilterAdvancedButton2 from '@/components/buttons/filter/AFilterAdvancedButton2.vue'
import AFilterSubmitButton from '@/components/buttons/filter/AFilterSubmitButton.vue'
import AFilterResetButton from '@/components/buttons/filter/AFilterResetButton.vue'
import { inject, nextTick, provide, ref } from 'vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
  FilterTouchedKey,
} from '@/components/filter2/filterInjectionKeys'
import FiltersSelected from '@/components/filter2/FiltersSelected.vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import { isDefined, isUndefined } from '@/utils/common'
import { useFilterClearHelpers } from '@/composables/filter/filterFactory'
import { datatableSlotName } from '@/components/datatable/datatable'
import FilterDetailItem from '@/components/filter2/FilterDetailItem.vue'
import AFilterBookmarkButton from '@/components/buttons/filter/AFilterBookmarkButton.vue'
import FilterBookmarks from '@/components/filter2/FilterBookmarks.vue'
import type { IntegerIdNullable } from '@/types/common'
import type { AxiosInstance } from 'axios'
import type { DatatableSortBy } from '@/composables/system/datatableColumns.ts'

withDefaults(
  defineProps<{
    enableTop?: boolean
    hideButtons?: boolean
    formName?: string
    disableFilterUrlSync?: boolean
    system?: string | undefined
    userId?: IntegerIdNullable | undefined
    client?: (() => AxiosInstance) | undefined
    bookmarkSystemResource?: string | undefined
  }>(),
  {
    enableTop: false,
    hideButtons: false,
    formName: 'search',
    disableFilterUrlSync: false,
    system: undefined,
    userId: undefined,
    client: undefined,
    bookmarkSystemResource: undefined,
  }
)
const emit = defineEmits<{
  (e: 'submit'): void
  (e: 'reset'): void
}>()

const datatableHiddenColumns = defineModel<string[] | undefined>('datatableHiddenColumns', {
  default: undefined,
  required: false,
})
const datatableSortBy = defineModel<DatatableSortBy>('datatableSortBy', {
  default: undefined,
  required: false,
})
const showDetail = defineModel<boolean>('showDetail', { default: false, required: false })
const touched = defineModel<boolean>('touched', { default: false, required: false })

provide(FilterTouchedKey, touched)
const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)
if (isUndefined(filterConfig) || isUndefined(filterData)) {
  throw new Error('Incorrect provide/inject config.')
}
const submitResetCounter = ref(0)
provide(FilterSubmitResetCounterKey, submitResetCounter)
const filterSelected = ref<Map<string, ValueObjectOption<string | number>[]>>(new Map())
provide(FilterSelectedKey, filterSelected)

const submitFilter = () => {
  touched.value = false
  submitResetCounter.value++
  nextTick(() => {
    emit('submit')
  })
}

const { clearAll } = useFilterClearHelpers()

const resetFilter = () => {
  touched.value = false
  clearAll(filterData, filterConfig)
  filterSelected.value.clear()
  nextTick(() => {
    submitResetCounter.value++
    emit('reset')
  })
}

const toggleFilterDetail = () => {
  showDetail.value = !showDetail.value
}

defineExpose({
  submit: submitFilter,
  reset: resetFilter,
})
</script>

<template>
  <VForm
    :name="formName"
    @submit.prevent="submitFilter"
  >
    <VRow
      v-if="enableTop"
      dense
    >
      <VCol>
        <slot name="top" />
      </VCol>
    </VRow>
    <VRow dense>
      <VCol v-if="bookmarkSystemResource && userId && system && isDefined(client)">
        <slot name="bookmarks">
          <div class="d-flex flex-wrap align-center">
            <FilterBookmarks
              v-model:datatable-hidden-columns="datatableHiddenColumns"
              v-model:datatable-sort-by="datatableSortBy"
              :client="client"
              :system="system"
              :user="userId"
              :system-resource="bookmarkSystemResource"
              @submit="emit('submit')"
            />
          </div>
        </slot>
      </VCol>
    </VRow>
    <VRow dense>
      <VCol cols="auto">
        <AFilterAdvancedButton2
          :button-active="showDetail"
          @advanced-filter="toggleFilterDetail"
        />
      </VCol>
      <VCol>
        <div class="a-filter__container">
          <div class="a-filter__search">
            <slot name="search" />
          </div>
          <FiltersSelected />
        </div>
      </VCol>
      <VCol
        v-if="!hideButtons"
        class="text-right"
        cols="auto"
      >
        <slot name="buttons">
          <AFilterSubmitButton :touched="touched" />
          <AFilterResetButton @reset="resetFilter" />
          <AFilterBookmarkButton
            v-if="bookmarkSystemResource && userId && system && isDefined(client)"
            :client="client"
            :system="system"
            :user="userId"
            :system-resource="bookmarkSystemResource"
            :datatable-hidden-columns="datatableHiddenColumns"
            :datatable-sort-by="datatableSortBy"
          />
        </slot>
      </VCol>
    </VRow>
    <div>
      <VSlideYTransition>
        <div
          v-show="showDetail"
          class="mt-6 pa-4 system-border-a"
        >
          <slot name="detail">
            <VRow>
              <VCol
                v-for="field in filterConfig.fields"
                :key="field.name"
                :cols="field.render.xs"
                :sm="field.render.sm"
                :md="field.render.md"
                :lg="field.render.lg"
                :xl="field.render.xl"
                :class="{ 'd-none': field.render.skip }"
              >
                <slot
                  :name="datatableSlotName(field.name)"
                  :item-config="field"
                >
                  <FilterDetailItem :name="field.name" />
                </slot>
              </VCol>
            </VRow>
          </slot>
        </div>
      </VSlideYTransition>
    </div>
  </VForm>
</template>

<style lang="scss">
@use 'vuetify/tools' as *;

.a-filter {
  &__container {
    width: 100%;
  }

  &__search {
    display: inline-flex;
    vertical-align: middle;
    min-width: 100%;
    height: 34px;

    @include media-breakpoint-up(sm) {
      min-width: 50%;
      margin-right: 8px;
    }

    @include media-breakpoint-up(md) {
      min-width: 40%;
    }

    @include media-breakpoint-up(lg) {
      min-width: 30%;
    }
  }
}
</style>
