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
import type { ValueObjectOption } from '@/types/ValueObject'
import { isBoolean, isDefined, isUndefined } from '@/utils/common'
import { type FilterStoreIdentifier, useFilterClearHelpers } from '@/labs/filters/filterFactory'
import { datatableSlotName } from '@/components/datatable/datatable'
import FilterDetailItem from '@/labs/filters/FilterDetailItem.vue'
import FilterBookmarks from '@/labs/filters/FilterBookmarks.vue'
import type { IntegerIdNullable } from '@/types/common'
import type { AxiosInstance } from 'axios'
import AFilterBookmarkButton from '@/components/buttons/filter/AFilterBookmarkButton.vue'

const props = withDefaults(
  defineProps<{
    hideButtons?: boolean
    formName?: string
    disableFilterUrlSync?: boolean
    userId?: IntegerIdNullable | undefined
    client?: (() => AxiosInstance) | undefined
    store?: FilterStoreIdentifier | boolean // false to disable, FilterStoreIdentifier to custom store key
  }>(),
  {
    hideButtons: false,
    formName: 'search',
    disableFilterUrlSync: false,
    userId: undefined,
    client: undefined,
    store: true,
  },
)
const emit = defineEmits<{
  (e: 'submit'): void
  (e: 'reset'): void
  (e: 'bookmarkLoadAfter'): void
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

const identifier = ref<Partial<FilterStoreIdentifier>>({
  system: filterConfig.general.system,
  subject: filterConfig.general.subject,
})
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
if (!isBoolean(props.store)) {
  identifier.value.system = props.store.system
  identifier.value.subject = props.store.subject
} else if (false === props.store) {
  identifier.value.system = undefined
  identifier.value.subject = undefined
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

const { clearAll, clearAllFilterSelected } = useFilterClearHelpers()

const submitFilterBookmark = () => {
  nextTick(() => {
    submitResetCounter.value++
    emit('bookmarkLoadAfter')
  })
}

const resetFilter = () => {
  clearAll(filterData, filterConfig)
  clearAllFilterSelected(filterData, filterConfig, filterSelected)
  nextTick(() => {
    submitResetCounter.value++
    emit('reset')
  })
}

const touched = computed(() => {
  return filterConfig.touched
})

const renderedFieldNames = computed(() => {
  return Object.entries(filterConfig.fields)
    .filter(([, field]) => !field.render.skip)
    .map(([fieldName]) => fieldName)
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
    <div class="subject-select-filter__content px-2 py-4">
      <slot name="bookmarks">
        <VRow density="compact">
          <VCol v-if="store && userId && isDefined(client)">
            <div class="d-flex flex-wrap align-center">
              <FilterBookmarks
                v-if="identifier.system && identifier.subject && userId && isDefined(client)"
                v-model:datatable-hidden-columns="datatableHiddenColumns"
                :client="client"
                :system="identifier.system"
                :subject="identifier.subject"
                :user-id="userId"
                @submit="submitFilterBookmark"
              />
            </div>
          </VCol>
        </VRow>
      </slot>
      <slot name="detail">
        <VRow>
          <VCol
            v-for="fieldName in renderedFieldNames"
            :key="fieldName"
            :cols="filterConfig.fields[fieldName].render.xs || 12"
            :sm="filterConfig.fields[fieldName].render.sm || 12"
            :md="filterConfig.fields[fieldName].render.md || 12"
            :lg="filterConfig.fields[fieldName].render.lg || 12"
            :xl="filterConfig.fields[fieldName].render.xl || 12"
          >
            <slot
              :name="datatableSlotName(fieldName)"
              :item-config="filterConfig.fields[fieldName]"
            >
              <FilterDetailItem :name="fieldName" />
            </slot>
          </VCol>
        </VRow>
      </slot>
    </div>
    <div
      v-if="!hideButtons"
      class="subject-select-filter__actions"
    >
      <slot name="buttons">
        <AFilterSubmitButton :touched="touched" />
        <AFilterResetButton @reset="resetFilter" />
        <AFilterBookmarkButton
          v-if="identifier.system && identifier.subject && userId && isDefined(client)"
          :client="client"
          :user="userId"
          :system="identifier.system"
          :subject="identifier.subject"
          :datatable-hidden-columns="datatableHiddenColumns"
        />
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
}
</style>
