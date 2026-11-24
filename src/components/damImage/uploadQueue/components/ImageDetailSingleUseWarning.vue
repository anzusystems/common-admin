<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AssetSingleUseUsageStatus } from '@/types/coreDam/Asset'
import {
  getSingleUseGroupId,
  type SingleUseUsageCheck,
} from '@/components/dam/assetSelect/composables/assetSelectSingleUseUsage'
import { formatSingleUseUsageCount } from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { COMMON_CONFIG } from '@/model/commonConfig'
import { isNull } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    singleUseCheck: SingleUseUsageCheck
    configName?: string
  }>(),
  {
    configName: 'default',
  },
)

const { t } = useI18n()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { singleUseUsageUrl } = useCommonAdminCoreDamOptions(props.configName)

const warning = computed(() => {
  if (props.singleUseCheck.failed) return t('common.assetSelect.usage.checkFailed')
  const usage = props.singleUseCheck.asset.singleUseUsage
  if (!usage) return null
  const count = formatSingleUseUsageCount(usage.usageCount)
  switch (usage.status) {
    case AssetSingleUseUsageStatus.NotAllowed:
      return t('common.assetSelect.disabledReason.singleUseNotAllowed')
    case AssetSingleUseUsageStatus.Conflict:
      return usage.blocked
        ? t('common.assetSelect.disabledReason.singleUseBlocked', { count })
        : t('common.assetSelect.usage.usedElsewhere', { count })
    case AssetSingleUseUsageStatus.OwnShared:
      return t('common.assetSelect.usage.usedBySeveral', { count })
    default:
      return null
  }
})

const allUsagesUrl = computed(() => {
  if (props.singleUseCheck.failed || !singleUseUsageUrl) return undefined
  const groupId = getSingleUseGroupId(props.singleUseCheck.asset)
  return isNull(groupId) ? undefined : singleUseUsageUrl(groupId)
})
</script>

<template>
  <VAlert
    v-if="warning"
    type="warning"
    class="mb-4"
  >
    <div class="mb-2">
      {{ warning }}
    </div>
    <VBtn
      v-if="allUsagesUrl"
      :append-icon="COMMON_CONFIG.CHIP.ICON.LINK_EXTERNAL"
      size="small"
      target="_blank"
      rel="noopener noreferrer"
      :href="allUsagesUrl"
    >
      {{ t('common.assetSelect.usage.openList') }}
    </VBtn>
  </VAlert>
</template>
