<script lang="ts" setup>
import AFilterSubmitButton from '@/components/buttons/filter/AFilterSubmitButton.vue'
import AFilterResetButton from '@/components/buttons/filter/AFilterResetButton.vue'
import { computed, inject, nextTick, provide, ref } from 'vue'
import {
  FilterConfigKey,
  FilterDataKey,
  FilterSelectedKey,
  FilterSubmitResetCounterKey,
} from '@/labs/filters/filterInjectionKeys'
import FiltersSelected from '@/labs/filters/FiltersSelected.vue'
import type { ValueObjectOption } from '@/types/ValueObject'
import { isBoolean, isDefined, isUndefined } from '@/utils/common'
import { type FilterStoreIdentifier, useFilterClearHelpers } from '@/labs/filters/filterFactory'
import { datatableSlotName } from '@/components/datatable/datatable'
import FilterDetailItem from '@/labs/filters/FilterDetailItem.vue'
import AFilterBookmarkButton from '@/components/buttons/filter/AFilterBookmarkButton.vue'
import FilterBookmarks from '@/labs/filters/FilterBookmarks.vue'
import type { IntegerIdNullable } from '@/types/common'
import { type AxiosInstance } from 'axios'

const props = withDefaults(
  defineProps<{
    enableTop?: boolean
    hideButtons?: boolean
    formName?: string
    disableFilterUrlSync?: boolean
    userId?: IntegerIdNullable | undefined
    client?: (() => AxiosInstance) | undefined
    store?: FilterStoreIdentifier | boolean // false to disable, FilterStoreIdentifier to custom store key
  }>(),
  {
    enableTop: false,
    hideButtons: false,
    formName: 'search',
    disableFilterUrlSync: false,
    userId: undefined,
    client: undefined,
    store: true,
  }
)
const emit = defineEmits<{
  (e: 'submit'): void
  (e: 'bookmarkLoadAfter'): void
  (e: 'reset'): void
}>()

const datatableHiddenColumns = defineModel<string[] | undefined>('datatableHiddenColumns', {
  default: undefined,
  required: false,
})

const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)
if (isUndefined(filterConfig) || isUndefined(filterData)) {
  throw new Error('Incorrect provide/inject config.')
}
let system = filterConfig.general.system
let subject = filterConfig.general.subject
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
if (!isBoolean(props.store)) {
  system = props.store.system
  subject = props.store.subject
} else if (false === props.store) {
  system = undefined
  subject = undefined
}
const submitResetCounter = ref(0)
provide(FilterSubmitResetCounterKey, submitResetCounter)
const filterSelected = ref<Map<string, ValueObjectOption<string | number>[]>>(new Map())
provide(FilterSelectedKey, filterSelected)

const submitFilter = () => {
  submitResetCounter.value++
  nextTick(() => {
    emit('submit')
  })
}

const { clearAll } = useFilterClearHelpers()

const submitFilterBookmark = () => {
  nextTick(() => {
    submitResetCounter.value++
    emit('bookmarkLoadAfter')
  })
}

const resetFilter = () => {
  clearAll(filterData, filterConfig)
  filterSelected.value.clear()
  nextTick(() => {
    submitResetCounter.value++
    emit('reset')
  })
}

const touched = computed(() => {
  return filterConfig.touched
})

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
      <VCol v-if="store && userId && isDefined(client)">
        <slot name="bookmarks">
          <div class="d-flex flex-wrap align-center">
            <FilterBookmarks
              v-if="system && subject && userId && isDefined(client)"
              v-model:datatable-hidden-columns="datatableHiddenColumns"
              :client="client"
              :system="system"
              :subject="system"
              :user-id="userId"
              @submit="submitFilterBookmark"
            />
          </div>
        </slot>
      </VCol>
    </VRow>
    <VRow dense>
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
            v-if="system && subject && userId && isDefined(client)"
            :client="client"
            :user="userId"
            :system="system"
            :subject="subject"
            :datatable-hidden-columns="datatableHiddenColumns"
          />
        </slot>
      </VCol>
    </VRow>
    <div>
      <slot name="detail">
        <VRow>
          <VCol
            v-for="field in filterConfig.fields"
            :key="field.name"
            :cols="field.render.xs || 12"
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
