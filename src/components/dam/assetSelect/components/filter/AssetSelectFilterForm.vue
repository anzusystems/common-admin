<script lang="ts" setup>
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import { computed, watch } from 'vue'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { storeToRefs } from 'pinia'
import AFilterBooleanSelect from '@/labs/filters/AFilterBooleanSelect.vue'
import AFilterString from '@/labs/filters/AFilterString.vue'
import DamKeywordFilterRemoteAutocomplete from '@/components/damImage/uploadQueue/keyword/DamKeywordFilterRemoteAutocomplete.vue'
import type { IntegerId } from '@/types/common'
import DamAuthorFilterRemoteAutocomplete from '@/components/damImage/uploadQueue/author/DamAuthorFilterRemoteAutocomplete.vue'
import DamUserFilterRemoteAutocomplete from '@/components/dam/user/DamUserFilterRemoteAutocomplete.vue'
import AssetDistributionServiceNameFilter from '@/components/dam/assetSelect/components/filter/AssetDistributionServiceNameFilter.vue'
import { DamAssetType } from '@/types/coreDam/Asset'
import FilterPodcastRemoteAutocomplete from '@/components/dam/assetSelect/components/filter/FilterPodcastRemoteAutocomplete.vue'
import AFilterTimeInterval from '@/labs/filters/AFilterTimeInterval.vue'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'

const props = withDefaults(
  defineProps<{
    cols?: number | string
    useConfigLayout?: boolean
    hideTextSearch?: boolean
    enabledFilters?: string[] | undefined
    configName?: string
  }>(),
  {
    cols: 12,
    useConfigLayout: false,
    hideTextSearch: false,
    enabledFilters: undefined,
    configName: 'default',
  },
)

const { filterData, filterConfig } = useAssetSelectActions()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { assetListEnabledFilters } = useCommonAdminCoreDamOptions(props.configName)

const isFilterEnabled = (name: string) => {
  const filters = props.enabledFilters ?? assetListEnabledFilters
  if (!filters) return true
  return filters.includes(name)
}

const colProps = (name: keyof typeof filterConfig.fields) => {
  if (!props.useConfigLayout) {
    return { cols: props.cols }
  }
  const render = filterConfig.fields[name]?.render
  return {
    cols: render?.xs || 12,
    sm: render?.sm || 6,
    md: render?.md || 4,
    lg: render?.lg || 3,
    xl: render?.xl || 2,
  }
}

const assetSelectStore = useAssetSelectStore()
const { selectConfig, selectedLicenceId, assetType } = storeToRefs(assetSelectStore)

const extSystem = computed<IntegerId | undefined>(() => {
  const found = selectConfig.value.find((config) => config.licence === selectedLicenceId.value)
  if (found) {
    return found.extSystem
  }
  return undefined
})

watch(extSystem, (newValue, oldValue) => {
  if (newValue !== oldValue) {
    filterData.keywordIds = []
    filterData.authorIds = []
  }
})
</script>

<template>
  <VRow>
    <VCol
      v-if="!hideTextSearch && isFilterEnabled('text')"
      v-bind="colProps('text')"
    >
      <AFilterString name="text" />
    </VCol>
    <VCol
      v-if="isFilterEnabled('assetAndMainFileIds')"
      v-bind="colProps('assetAndMainFileIds')"
    >
      <AFilterString name="assetAndMainFileIds" />
    </VCol>
    <template v-if="extSystem">
      <VCol
        v-if="isFilterEnabled('keywordIds')"
        v-bind="colProps('keywordIds')"
      >
        <DamKeywordFilterRemoteAutocomplete
          :key="extSystem"
          name="keywordIds"
          :ext-system="extSystem"
        />
      </VCol>
      <VCol
        v-if="isFilterEnabled('authorIds')"
        v-bind="colProps('authorIds')"
      >
        <DamAuthorFilterRemoteAutocomplete
          :key="extSystem"
          name="authorIds"
          :ext-system="extSystem"
        />
      </VCol>
    </template>
    <VCol
      v-if="isFilterEnabled('createdByIds')"
      v-bind="colProps('createdByIds')"
    >
      <DamUserFilterRemoteAutocomplete name="createdByIds" />
    </VCol>
    <VCol
      v-if="isFilterEnabled('described')"
      v-bind="colProps('described')"
    >
      <AFilterBooleanSelect name="described" />
    </VCol>
    <VCol
      v-if="isFilterEnabled('visible')"
      v-bind="colProps('visible')"
    >
      <AFilterBooleanSelect name="visible" />
    </VCol>
    <VCol
      v-if="isFilterEnabled('generatedBySystem')"
      v-bind="colProps('generatedBySystem')"
    >
      <AFilterBooleanSelect name="generatedBySystem" />
    </VCol>
    <VCol
      v-if="
        (assetType === DamAssetType.Audio || assetType === DamAssetType.Video) &&
          isFilterEnabled('distributedInServices')
      "
      v-bind="colProps('distributedInServices')"
    >
      <AssetDistributionServiceNameFilter
        :key="selectedLicenceId"
        name="distributedInServices"
      />
    </VCol>
    <VCol
      v-if="assetType === DamAssetType.Audio && isFilterEnabled('podcastIds')"
      v-bind="colProps('podcastIds')"
    >
      <FilterPodcastRemoteAutocomplete
        :key="selectedLicenceId"
        :licence-id="selectedLicenceId"
        name="podcastIds"
      />
    </VCol>
    <VCol
      v-if="isFilterEnabled('createdAtFrom')"
      v-bind="colProps('createdAtFrom')"
    >
      <AFilterTimeInterval
        name-from="createdAtFrom"
        name-until="createdAtUntil"
      />
    </VCol>
  </VRow>
</template>
