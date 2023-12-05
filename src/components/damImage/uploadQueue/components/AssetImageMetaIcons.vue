<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import  { type AssetFileProperties, DamAssetType } from '@/types/coreDam/Asset'
import {
  DIMENSIONS_CONFIG,
  ICON_LOW, ICON_RSS, ICON_SLOTS,
  LOW_DIMENSION
} from '@/components/damImage/uploadQueue/composables/assetImageIconsConfig'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'

const props = withDefaults(
  defineProps<{
    assetType: DamAssetType
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
  const { damPrvConfig } = useDamConfigState()
  for (let i = 0; i < props.assetFileProperties.distributesInServices.length; i++) {
    const iconPath =
      damPrvConfig.value.distributionServices[props.assetFileProperties.distributesInServices[i]]?.iconPath
    if (iconPath.length > 0 && !icons.includes(iconPath)) {
      icons.push(iconPath)
      titles.push(damPrvConfig.value.distributionServices[props.assetFileProperties.distributesInServices[i]].title)
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
}
</style>
