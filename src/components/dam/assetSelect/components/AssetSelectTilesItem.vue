<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import type { AssetSelectListItem } from '@/services/stores/coreDam/assetSelectStore'
import { useAssetItemActions } from '@/components/dam/assetSelect/composables/assetSelectItemActions'
import AssetImagePreview from '@/components/dam/assetSelect/components/AssetImagePreview.vue'
import type { DocId } from '@/types/common'
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

const IMAGE_HEIGHT = 200

const onItemClick = () => {
  emit('itemClick', { assetId: asset.value.id, index: props.index })
}

const item = toRef(props, 'item')

const { asset, assetType, assetStatus, imageProperties } = useAssetItemActions(item)
</script>

<template>
  <div
    class="asset-list-tiles__item asset-list-tiles__item--pointer"
    :class="{ 'asset-list-tiles__item--selected': item.selected }"
    @click.stop.exact="onItemClick"
  >
    <div class="asset-list-tiles__item-card">
      <div
        v-if="item.selected"
        class="asset-list-tiles__selected-triangle"
      >
        <div class="asset-list-tiles__selected-triangle__bg" />
        <VIcon
          class="asset-list-tiles__selected-triangle__icon"
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
      <div class="asset-list-tiles__item-text text-caption px-2 py-1">
        <div class="d-flex align-center justify-space-between position-relative">
          <div class="line-clamp-1">
            {{ asset.texts.displayTitle || t('commonCoreDam.asset.list.noTitle') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
