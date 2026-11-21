<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AssetSelectListItem } from '@/services/stores/coreDam/assetSelectStore'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { resolveHolderName } from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'
import AChipNoLink from '@/components/AChipNoLink.vue'
import { COMMON_CONFIG } from '@/model/commonConfig'

const props = withDefaults(
  defineProps<{
    item: AssetSelectListItem
    configName?: string
  }>(),
  {
    configName: 'default',
  },
)

const { t } = useI18n()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { singleUseUsageUrl, singleUsePlaceUrl } = useCommonAdminCoreDamOptions(props.configName)

const usage = computed(() => props.item.asset.singleUseUsage ?? null)

const places = computed(() =>
  (usage.value?.places ?? []).map((place) => {
    const name = resolveHolderName(place.resourceName)
    return {
      key: `${place.resourceName}:${place.resourceId}`,
      title: `${name.charAt(0).toUpperCase()}${name.slice(1)} (${place.resourceId})`,
      url: singleUsePlaceUrl?.(place.resourceName, place.resourceId),
    }
  }),
)

const moreCount = computed(() =>
  Math.max(0, (usage.value?.otherHolderCount ?? 0) - places.value.length),
)

const allUsagesUrl = computed(() => {
  const mainFile = props.item.asset.mainFile
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
      v-if="places.length > 0"
      class="d-flex flex-wrap align-center ga-1 my-1"
    >
      <template
        v-for="place in places"
        :key="place.key"
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
      </template>
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
    <a
      v-if="allUsagesUrl"
      :href="allUsagesUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="d-inline-flex align-center text-body-medium mt-2"
    >
      {{ t('common.assetSelect.usage.openList') }}
      <VIcon
        icon="mdi-open-in-new"
        size="small"
        class="ml-1"
      />
    </a>
  </div>
</template>
