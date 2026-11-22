<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AssetSelectListItem } from '@/services/stores/coreDam/assetSelectStore'
import AssetSelectSingleUseUsage from '@/components/dam/assetSelect/components/AssetSelectSingleUseUsage.vue'
import { useAssetSelectUsageRefresh } from '@/components/dam/assetSelect/composables/assetSelectSingleUseUsage'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'

const props = withDefaults(
  defineProps<{
    item: AssetSelectListItem | undefined
    configName?: string
  }>(),
  {
    configName: 'default',
  },
)

const TAB_METADATA = 'metadata'
const TAB_USAGE = 'usage'

const { t } = useI18n()

const activeTab = ref(TAB_METADATA)

const assetSelectStore = useAssetSelectStore()

const holderName = computed(() => assetSelectStore.selectability?.usageHolder?.name ?? null)

const otherHolderCount = computed(() => props.item?.asset.singleUseUsage?.otherHolderCount ?? 0)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { usageLoading, refreshUsage } = useAssetSelectUsageRefresh(props.configName)

watch([activeTab, () => props.item?.asset.id], ([tab]) => {
  if (tab !== TAB_USAGE || !props.item?.asset.singleUseUsage) return
  refreshUsage(props.item.asset)
})
</script>

<template>
  <template v-if="item?.asset.singleUseUsage">
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
          v-if="otherHolderCount > 0"
          color="warning"
          variant="flat"
          size="x-small"
          class="ml-2"
        >
          {{ otherHolderCount }}
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
      :holder-name="holderName"
      :config-name="configName"
      class="pa-3"
    />
  </template>
  <slot v-else />
</template>
