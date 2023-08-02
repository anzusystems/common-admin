<script lang="ts" setup>
import type { AssetSelectListItem } from '@/services/stores/coreDam/assetSelectStore'
import { useI18n } from 'vue-i18n'
import { useAssetItemActions } from '@/components/dam/assetSelect/composables/assetSelectItemActions'
import AssetImagePreview from '@/components/dam/assetSelect/components/AssetImagePreview.vue'
import type { DocId } from '@/types/common'
import { prettyBytes } from '@/utils/file'
import ADatetime from '@/components/ADatetime.vue'
import { toRef } from 'vue'

const props = withDefaults(
  defineProps<{
    index: number
    item: AssetSelectListItem
    showMetaIcons?: boolean
  }>(),
  {
    showMetaIcons: false,
  }
)

const emit = defineEmits<{
  (e: 'itemClick', data: { assetId: DocId; index: number }): void
}>()

const { t } = useI18n()

const IMAGE_HEIGHT = 72
const IMAGE_WIDTH = 128

const item = toRef(props, 'item')

const { asset, tableImageProperties, assetType, assetStatus } = useAssetItemActions(item)

const onItemClick = () => {
  emit('itemClick', { assetId: asset.value.id, index: props.index })
}
</script>

<template>
  <tr
    class="a-datatable__row"
    :class="{ 'a-datatable__row--selected': item.selected }"
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
      <AssetImagePreview
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
