<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { type AssetFileProperties, DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import {
  DIMENSIONS_CONFIG,
  ICON_LOW,
  ICON_RSS,
  ICON_SLOTS,
  ICON_TTS,
  LOW_DIMENSION,
} from '@/domains/dam/assetDetail/utils/assetImageIconsConfig'
import { useDamConfigStoreOf } from '@/domains/dam/config/store/damConfigStore'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'
import { useRemainingTime } from '@/domains/ui/datetime/composables/remainingTime'
import { useAutoDeleteTimeLeft } from '@/domains/dam/assetDetail/composables/autoDeleteTimeLeft'
import type { DatetimeUTCNullable } from '@/shared/types/common'
import { dateTimeFriendly } from '@/shared/utils/datetime'
import type { DamSourceBadge } from '@/domains/dam/author/composables/damSourceBadge'
import { formatSingleUseUsageCount } from '@/domains/dam/assetSelect/composables/assetSelectDisabledReason'

const props = withDefaults(
  defineProps<{
    assetType: DamAssetTypeType
    assetFileProperties: AssetFileProperties
    disableAbsolute?: boolean
    /** Shows the synthesized audio (TTS) icon. Off by default because the backend reports it to every admin. */
    showTts?: boolean
    /** DAM configuration whose distribution services name the icons. Inherited when not given. */
    configName?: string
    /** When DAM deletes the asset: a badge shows the time left. Only admin-dam passes it, the other admins show none. */
    autoDeleteAt?: DatetimeUTCNullable
    /** Badge of the asset's licence, shown as given. Empty shows none. */
    licenceBadge?: string
    /** Badges of the asset's sources, shown in the given order after the licence badge (`resolveSourceBadges`). */
    sourceBadges?: DamSourceBadge[]
    /** The asset's main file is a single use photo: a "1×" badge. */
    singleUse?: boolean
    /** How many records use the single use photo, when that is a warning: the badge turns warning and names it. */
    singleUseUsageCount?: number
  }>(),
  {
    disableAbsolute: false,
    showTts: false,
    configName: undefined,
    autoDeleteAt: null,
    licenceBadge: '',
    sourceBadges: () => [],
    singleUse: false,
    singleUseUsageCount: 0,
  }
)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigStore = useDamConfigStoreOf(useDamConfigName(props.configName))

const { t } = useI18n()
const { remainingTimeShort } = useRemainingTime()

const { secondsLeft } = useAutoDeleteTimeLeft(() => props.autoDeleteAt)

const autoDeleteBadge = computed(() => {
  if (!props.autoDeleteAt || secondsLeft.value === null) return null
  return {
    text: remainingTimeShort(secondsLeft.value),
    title: t('common.damImage.asset.metaIcons.autoDeleteAt', { date: dateTimeFriendly(props.autoDeleteAt) }),
  }
})

const singleUseTitle = computed(() =>
  props.singleUseUsageCount > 0
    ? t('common.damImage.asset.metaIcons.singleUseUsages', {
        count: formatSingleUseUsageCount(props.singleUseUsageCount),
      })
    : t('common.damImage.asset.metaIcons.singleUse')
)

const checkDimensions = (icons: string[], titles: string[]) => {
  if (props.assetFileProperties.width === 0 || props.assetFileProperties.height === 0) {
    return
  }
  if (props.assetFileProperties.width < LOW_DIMENSION || props.assetFileProperties.height < LOW_DIMENSION) {
    icons.push(ICON_LOW)
    titles.push(t('common.damImage.asset.metaIcons.low'))
    return
  }
  if (props.assetType !== DamAssetType.Video) return
  for (const dimension of DIMENSIONS_CONFIG) {
    if (props.assetFileProperties.width === dimension.width && props.assetFileProperties.height === dimension.height) {
      icons.push(dimension.svgSrc)
      titles.push(t(dimension.titleT))
      break
    }
  }
}

const checkDistributions = (icons: string[], titles: string[]) => {
  for (const serviceName of props.assetFileProperties.distributesInServices) {
    const service = damConfigStore.damPrvConfig.distributionServices[serviceName]
    const iconPath = service?.iconPath
    if (service && iconPath && iconPath.length > 0 && !icons.includes(iconPath)) {
      icons.push(iconPath)
      titles.push(service.title)
    }
  }
}

const data = computed(() => {
  const icons: string[] = []
  const titles: string[] = []

  if (props.assetFileProperties.slotNames.length > 1) {
    icons.push(ICON_SLOTS)
    titles.push(t('common.damImage.asset.metaIcons.slots'))
  }
  if (props.assetFileProperties.fromRss) {
    icons.push(ICON_RSS)
    titles.push(t('common.damImage.asset.metaIcons.rss'))
  }
  if (props.showTts && props.assetFileProperties.ttsAudio) {
    icons.push(ICON_TTS)
    titles.push(t('common.damImage.asset.metaIcons.tts'))
  }
  checkDimensions(icons, titles)
  checkDistributions(icons, titles)

  return { icons, titles }
})
</script>

<template>
  <div
    v-show="data.icons.length > 0 || autoDeleteBadge || licenceBadge || sourceBadges.length > 0 || singleUse"
    class="asset-image__meta-icons"
    :class="{ 'asset-image__meta-icons-absolute': !disableAbsolute }"
  >
    <span
      v-if="licenceBadge"
      class="asset-image__licence-badge"
      data-cy="asset-licence-badge"
    >
      {{ licenceBadge }}
    </span>
    <span
      v-for="source in sourceBadges"
      :key="source.id"
      class="asset-image__licence-badge"
      :title="t('common.damImage.asset.metaIcons.source', { name: source.name })"
      data-cy="asset-source-badge"
    >
      {{ source.badge }}
    </span>
    <!-- The warning is told by the icon and the label too, not by the colour alone. -->
    <span
      v-if="singleUse"
      class="asset-image__licence-badge"
      :class="{ 'asset-image__single-use-badge--shared': singleUseUsageCount > 0 }"
      role="img"
      :aria-label="singleUseTitle"
      :title="singleUseTitle"
      data-cy="asset-single-use-badge"
    >
      1×
      <VIcon
        v-if="singleUseUsageCount > 0"
        icon="mdi-alert"
        size="12"
        class="ml-1"
      />
    </span>
    <VChip
      v-if="autoDeleteBadge"
      size="x-small"
      variant="flat"
      color="warning"
      class="ma-1 align-self-center"
      :title="autoDeleteBadge.title"
      data-cy="asset-auto-delete-badge"
    >
      {{ autoDeleteBadge.text }}
    </VChip>
    <img
      v-for="(item, index) in data.icons"
      :key="item"
      class="img-svg"
      :src="item"
      alt=""
      :title="data.titles[index] || ''"
    />
  </div>
</template>

<style lang="scss">
.asset-image__meta-icons-absolute {
  position: absolute;
  left: 6px;
  top: 163px;
}

.asset-image__meta-icons {
  display: flex;

  img.img-svg {
    height: 30px;
    padding: 2px;
  }

  // As the SVG meta icons: a half-transparent black circle with white bold letters, widening with a longer text.
  .asset-image__licence-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    height: 26px;
    margin: 2px;
    padding: 0 6px;
    border-radius: 13px;
    background-color: rgb(0 0 0 / 50%);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
  }

  .asset-image__single-use-badge--shared {
    background-color: rgb(var(--v-theme-warning));
    color: rgb(var(--v-theme-on-warning));
  }
}
</style>
