<script lang="ts" setup>
import type { Filter } from '@/types/Filter'
import type { Ref } from 'vue'
import { computed, ref, toRefs, watch } from 'vue'
import { isDocId, isEmpty, isInt, isString, isUndefined } from '@/utils/common'
import { useFilterHelpers } from '@/composables/filter/filterHelpers'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    filterId?: Filter | undefined
    filterDocId?: Filter | undefined
    filterText?: Filter | undefined
    filterUrl?: Filter | undefined
    filterOverrides?: Filter[] | undefined
    placeholder?: string | undefined
    dataCy?: string
  }>(),
  {
    filterId: undefined,
    filterDocId: undefined,
    filterText: undefined,
    filterUrl: undefined,
    filterOverrides: undefined,
    placeholder: undefined,
    dataCy: 'filter-mixed',
  }
)
const model = ref('')
const { filterId, filterText, filterDocId, filterUrl, filterOverrides } = toRefs(props)
const { t } = useI18n()

const filterActive = (filter: Ref<Filter | undefined> | undefined): filter is Ref<Filter> => {
  return !isUndefined(filter) && !isUndefined(filter.value)
}
const { clearOne } = useFilterHelpers()
const clearIfActive = (filter: Ref<Filter | undefined> | undefined) => {
  if (filterActive(filter)) {
    clearOne(filter.value)
  }
}
const clearAllActiveExcept = (exceptFilter: Ref<Filter | undefined> | undefined = undefined) => {
  if (exceptFilter?.value?.titleT !== filterId?.value?.titleT) {
    clearIfActive(filterId)
  }
  if (exceptFilter?.value?.titleT !== filterDocId?.value?.titleT) {
    clearIfActive(filterDocId)
  }
  if (exceptFilter?.value?.titleT !== filterText?.value?.titleT) {
    clearIfActive(filterText)
  }
  if (exceptFilter?.value?.titleT !== filterUrl?.value?.titleT) {
    clearIfActive(filterUrl)
  }
  if (!isUndefined(filterOverrides)) {
    filterOverrides.value?.forEach((filter) => {
      if (exceptFilter?.value?.titleT !== filter.titleT) {
        clearOne(filter)
      }
    })
  }
}
const overrideFilter: Ref<Filter | undefined> = ref(undefined)
watch(overrideFilter, () => {
  if (filterActive(overrideFilter)) {
    overrideFilter.value.model = model.value
    currentFilter.value = overrideFilter.value
    clearAllActiveExcept(overrideFilter)
    return
  }
  setFilters(model.value)
})
const currentFilter: Ref<Filter | undefined> = ref(undefined)
watch(model, (newModel: string) => {
  setFilters(newModel)
})
const setFilters = (newModel: string) => {
  if (filterActive(overrideFilter)) {
    overrideFilter.value.model = newModel
    return
  }
  const filter = autodetectFilter(newModel)
  if (!isUndefined(filter)) {
    filter.model = newModel
  }
  currentFilter.value = filter
  clearAllActiveExcept(currentFilter)
}
const autodetectFilter = (newModel: string): Filter | undefined => {
  if (isInt(newModel)) {
    if (filterActive(filterId)) {
      return filterId.value
    }
  }
  if (isDocId(newModel)) {
    if (filterActive(filterDocId)) {
      return filterDocId.value
    }
  }
  if (isString(newModel) && newModel.length > 0) {
    if (filterActive(filterUrl) && newModel.startsWith('http')) {
      return filterUrl.value
    }
    if (filterActive(filterText)) {
      return filterText.value
    }
  }
  return undefined
}

const label = computed(() => {
  if (filterActive(overrideFilter)) {
    return t(overrideFilter.value.titleT ?? '')
  }
  if (filterActive(currentFilter)) {
    return t(currentFilter.value.titleT ?? '')
  }
  const filterLabels = []
  if (filterActive(filterId)) {
    filterLabels.push(t(filterId.value.titleT ?? ''))
  }
  if (filterActive(filterDocId)) {
    filterLabels.push(t(filterDocId.value.titleT ?? ''))
  }
  if (filterActive(filterUrl)) {
    filterLabels.push(t(filterUrl.value.titleT ?? ''))
  }
  if (filterActive(filterText)) {
    filterLabels.push(t(filterText.value.titleT ?? ''))
  }
  return filterLabels.join('/')
})

const currentFilterModel = computed(() => {
  return currentFilter.value?.model
})
watch(currentFilterModel, (newModel) => {
  if (!isEmpty(model.value) && isEmpty(newModel)) {
    model.value = ''
  }
})

const placeholderComputed = computed(() => {
  if (!isUndefined(props.placeholder)) return props.placeholder
  if (currentFilter.value?.variant === 'startsWith') return t('common.model.filterPlaceholder.startsWith')
  if (currentFilter.value?.variant === 'eq') return t('common.model.filterPlaceholder.eq')
  if (currentFilter.value?.variant === 'contains' || currentFilter.value?.variant === 'search')
    return t('common.model.filterPlaceholder.contains')
  return ''
})
</script>

<template>
  <VTextField
    v-model="model"
    :label="label"
    :data-cy="dataCy"
    :placeholder="placeholderComputed"
  >
    <template
      v-if="filterOverrides"
      #append-inner
    >
      <VBtnToggle
        v-model="overrideFilter"
        divided
        class="override-toggle"
      >
        <VBtn
          v-for="(override, index) in filterOverrides"
          :key="index"
          size="small"
          :value="override"
        >
          {{ t(override.titleT ?? '') }}
        </VBtn>
      </VBtnToggle>
    </template>
  </VTextField>
</template>

<style lang="scss" scoped>
.override-toggle {
  height: 80%;
}
</style>
