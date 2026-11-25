<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  type AssetFileProperties,
  DamAssetType,
  type DamAssetTypeType,
} from '@/types/coreDam/Asset'
import {
  DIMENSIONS_CONFIG,
  ICON_LOW,
  ICON_RSS,
  ICON_SLOTS,
  LOW_DIMENSION,
} from '@/components/damImage/uploadQueue/composables/assetImageIconsConfig'
import { formatSingleUseUsageCount } from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'
import type { DamSourceBadge } from '@/components/damImage/uploadQueue/composables/damSourceBadge'
import { useDamConfigStore } from '@/components/damImage/uploadQueue/composables/damConfigStore'

const props = withDefaults(
  defineProps<{
    assetType: DamAssetTypeType
    assetFileProperties: AssetFileProperties
    disableAbsolute?: boolean
    licenceBadge?: string
    sourceBadges?: DamSourceBadge[]
    singleUse?: boolean
    singleUseUsageCount?: number
  }>(),
  {
    disableAbsolute: false,
    licenceBadge: '',
    sourceBadges: () => [],
    singleUse: false,
    singleUseUsageCount: 0,
  },
)

const { t } = useI18n()

const checkDimensions = (icons: string[], titles: string[]) => {
  if (props.assetFileProperties.width === 0 || props.assetFileProperties.height === 0) {
    return
  }
  if (
    props.assetFileProperties.width < LOW_DIMENSION ||
    props.assetFileProperties.height < LOW_DIMENSION
  ) {
    icons.push(ICON_LOW)
    titles.push(t('common.damImage.asset.metaIcons.low'))
    return
  }
  if (props.assetType !== DamAssetType.Video) return
  for (let i = 0; i < DIMENSIONS_CONFIG.length; i++) {
    if (
      props.assetFileProperties.width === DIMENSIONS_CONFIG[i].width &&
      props.assetFileProperties.height === DIMENSIONS_CONFIG[i].height
    ) {
      icons.push(DIMENSIONS_CONFIG[i].svgSrc)
      titles.push(t(DIMENSIONS_CONFIG[i].titleT))
      break
    }
  }
}

const checkDistributions = (icons: string[], titles: string[]) => {
  const damConfigStore = useDamConfigStore()
  for (let i = 0; i < props.assetFileProperties.distributesInServices.length; i++) {
    const iconPath =
      damConfigStore.damPrvConfig.distributionServices[
        props.assetFileProperties.distributesInServices[i]
      ]?.iconPath
    if (iconPath && iconPath.length > 0 && !icons.includes(iconPath)) {
      icons.push(iconPath)
      titles.push(
        damConfigStore.damPrvConfig.distributionServices[
          props.assetFileProperties.distributesInServices[i]
        ].title,
      )
    }
  }
}

const singleUseTitle = computed(() =>
  props.singleUseUsageCount > 0
    ? t('common.damImage.asset.metaIcons.singleUseUsages', {
        count: formatSingleUseUsageCount(props.singleUseUsageCount),
      })
    : t('common.damImage.asset.metaIcons.singleUse'),
)

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
  checkDimensions(icons, titles)
  checkDistributions(icons, titles)

  return { icons, titles }
})
</script>

<template>
  <div
    v-show="data.icons.length > 0 || licenceBadge.length > 0 || sourceBadges.length > 0 || singleUse"
    class="asset-image__meta-icons"
    :class="{ 'asset-image__meta-icons-absolute': !disableAbsolute }"
  >
    <span
      v-if="licenceBadge.length > 0"
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
    <img
      v-for="(item, index) in data.icons"
      :key="item"
      class="img-svg"
      :src="item"
      alt=""
      :title="data.titles[index] || ''"
    >
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
