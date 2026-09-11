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
  },
)

const emit = defineEmits<{
  (e: 'itemClick', data: { assetId: DocId; index: number }): void
}>()

const { t } = useI18n()

const IMAGE_HEIGHT = 200

const item = toRef(props, 'item')

const { asset, assetType, assetStatus, imageProperties, licenceBadge, singleUse, disabledReason } =
  useAssetItemActions(item)

const onItemClick = () => {
  emit('itemClick', { assetId: asset.value.id, index: props.index })
}
</script>

<template>
  <div
    class="asset-list-tiles__item asset-list-tiles__item--pointer"
    :class="{
      'asset-list-tiles__item--selected': item.selected,
      'asset-list-tiles__item--active': item.active,
      'asset-list-tiles__item--disabled': disabledReason,
    }"
    :title="disabledReason ?? undefined"
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
          size="large"
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
        :licence-badge="licenceBadge"
        :single-use="singleUse"
        :disabled-reason="disabledReason ?? ''"
      />
      <div class="asset-list-tiles__item-text text-body-small px-2 py-1">
        <div class="d-flex align-center justify-space-between position-relative">
          <div class="line-clamp-1">
            {{ asset.texts.displayTitle || t('common.damImage.asset.list.noTitle') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
