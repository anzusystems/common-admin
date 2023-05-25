<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import type { AssetListItem } from '@/services/stores/coreDam/assetListStore'
import { useAssetItemActions } from '@/components/dam/assetSelect/composables/assetItemActions'
import AssetImagePreview from '@/components/dam/assetSelect/components/AssetImagePreview.vue'
import type { DocId } from '@/types/common'

const { t } = useI18n()

const IMAGE_HEIGHT = 200

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

const emit = defineEmits<{
  (e: 'itemClick', data: { assetId: DocId; index: number }): void
}>()

const onItemClick = () => {
  emit('itemClick', { assetId: asset.value.id, index: props.index })
}

const { asset, assetType, assetStatus, imageProperties } = useAssetItemActions(props.item)
</script>

<template>
  <div
    class="dam-image-grid__item"
    :class="{ 'dam-image-grid__item--selected': item.selected }"
    @click.stop.exact="onItemClick"
  >
    <div class="dam-image-grid__item-card">
      <div
        v-if="item.selected"
        class="selected-triangle"
      >
        <div class="selected-triangle__bg" />
        <VIcon
          class="selected-triangle__icon"
          icon="mdi-check"
          color="white"
          size="x-small"
        />
      </div>
      <AssetImagePreview
        :asset-type="assetType"
        :asset-status="assetStatus"
        :src="imageProperties.url"
        :background-color="imageProperties.bgColor"
        :width="imageProperties.width"
        :height="imageProperties.height"
        :fallback-height="IMAGE_HEIGHT"
        :asset-file-properties="item.asset.assetFileProperties"
        :show-meta-icons="showMetaIcons"
      />
      <div class="dam-image-grid__item-text text-caption px-2 py-1">
        <div class="d-flex align-center justify-space-between position-relative">
          <div class="line-clamp-1">
            {{ asset.texts.displayTitle || t('coreDam.asset.list.noTitle') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
