<script lang="ts" setup>
import { computed, inject, ref } from 'vue'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import type { AssetType } from '@/types/coreDam/Asset'
import { useAssetListActions } from '@/components/dam/assetSelect/composables/assetListActions'
import AssetListTableView from '@/components/dam/assetSelect/components/AssetListTableView.vue'
import AssetListBar from '@/components/dam/assetSelect/components/AssetListBar.vue'
import { GridView, useGridView } from '@/components/dam/assetSelect/composables/gridView'
import AssetListTilesView from '@/components/dam/assetSelect/components/AssetListTilesView.vue'
import { useSidebar } from '@/components/dam/assetSelect/composables/filterSidebar'
import AssetFilter from '@/components/dam/assetSelect/components/filter/AssetFilter.vue'
import type { DocId } from '@/types/common'
import { DefaultLicenceIdSymbol } from '@/AnzuSystemsCommonAdmin'
import { isUndefined } from '@/utils/common'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    maxCount: number
    minCount: number
    assetLicenceId?: number
    assetType: AssetType
  }>(),
  {
    assetLicenceId: undefined,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: boolean): void
  (e: 'onConfirm', data: DocId[]): void
  (e: 'onOpen'): void
  (e: 'onClose'): void
}>()
defineSlots<{
  title?: (props: { activator: () => void }) => any
  buttonOpenDialog?: any
  buttonConfirmTitle?: any
}>()

const { selectedCount, loader, pagination, fetchNextPage, resetAssetList, getSelectedIds, initStoreContext } =
  useAssetListActions()

const { sidebarLeft, openSidebar } = useSidebar()

const defaultLicenceId = inject<number | undefined>(DefaultLicenceIdSymbol, undefined)

const onOpen = () => {
  const licenceId = props.assetLicenceId || defaultLicenceId
  if (isUndefined(licenceId)) {
    throw new Error('LicenceId must be provided. Provide using props or common-admin configuration.')
  }

  initStoreContext(
    licenceId,
    props.assetType,
    1 === props.minCount && props.minCount === props.maxCount,
    props.minCount,
    props.maxCount
  )
  resetAssetList()
  openSidebar()
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

const disabledSubmit = computed(() => {
  return selectedCount.value < props.minCount || selectedCount.value > props.maxCount
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
    class="asset-select"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <VCard
      v-if="dialog"
      class="asset-select__card"
    >
      <ADialogToolbar
        class="asset-select__toolbar system-border-b"
        @on-cancel="onClose"
      >
        <slot name="title">
          {{ t('common.assetSelect.meta.texts.title') }}
        </slot>
      </ADialogToolbar>
      <AssetListBar />
      <div
        class="asset-select__main"
        :class="{ 'asset-select__main--sidebar-active': sidebarLeft }"
      >
        <div class="asset-select__sidebar system-border-r">
          <AssetFilter />
        </div>
        <div class="asset-select__content">
          <component :is="componentComputed" />
          <div class="d-flex w-100 align-center justify-center pa-4">
            <ABtnSecondary
              v-show="pagination.hasNextPage || loader"
              v-intersect="autoloadOnIntersect"
              :loading="loader"
              size="small"
              @click="fetchNextPage"
            >
              <slot name="button-confirm-title">
                {{ t('common.assetSelect.meta.controls.loadMore') }}
              </slot>
            </ABtnSecondary>
          </div>
        </div>
      </div>
      <div class="asset-select__actions system-border-t">
        <div v-if="props.minCount === props.maxCount">
          {{ t('common.assetSelect.meta.texts.pickExactCount', { count: props.minCount, selected: selectedCount }) }}
        </div>
        <div v-else>
          {{
            t('common.assetSelect.meta.texts.pickRangeCount', {
              minCount: props.minCount,
              maxCount: props.maxCount,
              selected: selectedCount,
            })
          }}
        </div>
        <VSpacer />
        <ABtnPrimary
          :disabled="disabledSubmit"
          @click.stop="onConfirm"
        >
          <slot name="button-confirm-title">
            {{ t('common.assetSelect.meta.controls.confirm') }}
          </slot>
        </ABtnPrimary>
      </div>
    </VCard>
  </VDialog>
</template>
