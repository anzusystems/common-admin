<script lang="ts" setup>

import { computed, ref, watch } from 'vue'
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
    maxCount: number,
    assetLicenceId: number,
    assetType: AssetType,
  }>(),
  {
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

const {
  loader,
  pagination,
  filter,
  fetchNextPage,
  listMounted,
  resetAssetList,
  getSelectedIds,
} = useAssetListActions()

const onOpen = () => {
  resetAssetList()
  // todo set defaults method
  filter.type.model = [props.assetType]
  // todo reset view, close filter
  // todo set licence

  emit('onOpen')
  dialog.value = true

  listMounted()
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

const { sidebarLeft } = useSidebar()

const leftCols = ref(0)
const rightCols = ref(12)

watch(
  sidebarLeft,
  (newVal) => {
    if (newVal) {
      leftCols.value = 2
      rightCols.value = 10
      return
    }

    leftCols.value = 0
    rightCols.value = 12
  },
  {
    immediate: true,
  }
)

</script>

<template>
  <slot
    name="button-open-dialog"
    :activator="onOpen"
  >
    <ABtnPrimary
      rounded="pill"
      @click.stop="onOpen"
    >
    </ABtnPrimary>
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
              class="w-100"
            />
          </VCol>

        </VRow>
      </VCardText>

      <VCardActions>
        <VSpacer />
        <ABtnPrimary
          data-cy="button-confirm-delete"
          @click.stop="onConfirm"
        >
          <slot name="button-confirm-title">
            {{ t('todo') }}
          </slot>
        </ABtnPrimary>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
