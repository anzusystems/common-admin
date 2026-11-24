<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  type AssetSearchListItemDto,
  type AssetSingleUseUsageEntry,
  AssetSingleUseUsageStatus,
} from '@/types/coreDam/Asset'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import {
  formatSingleUseUsageCount,
  resolveHolderLabel,
} from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'
import { getSingleUseGroupId } from '@/components/dam/assetSelect/composables/assetSelectSingleUseUsage'
import AChipNoLink from '@/components/AChipNoLink.vue'
import { COMMON_CONFIG } from '@/model/commonConfig'
import { dateTimePretty } from '@/utils/datetime'
import { isNull } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    asset: AssetSearchListItemDto
    configName?: string
  }>(),
  {
    configName: 'default',
  },
)

const { t } = useI18n()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { singleUseUsageUrl, singleUsePlaceUrl } = useCommonAdminCoreDamOptions(props.configName)

const usage = computed(() => props.asset.singleUseUsage ?? null)

const singleUse = computed(() => props.asset.mainFile?.flags.singleUse ?? false)

const statusShown = computed(() => {
  if (!usage.value) return null
  if (singleUse.value) return usage.value.status
  return usage.value.usageCount === 0 ? AssetSingleUseUsageStatus.Free : null
})

const toEntry = (entry: AssetSingleUseUsageEntry) => {
  const name = resolveHolderLabel(entry.resourceName)
  return {
    key: `${entry.resourceName}:${entry.resourceId}`,
    title: `${name.charAt(0).toUpperCase()}${name.slice(1)} (${entry.resourceId})`,
    url: singleUsePlaceUrl?.(entry.resourceName, entry.resourceId),
    pickedAt: t('common.assetSelect.usage.pickedAt', { date: dateTimePretty(entry.pickedAt) }),
  }
}

const holder = computed(() => (singleUse.value && usage.value?.holder ? toEntry(usage.value.holder) : null))

const usages = computed(() => (usage.value?.usages ?? []).map(toEntry))

const usageCountLabel = computed(() => formatSingleUseUsageCount(usage.value?.usageCount ?? 0))

const moreCount = computed(() =>
  Math.max(0, (usage.value?.usageCount ?? 0) - usages.value.length),
)

const allUsagesUrl = computed(() => {
  const groupId = getSingleUseGroupId(props.asset)
  if (!singleUseUsageUrl || isNull(groupId)) return undefined
  return singleUseUsageUrl(groupId)
})
</script>

<template>
  <div v-if="usage">
    <div
      v-if="statusShown"
      class="text-body-medium my-1"
    >
      {{ t(`common.assetSelect.usage.status.${statusShown}`) }}
    </div>
    <template v-if="holder">
      <h4 class="font-weight-bold text-label-large mt-3">
        {{ t('common.assetSelect.usage.holder') }}
      </h4>
      <div class="d-flex flex-column align-start my-1">
        <VChip
          v-if="holder.url"
          :href="holder.url"
          target="_blank"
          rel="noopener noreferrer"
          label
          size="small"
          :append-icon="COMMON_CONFIG.CHIP.ICON.LINK_EXTERNAL"
        >
          {{ holder.title }}
        </VChip>
        <AChipNoLink v-else>
          {{ holder.title }}
        </AChipNoLink>
        <span class="text-body-small text-medium-emphasis mt-1">
          {{ holder.pickedAt }}
        </span>
      </div>
    </template>
    <template v-if="usages.length > 0">
      <h4 class="font-weight-bold text-label-large mt-3">
        {{ t('common.assetSelect.usage.usedBy', { count: usageCountLabel }) }}
      </h4>
      <div class="d-flex flex-column align-start ga-2 my-1">
        <div
          v-for="entry in usages"
          :key="entry.key"
          class="d-flex flex-column align-start"
        >
          <VChip
            v-if="entry.url"
            :href="entry.url"
            target="_blank"
            rel="noopener noreferrer"
            label
            size="small"
            :append-icon="COMMON_CONFIG.CHIP.ICON.LINK_EXTERNAL"
          >
            {{ entry.title }}
          </VChip>
          <AChipNoLink v-else>
            {{ entry.title }}
          </AChipNoLink>
          <span class="text-body-small text-medium-emphasis mt-1">
            {{ entry.pickedAt }}
          </span>
        </div>
        <span
          v-if="moreCount > 0"
          class="text-body-small text-medium-emphasis"
        >
          {{ t('common.assetSelect.usage.andMore', { count: moreCount }) }}
        </span>
      </div>
    </template>
    <VBtn
      v-if="allUsagesUrl"
      :append-icon="COMMON_CONFIG.CHIP.ICON.LINK_EXTERNAL"
      size="small"
      class="mt-2"
      target="_blank"
      rel="noopener noreferrer"
      :href="allUsagesUrl"
    >
      {{ t('common.assetSelect.usage.openList') }}
    </VBtn>
  </div>
</template>
