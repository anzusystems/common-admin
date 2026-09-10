<script lang="ts" setup>
import { useDisplay } from 'vuetify'
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import { computed, onMounted, provide } from 'vue'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import AssetSelectFilterForm from '@/components/dam/assetSelect/components/filter/AssetSelectFilterForm.vue'
import { useAssetListFilter } from '@/model/coreDam/filter/AssetFilter'
import { FilterConfigKey, FilterDataKey } from '@/labs/filters/filterInjectionKeys'
import AFilterWrapperSubjectSelect from '@/labs/subjectSelect/AFilterWrapperSubjectSelect.vue'
import { useFilterHelpers } from '@/labs/filters/filterFactory'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useSidebar } from '@/components/dam/assetSelect/composables/assetSelectFilterSidebar'
import { useI18n } from 'vue-i18n'
import type { IntegerId } from '@/types/common'
import { useAssetSelectPresetControl } from '@/components/dam/assetSelect/composables/assetSelectPresetControl'

const props = withDefaults(
  defineProps<{
    configName?: string
    selectLicences?: IntegerId[]
    listViews?: IntegerId[]
  }>(),
  {
    configName: 'default',
    selectLicences: () => [],
    listViews: () => [],
  },
)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { assetListEnabledFilters } = useCommonAdminCoreDamOptions(props.configName)

const { t } = useI18n()
const { mdAndDown } = useDisplay()

// The selection control sits with the other filter fields; the chips above the list only show its result.
// Host configuration, not expected to change after mount.
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { selectLicences, listViews } = props

const {
  items: presetItems,
  selectedPresetKey,
  applyPreset,
} = useAssetSelectPresetControl(selectLicences, listViews)
const showPresetSelect = computed(() => selectLicences.length > 1 || listViews.length > 0)
const { closeSidebarLeft } = useSidebar()
const { fetchAssetListDebounced, resetAssetList, pagination } = useAssetSelectActions()

const assetSelectStore = useAssetSelectStore()

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
          <VRow v-if="showPresetSelect">
            <VCol :cols="12">
              <VSelect
                :model-value="selectedPresetKey"
                :items="presetItems"
                :label="t('common.assetSelect.preset.label')"
                hide-details
                @update:model-value="applyPreset"
              />
            </VCol>
          </VRow>
          <component
            :is="componentComputed"
            :enabled-filters="assetListEnabledFilters"
            :config-name="configName"
          />
        </template>
      </AFilterWrapperSubjectSelect>
    </div>
  </div>
</template>
