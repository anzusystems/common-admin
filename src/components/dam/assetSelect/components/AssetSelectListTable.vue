<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import AssetSelectTableRowItem from '@/components/dam/assetSelect/components/AssetSelectTableRowItem.vue'
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import type { IntegerId } from '@/types/common'

withDefaults(
  defineProps<{
    extSystem: IntegerId
  }>(),
  {}
)

const { t } = useI18n()

const { onItemClick, assetListItems, loader } = useAssetSelectActions()
</script>

<template>
  <VTable
    class="a-datatable a-datatable--dialog-sticky-fix"
    fixed-header
  >
    <thead>
      <tr>
        <th class="text-left" />
        <th class="text-left">
          {{ t('common.assetSelect.meta.table.image') }}
        </th>
        <th class="text-left">
          {{ t('common.assetSelect.model.texts.displayTitle') }}
        </th>
        <th class="text-left">
          {{ t('common.model.tracking.created') }}
        </th>
        <th class="text-left">
          {{ t('common.assetSelect.model.mainFile.fileAttributes.mimeType') }}
        </th>
        <th class="text-left">
          {{ t('common.assetSelect.model.mainFile.fileAttributes.size') }}
        </th>
      </tr>
    </thead>
    <tbody>
      <AssetSelectTableRowItem
        v-for="(item, index) in assetListItems"
        :key="item.asset.id"
        :index="index"
        :item="item"
        @item-click="onItemClick($event, extSystem)"
      />
      <tr v-if="!loader && assetListItems.length === 0">
        <td
          colspan="6"
          class="text-center"
        >
          {{ t('common.assetSelect.meta.texts.noItemsFound') }}
        </td>
      </tr>
    </tbody>
  </VTable>
</template>
