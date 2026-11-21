<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AssetSelectListItem } from '@/services/stores/coreDam/assetSelectStore'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { resolveHolderName } from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'

const props = withDefaults(
  defineProps<{
    item: AssetSelectListItem
    configName?: string
  }>(),
  {
    configName: 'default',
  },
)

const MAX_PLACES = 3

const { t } = useI18n()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { singleUseUsageUrl } = useCommonAdminCoreDamOptions(props.configName)

const usage = computed(() => props.item.asset.singleUseUsage ?? null)

const visible = computed(() => (usage.value?.totalCount ?? 0) > 0)

const places = computed(() =>
  (usage.value?.places ?? [])
    .slice(0, MAX_PLACES)
    .map((place) => `${resolveHolderName(place.resourceName)} ${place.resourceId}`)
    .join(', '),
)

const url = computed(() => {
  const mainFile = props.item.asset.mainFile
  if (!singleUseUsageUrl || !mainFile) return undefined
  return singleUseUsageUrl(mainFile.fileAttributes.takenOverFromId || mainFile.id)
})
</script>

<template>
  <div
    v-if="visible && usage"
    class="asset-select-usage text-body-small"
  >
    <div class="d-flex align-center">
      <span class="font-weight-medium">
        {{ t('common.assetSelect.usage.used', { count: usage.totalCount }) }}
      </span>
      <a
        v-if="url"
        :href="url"
        target="_blank"
        rel="noopener noreferrer"
        class="ml-1 d-inline-flex"
        :title="t('common.assetSelect.usage.openList')"
        :aria-label="t('common.assetSelect.usage.openList')"
        @click.stop
      >
        <VIcon
          icon="mdi-open-in-new"
          size="small"
        />
      </a>
    </div>
    <div
      v-if="places"
      class="text-medium-emphasis line-clamp-1"
      :title="places"
    >
      {{ t('common.assetSelect.usage.places', { places }) }}
    </div>
  </div>
</template>
