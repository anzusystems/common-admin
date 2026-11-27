<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AssetSelectListItem } from '@/domains/dam/assetSelect/store/assetSelectStore'
import AssetSelectSingleUseUsage from '@/domains/dam/assetSelect/components/AssetSelectSingleUseUsage.vue'
import { useAssetSelectUsageRefresh } from '@/domains/dam/assetSelect/composables/assetSelectSingleUseUsage'
import {
  formatSingleUseUsageCount,
  resolveSingleUseWarningCount,
} from '@/domains/dam/assetSelect/composables/assetSelectDisabledReason'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const props = withDefaults(
  defineProps<{
    item: AssetSelectListItem | undefined
    /** DAM configuration whose image configuration answers the usage. Inherited when not given. */
    configName?: string
  }>(),
  {
    configName: undefined,
  }
)

const TAB_METADATA = 'metadata'
const TAB_USAGE = 'usage'

const { t } = useI18n()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const activeTab = ref(TAB_METADATA)

const usageWarningCount = computed(() => (props.item ? resolveSingleUseWarningCount(props.item.asset) : 0))

const { usageLoading, hasUsage, refreshUsage } = useAssetSelectUsageRefresh(damConfigName)

// The usage is read anew on every opening of the tab and for every asset shown in it.
watch([activeTab, () => props.item?.asset.id], ([tab]) => {
  if (tab !== TAB_USAGE || !props.item || !hasUsage(props.item.asset)) return
  refreshUsage(props.item.asset)
})
</script>

<template>
  <template v-if="item && hasUsage(item.asset)">
    <VTabs
      v-model="activeTab"
      show-arrows
      class="sidebar-info__tabs"
    >
      <VTab :value="TAB_METADATA">
        {{ t('common.damImage.asset.detail.info.metadata') }}
      </VTab>
      <VTab
        :value="TAB_USAGE"
        data-cy="asset-select-usage-tab"
      >
        {{ t('common.assetSelect.usage.tab') }}
        <VChip
          v-if="usageWarningCount > 0"
          color="warning"
          variant="flat"
          size="x-small"
          class="ml-2"
        >
          {{ formatSingleUseUsageCount(usageWarningCount) }}
        </VChip>
      </VTab>
    </VTabs>
    <slot v-if="activeTab === TAB_METADATA" />
    <div
      v-else-if="usageLoading"
      class="d-flex align-center justify-center pa-3"
    >
      <VProgressCircular indeterminate />
    </div>
    <AssetSelectSingleUseUsage
      v-else
      :asset="item.asset"
      class="pa-3"
    />
  </template>
  <slot v-else />
</template>
