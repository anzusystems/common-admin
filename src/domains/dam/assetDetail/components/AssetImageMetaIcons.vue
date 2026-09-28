<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { type AssetFileProperties, DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import {
  DIMENSIONS_CONFIG,
  ICON_LOW,
  ICON_RSS,
  ICON_SLOTS,
  LOW_DIMENSION,
} from '@/domains/dam/assetDetail/utils/assetImageIconsConfig'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'

const props = withDefaults(
  defineProps<{
    assetType: DamAssetTypeType
    assetFileProperties: AssetFileProperties
    disableAbsolute?: boolean
  }>(),
  {
    disableAbsolute: false,
  }
)

const { t } = useI18n()

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
  const damConfigStore = useDamConfigStore()
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
  checkDimensions(icons, titles)
  checkDistributions(icons, titles)

  return { icons, titles }
})
</script>

<template>
  <div
    v-show="data.icons.length > 0"
    class="asset-image__meta-icons"
    :class="{ 'asset-image__meta-icons-absolute': !disableAbsolute }"
  >
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
}
</style>
