<script lang="ts" setup>
import type { Filter } from '@/types/Filter'
import type { Ref } from 'vue'
import { computed, ref, toRefs, watch } from 'vue'
import { isDocId, isEmpty, isInt, isString, isUndefined } from '@/utils/common'
import { useFilterHelpers } from '@/composables/filter/filterHelpers'

// note: not using for now, needs more UX work as now we can't filter number in text or url in text, etc.
// use after these UX/product issues will be resolved
// todo: add translation for titleT

const props = withDefaults(
  defineProps<{
    filterId?: Filter | undefined
    filterDocId?: Filter | undefined
    filterText?: Filter | undefined
    filterUrl?: Filter | undefined
    filterOverrides?: Filter[] | undefined
  }>(),
  {
    filterId: undefined,
    filterDocId: undefined,
    filterText: undefined,
    filterUrl: undefined,
    filterOverrides: undefined,
  }
)
const model = ref('')
const { filterId, filterText, filterDocId, filterUrl, filterOverrides } = toRefs(props)

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
    return overrideFilter.value.titleT
  }
  if (filterActive(currentFilter)) {
    return currentFilter.value.titleT
  }
  const filterLabels = []
  if (filterActive(filterId)) {
    filterLabels.push(filterId.value.titleT)
  }
  if (filterActive(filterDocId)) {
    filterLabels.push(filterDocId.value.titleT)
  }
  if (filterActive(filterUrl)) {
    filterLabels.push(filterUrl.value.titleT)
  }
  if (filterActive(filterText)) {
    filterLabels.push(filterText.value.titleT)
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
</script>

<template>
  <VTextField
    v-model="model"
    :label="label"
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
          {{ override.titleT }}
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
