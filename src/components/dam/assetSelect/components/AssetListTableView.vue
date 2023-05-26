<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useAssetListStore } from '@/services/stores/coreDam/assetListStore'
import AssetTableRowItem from '@/components/dam/assetSelect/components/AssetTableRowItem.vue'
import { useAssetListActions } from '@/components/dam/assetSelect/composables/assetListActions'

const { t } = useI18n()

const assetListStore = useAssetListStore()
const { list } = storeToRefs(assetListStore)

const { onItemClick } = useAssetListActions()
</script>

<template>
  <v-table
    class="dam-image-table a-table"
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
      <AssetTableRowItem
        v-for="(item, index) in list"
        :key="item.asset.id"
        :index="index"
        :item="item"
        @item-click="onItemClick"
      />
    </tbody>
  </v-table>
</template>
