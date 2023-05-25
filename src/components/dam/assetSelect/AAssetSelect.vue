<script lang="ts" setup>
import { computed, ref } from 'vue'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import type { AssetType } from '@/types/coreDam/Asset'
import { AssetType as AssetTypeValue } from '@/types/coreDam/Asset'
import { useAssetListActions } from '@/components/dam/assetSelect/composables/assetListActions'
import AssetListTableView from '@/components/dam/assetSelect/components/AssetListTableView.vue'
import AssetListBar from '@/components/dam/assetSelect/components/AssetListBar.vue'
import { GridView, useGridView } from '@/components/dam/assetSelect/composables/gridView'
import AssetListTilesView from '@/components/dam/assetSelect/components/AssetListTilesView.vue'
import { useSidebar } from '@/components/dam/assetSelect/composables/filterSidebar'
import AssetFilter from '@/components/dam/assetSelect/components/filter/AssetFilter.vue'
import type { DocId } from '@/types/common'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    maxCount: number
    minCount: number
    assetLicenceId: number
    assetType: AssetType
  }>(),
  {
    minCount: 1,
    maxCount: 1,
    assetType: AssetTypeValue.Image,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', data: boolean): void
  (e: 'onConfirm', data: DocId[]): void
  (e: 'onOpen'): void
  (e: 'onClose'): void
}>()

const { loader, pagination, fetchNextPage, resetAssetList, getSelectedIds, initStoreContext, getSelectedCount } =
  useAssetListActions()

const onOpen = () => {
  initStoreContext(props.assetLicenceId, props.assetType)
  resetAssetList()
  closeSidebar()
  emit('onOpen')
  dialog.value = true
}

const onClose = () => {
  emit('onClose')
  dialog.value = false
}

const onConfirm = () => {
  emit('onConfirm', getSelectedIds())
  onClose()
}

const autoloadOnIntersect = (isIntersecting: boolean) => {
  if (isIntersecting && pagination.hasNextPage === true) {
    fetchNextPage()
  }
}

const dialog = ref(false)

const { gridView } = useGridView()

const componentComputed = computed(() => {
  switch (gridView.value) {
    case GridView.Table:
      return AssetListTableView
    default:
    case GridView.Masonry:
    case GridView.Thumbnail:
      return AssetListTilesView
  }
})

const { sidebarLeft, leftCols, rightCols, closeSidebar } = useSidebar()

const disabledSubmit = computed(() => {
  const selectedCount = getSelectedCount()
  return selectedCount < props.minCount || selectedCount > props.maxCount
})
</script>

<template>
  <slot
    name="button-open-dialog"
    :activator="onOpen"
  >
    <ABtnPrimary
      rounded="pill"
      @click.stop="onOpen"
    />
  </slot>

  <VDialog
    :model-value="dialog"
    fullscreen
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <VCard>
      <ADialogToolbar @on-cancel="onClose">
        <slot name="title" />
      </ADialogToolbar>

      <AssetListBar />

      <VCardText>
        <VRow>
          <VCol
            v-if="sidebarLeft"
            :cols="leftCols"
          >
            <AssetFilter />
          </VCol>
          <VCol :cols="rightCols">
            <component :is="componentComputed" />
            <div
              v-if="loader"
              class="w-100 d-flex align-center justify-center pa-4"
            >
              <VProgressCircular
                indeterminate
                color="primary"
              />
            </div>
            <div
              v-if="dialog"
              v-intersect="autoloadOnIntersect"
              class="justify-center"
            />
            <div class="pa-2 d-flex align-center justify-center">
              <ABtnPrimary
                v-show="pagination.hasNextPage"
                @click="fetchNextPage"
              >
                <slot name="button-confirm-title">
                  {{ t('coreDam.asset.meta.controls.loadMore') }}
                </slot>
              </ABtnPrimary>
            </div>
          </VCol>
        </VRow>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <ABtnPrimary
          :disabled="disabledSubmit"
          @click.stop="onConfirm"
        >
          <slot name="button-confirm-title">
            {{ t('coreDam.asset.meta.controls.confirm') }}
          </slot>
        </ABtnPrimary>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
