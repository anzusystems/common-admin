<script lang="ts" setup>

import type { AssetListItem } from '@/services/stores/coreDam/assetListStore'
import { useI18n } from 'vue-i18n'
import { useAssetItemActions } from '@/components/dam/assetSelect/composables/assetItemActions'
import AssetImage from '@/components/dam/assetSelect/components/AssetImagePreview.vue'
import type { DocId } from '@/types/common'

const { t } = useI18n()

const IMAGE_HEIGHT = 70

const props = withDefaults(
  defineProps<{
    index: number
    item: AssetListItem
    showMetaIcons?: boolean
  }>(),
  {
    showMetaIcons: false,
  }
)

const {
  asset,
  imageProperties,
  assetType,
  assetStatus,
} = useAssetItemActions(props.item, props.index)

const emit = defineEmits<{
  (e: 'itemClick', data: { assetId: DocId; index: number }): void
}>()

const onItemClick = () => {
  emit('itemClick', { assetId: asset.value.id, index: props.index })
}

</script>

<template>
  <tr
    @click.stop.exact="onItemClick"
  >
    <td>
      <VIcon
        v-if="item.selected"
        icon="mdi-checkbox-outline"
        :size="20"
      />
      <VIcon
        v-else
        icon="mdi-checkbox-blank-outline"
        :size="20"
      />
    </td>
    <td>
      <AssetImage
        :asset-type="assetType"
        :asset-status="assetStatus"
        :src="imageProperties.url"
        :background-color="imageProperties.bgColor"
        :width="imageProperties.width"
        :height="IMAGE_HEIGHT"
        :icon-size="20"
        :fallback-height="IMAGE_HEIGHT"
      />
    </td>
    <td>
      {{ asset.texts.displayTitle || t('coreDam.asset.list.noTitle') }}
    </td>
  </tr>
</template>
