<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import { computed, onMounted, provide, watch } from 'vue'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { storeToRefs } from 'pinia'
import AssetSelectFilterForm from '@/components/dam/assetSelect/components/filter/AssetSelectFilterForm.vue'
import { useAssetListFilter } from '@/model/coreDam/filter/AssetFilter'
import { FilterConfigKey, FilterDataKey } from '@/labs/filters/filterInjectionKeys'
import AFilterWrapperSubjectSelect from '@/labs/subjectSelect/AFilterWrapperSubjectSelect.vue'
import { useFilterHelpers } from '@/labs/filters/filterFactory'

const { t } = useI18n()
const { fetchAssetListDebounced, resetAssetList, pagination } = useAssetSelectActions()

const assetSelectStore = useAssetSelectStore()
const { selectedLicenceId, selectConfig } = storeToRefs(assetSelectStore)

const { filterData, filterConfig } = useAssetListFilter()
provide(FilterConfigKey, filterConfig)
provide(FilterDataKey, filterData)

const { resetFilter, submitFilter } = useFilterHelpers(filterData, filterConfig, {
  populateUrlParams: false,
  storeFiltersLocalStorage: false,
})

const submitFilterAction = () => {
  submitFilter(pagination, fetchAssetListDebounced)
}

const resetFilterAction = () => {
  resetFilter(pagination, resetAssetList)
}

const componentComputed = computed(() => {
  switch (assetSelectStore.assetType) {
    default:
      return AssetSelectFilterForm
  }
})

watch(
  selectedLicenceId,
  (newValue, oldValue) => {
    if (newValue === oldValue) return
    resetFilterAction()
  },
)

onMounted(() => {
  fetchAssetListDebounced()
})
</script>

<template>
  <div class="subject-select-filter">
    <div class="subject-select-filter__content">
      <AFilterWrapperSubjectSelect
        @submit="submitFilterAction"
        @reset="resetFilterAction"
      >
        <template #detail>
          <VRow v-if="selectConfig.length > 1">
            <VCol :cols="12">
              <VSelect
                v-model="selectedLicenceId"
                :label="t('common.assetSelect.filter.licence')"
                :items="selectConfig"
                item-title="licenceName"
                item-value="licence"
                hide-details
              />
            </VCol>
          </VRow>
          <component :is="componentComputed" />
        </template>
        <VRow v-if="selectConfig.length > 1">
          <VCol :cols="12">
            <VSelect
              v-model="selectedLicenceId"
              :label="t('common.assetSelect.filter.licence')"
              :items="selectConfig"
              item-title="licenceName"
              item-value="licence"
            />
          </VCol>
        </VRow>
        <component :is="componentComputed" />
      </AFilterWrapperSubjectSelect>
    </div>
  </div>
</template>
