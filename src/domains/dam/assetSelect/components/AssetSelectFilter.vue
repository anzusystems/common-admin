<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { useAssetSelectActions } from '@/domains/dam/assetSelect/composables/assetSelectListActions'
import { computed, onMounted, provide, watch } from 'vue'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import AssetSelectFilterForm from '@/domains/dam/assetSelect/components/AssetSelectFilterForm.vue'
import { useAssetListFilter } from '@/domains/dam/assetSelect/filter/AssetFilter'
import { FilterConfigKey, FilterDataKey } from '@/domains/filters/utils/filterInjectionKeys'
import AFilterWrapperSubjectSelect from '@/domains/subjectSelect/components/AFilterWrapperSubjectSelect.vue'
import { useFilterHelpers } from '@/domains/filters/composables/filterFactory'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useSidebar } from '@/domains/dam/assetSelect/composables/assetSelectFilterSidebar'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'
import type { IntegerId } from '@/shared/types/common'
import { useAssetSelectPresetControl } from '@/domains/dam/assetSelect/composables/assetSelectPresetControl'

const props = withDefaults(
  defineProps<{
    configName?: string
    listViews?: IntegerId[]
  }>(),
  {
    configName: undefined,
    listViews: () => [],
  }
)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const { assetListEnabledFilters } = useCommonAdminCoreDamOptions(damConfigName)

const { t } = useI18n()
const { mdAndDown } = useDisplay()
const {
  items: presetItems,
  showPresets,
  selectedPresetKey,
  applyPreset,
  // Host configuration, read when the picker opens.
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
} = useAssetSelectPresetControl(props.listViews, damConfigName)
const { closeSidebarLeft } = useSidebar()
const { fetchAssetListDebounced, resetAssetList, pagination } = useAssetSelectActions(damConfigName)

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

// The first choice applied when the picker opens is no change by the user: the filter and the sidebar stay.
// Only that one is skipped; a later choice after the licences were cleared resets as any other.
let openingChoice = true
watch(
  () => assetSelectStore.selectedLicenceIds,
  (newValue, oldValue) => {
    const isOpeningChoice = openingChoice && oldValue.length === 0
    openingChoice = false
    if (isOpeningChoice) return
    resetFilterAction()
  }
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
          <VRow v-if="showPresets">
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
            :config-name="damConfigName"
          />
        </template>
      </AFilterWrapperSubjectSelect>
    </div>
  </div>
</template>
