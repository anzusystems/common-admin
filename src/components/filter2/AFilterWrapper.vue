<script lang="ts" setup>
import AFilterAdvancedButton from '@/components/buttons/filter/AFilterAdvancedButton.vue'
import AFilterSubmitButton from '@/components/buttons/filter/AFilterSubmitButton.vue'
import AFilterResetButton from '@/components/buttons/filter/AFilterResetButton.vue'
import { inject, nextTick, provide, ref } from 'vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedFutureKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
  FilterTouchedKey,
} from '@/components/filter2/filterInjectionKeys'
import FiltersSelected from '@/components/filter2/FiltersSelected.vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import { isUndefined } from '@/utils/common'
import { useFilterHelpers } from '@/composables/filter/filterFactory'
import { datatableSlotName } from '@/components/datatable/datatable.ts'
import FilterDetailItem from '@/components/filter2/FilterDetailItem.vue'
import AFilterBookmarkButton from '@/components/buttons/filter/AFilterBookmarkButton.vue'
import FilterBookmarks from '@/components/filter2/FilterBookmarks.vue'
import FilterBookmarkDialog from '@/components/filter2/FilterBookmarkDialog.vue'

withDefaults(
  defineProps<{
    enableTop?: boolean
    hideButtons?: boolean
    formName?: string
  }>(),
  {
    enableTop: false,
    hideButtons: false,
    formName: 'search',
  }
)
const emit = defineEmits<{
  (e: 'submit'): void
  (e: 'reset'): void
}>()

const showDetail = defineModel<boolean>('showDetail', { default: true, required: false })
const touched = defineModel<boolean>('touched', { default: false, required: false })
const bookmarkDialog = defineModel<boolean>('bookmarkDialog', { default: false, required: false })

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
const filterSelectedFuture = ref<Map<string, ValueObjectOption<string | number>[]>>(new Map())
provide(FilterSelectedFutureKey, filterSelectedFuture)

const submitFilter = () => {
  touched.value = false
  submitResetCounter.value++
  nextTick(() => {
    // filterSelectedFuture.value.clear()
    emit('submit')
  })
}

const { clearAll } = useFilterHelpers()

const resetFilter = () => {
  touched.value = false
  clearAll(filterData, filterConfig)
  filterSelected.value.clear()
  filterSelectedFuture.value.clear()
  nextTick(() => {
    submitResetCounter.value++
    emit('reset')
  })
}

const toggleFilterDetail = () => {
  showDetail.value = !showDetail.value
}
</script>

<template>
  {{ filterSelected }}
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
      <VCol>
        <slot name="bookmarks">
          <div class="d-flex flex-wrap align-center">
            <FilterBookmarks />
          </div>
        </slot>
      </VCol>
    </VRow>
    <VRow dense>
      <VCol cols="auto">
        <AFilterAdvancedButton
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
      </VCol>
      <VCol
        v-if="!hideButtons"
        class="text-right"
        cols="auto"
      >
        <slot name="buttons">
          <AFilterSubmitButton :touched="touched" />
          <AFilterResetButton @reset="resetFilter" />
          <AFilterBookmarkButton @on-click="bookmarkDialog = true" />
          <FilterBookmarkDialog
            v-if="bookmarkDialog"
            @on-close="bookmarkDialog = false"
          />
        </slot>
      </VCol>
    </VRow>
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
