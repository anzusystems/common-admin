<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { resolveHolderName } from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'
import AChipNoLink from '@/components/AChipNoLink.vue'
import { COMMON_CONFIG } from '@/model/commonConfig'
import { dateTimePretty } from '@/utils/datetime'
import { isNull } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    asset: AssetSearchListItemDto
    holderName: string | null
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

const ownPick = computed(() => {
  const holderPickedAt = usage.value?.holderPickedAt ?? null
  if (isNull(holderPickedAt) || isNull(props.holderName)) return null
  return t('common.assetSelect.usage.ownPick', {
    holder: resolveHolderName(props.holderName),
    date: dateTimePretty(holderPickedAt),
  })
})

const places = computed(() =>
  (usage.value?.places ?? []).map((place) => {
    const name = resolveHolderName(place.resourceName)
    return {
      key: `${place.resourceName}:${place.resourceId}`,
      title: `${name.charAt(0).toUpperCase()}${name.slice(1)} (${place.resourceId})`,
      url: singleUsePlaceUrl?.(place.resourceName, place.resourceId),
      pickedAt: isNull(place.pickedAt)
        ? null
        : t('common.assetSelect.usage.pickedAt', { date: dateTimePretty(place.pickedAt) }),
    }
  }),
)

const moreCount = computed(() =>
  Math.max(0, (usage.value?.otherHolderCount ?? 0) - places.value.length),
)

const allUsagesUrl = computed(() => {
  const mainFile = props.asset.mainFile
  if (!singleUseUsageUrl || !mainFile) return undefined
  return singleUseUsageUrl(mainFile.fileAttributes.takenOverFromId || mainFile.id)
})
</script>

<template>
  <div>
    <h4 class="font-weight-bold text-label-large">
      {{ t('common.assetSelect.usage.usedBy') }}
    </h4>
    <div
      v-if="ownPick"
      class="text-body-medium my-1"
    >
      {{ ownPick }}
    </div>
    <div
      v-if="places.length > 0"
      class="d-flex flex-column align-start ga-2 my-1"
    >
      <div
        v-for="place in places"
        :key="place.key"
        class="d-flex flex-column align-start"
      >
        <VChip
          v-if="place.url"
          :href="place.url"
          target="_blank"
          rel="noopener noreferrer"
          label
          size="small"
          :append-icon="COMMON_CONFIG.CHIP.ICON.LINK_EXTERNAL"
        >
          {{ place.title }}
        </VChip>
        <AChipNoLink v-else>
          {{ place.title }}
        </AChipNoLink>
        <span
          v-if="place.pickedAt"
          class="text-body-small text-medium-emphasis mt-1"
        >
          {{ place.pickedAt }}
        </span>
      </div>
      <span
        v-if="moreCount > 0"
        class="text-body-small text-medium-emphasis"
      >
        {{ t('common.assetSelect.usage.andMore', { count: moreCount }) }}
      </span>
    </div>
    <div
      v-else
      class="text-body-medium my-1"
    >
      {{ t('common.assetSelect.usage.noOtherHolder') }}
    </div>
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
