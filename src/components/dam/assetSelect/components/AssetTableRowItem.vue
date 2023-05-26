<script lang="ts" setup>
import type { AssetListItem } from '@/services/stores/coreDam/assetListStore'
import { useI18n } from 'vue-i18n'
import { useAssetItemActions } from '@/components/dam/assetSelect/composables/assetItemActions'
import AssetImage from '@/components/dam/assetSelect/components/AssetImagePreview.vue'
import type { DocId } from '@/types/common'
import { prettyBytes } from '@/utils/file'
import ADatetime from '@/components/ADatetime.vue'

const { t } = useI18n()

const IMAGE_HEIGHT = 72
const IMAGE_WIDTH = 128

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

const { asset, tableImageProperties, assetType, assetStatus } = useAssetItemActions(props.item)

const emit = defineEmits<{
  (e: 'itemClick', data: { assetId: DocId; index: number }): void
}>()

const onItemClick = () => {
  emit('itemClick', { assetId: asset.value.id, index: props.index })
}
</script>

<template>
  <tr
    class="dam-image-table__row a-table__row"
    :class="{ 'a-table__row--selected': item.selected }"
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
        :src="tableImageProperties.url"
        :background-color="tableImageProperties.bgColor"
        :width="IMAGE_WIDTH"
        :height="IMAGE_HEIGHT"
        :icon-size="20"
        :fallback-height="IMAGE_HEIGHT"
      />
    </td>
    <td>
      {{ asset.texts.displayTitle || t('commonCoreDam.asset.list.noTitle') }}
    </td>
    <td>
      <ADatetime :date-time="asset.createdAt" />
    </td>
    <td>
      {{ asset.mainFile?.fileAttributes.mimeType }}
    </td>
    <td>
      {{ prettyBytes(asset.mainFile?.fileAttributes.size || 0) }}
    </td>
  </tr>
</template>
