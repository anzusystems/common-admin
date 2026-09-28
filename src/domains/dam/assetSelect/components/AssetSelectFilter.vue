<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { useAssetSelectActions } from '@/domains/dam/assetSelect/composables/assetSelectListActions'
import { computed, onMounted, provide, watch } from 'vue'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { storeToRefs } from 'pinia'
import AssetSelectFilterForm from '@/domains/dam/assetSelect/components/AssetSelectFilterForm.vue'
import { useAssetListFilter } from '@/domains/dam/assetSelect/filter/AssetFilter'
import { FilterConfigKey, FilterDataKey } from '@/domains/filters/utils/filterInjectionKeys'
import AFilterWrapperSubjectSelect from '@/domains/subjectSelect/components/AFilterWrapperSubjectSelect.vue'
import { useFilterHelpers } from '@/domains/filters/composables/filterFactory'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useSidebar } from '@/domains/dam/assetSelect/composables/assetSelectFilterSidebar'

const props = withDefaults(
  defineProps<{
    configName?: string
  }>(),
  {
    configName: 'default',
  }
)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { assetListEnabledFilters } = useCommonAdminCoreDamOptions(props.configName)

const { t } = useI18n()
const { mdAndDown } = useDisplay()
const { closeSidebarLeft } = useSidebar()
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
  if (mdAndDown.value) closeSidebarLeft()
}

const resetFilterAction = () => {
  resetFilter(pagination, resetAssetList)
  if (mdAndDown.value) closeSidebarLeft()
}

const componentComputed = computed(() => {
  switch (assetSelectStore.assetType) {
    default:
      return AssetSelectFilterForm
  }
})

watch(selectedLicenceId, (newValue, oldValue) => {
  if (newValue === oldValue) return
  resetFilterAction()
})

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
          <component
            :is="componentComputed"
            :enabled-filters="assetListEnabledFilters"
            :config-name="configName"
          />
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
        <component
          :is="componentComputed"
          :enabled-filters="assetListEnabledFilters"
          :config-name="configName"
        />
      </AFilterWrapperSubjectSelect>
    </div>
  </div>
</template>
