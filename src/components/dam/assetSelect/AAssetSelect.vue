<script lang="ts" setup>
import { computed, inject, ref, withModifiers } from 'vue'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import type { DamAssetType, DamAssetTypeValues } from '@/types/coreDam/Asset'
import { damAssetTypeValueToEnum } from '@/types/coreDam/Asset'
import { useAssetListActions } from '@/components/dam/assetSelect/composables/assetListActions'
import AssetListTable from '@/components/dam/assetSelect/components/AssetListTable.vue'
import AssetListBar from '@/components/dam/assetSelect/components/AssetListBar.vue'
import { GridView, useGridView } from '@/components/dam/assetSelect/composables/gridView'
import AssetListTiles from '@/components/dam/assetSelect/components/AssetListTiles.vue'
import { useSidebar } from '@/components/dam/assetSelect/composables/filterSidebar'
import AssetFilter from '@/components/dam/assetSelect/components/filter/AssetFilter.vue'
import { DefaultLicenceIdSymbol } from '@/AnzuSystemsCommonAdmin'
import { isUndefined } from '@/utils/common'
import type {
  AssetSelectReturnData,
  AssetSelectReturnType,
  AssetSelectReturnTypeValues,
} from '@/types/coreDam/AssetSelect'
import { assetSelectReturnTypeValuesToEnum } from '@/types/coreDam/AssetSelect'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    modelValue?: boolean | undefined
    assetType: DamAssetType | DamAssetTypeValues
    minCount: number
    maxCount: number
    assetLicenceId?: number
    returnType?: AssetSelectReturnType | AssetSelectReturnTypeValues
  }>(),
  {
    modelValue: undefined,
    assetLicenceId: undefined,
    returnType: 'mainFileId',
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: boolean): void
  (e: 'onConfirm', data: AssetSelectReturnData): void
}>()

const dialogLocal = ref(false)
const dialog = computed({
  get() {
    if (isUndefined(props.modelValue)) return dialogLocal.value
    return props.modelValue
  },
  set(newValue: boolean) {
    dialogLocal.value = newValue
    emit('update:modelValue', newValue)
  },
})

const { selectedCount, loader, pagination, fetchNextPage, resetAssetList, getSelectedData, initStoreContext } =
  useAssetListActions()

const { openSidebar, sidebarLeft } = useSidebar()

const defaultLicenceId = inject<number | undefined>(DefaultLicenceIdSymbol, undefined)

const onOpen = () => {
  const licenceId = props.assetLicenceId || defaultLicenceId
  if (isUndefined(licenceId)) {
    throw new Error('LicenceId must be provided. Provide using props or common-admin configuration.')
  }

  initStoreContext(
    licenceId,
    damAssetTypeValueToEnum(props.assetType),
    1 === props.minCount && props.minCount === props.maxCount,
    props.minCount,
    props.maxCount
  )
  resetAssetList()
  openSidebar()
  dialog.value = true
}

const onClose = () => {
  dialog.value = false
}

const onConfirm = () => {
  emit('onConfirm', getSelectedData(assetSelectReturnTypeValuesToEnum(props.returnType)))
  onClose()
}

const autoloadOnIntersect = (isIntersecting: boolean) => {
  if (isIntersecting && pagination.hasNextPage === true) {
    fetchNextPage()
  }
}

const { gridView } = useGridView()

const componentComputed = computed(() => {
  switch (gridView.value) {
    case GridView.Table:
      return AssetListTable
    default:
    case GridView.Masonry:
    case GridView.Thumbnail:
      return AssetListTiles
  }
})

const disabledSubmit = computed(() => {
  return selectedCount.value < props.minCount || selectedCount.value > props.maxCount
})

defineExpose({
  open: onOpen,
})
</script>

<template>
  <slot
    name="activator"
    :props="{ onClick: withModifiers(() => onOpen(), ['stop']) }"
  />
  <VDialog
    :model-value="dialog"
    fullscreen
    class="subject-select"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <VCard
      v-if="dialog"
      class="subject-select__card"
    >
      <ADialogToolbar
        class="subject-select__toolbar system-border-b"
        @on-cancel="onClose"
      >
        <slot name="title">
          {{ t('common.assetSelect.meta.texts.title') }}
        </slot>
      </ADialogToolbar>
      <AssetListBar />
      <div
        class="subject-select__main"
        :class="{ 'subject-select__main--sidebar-active': sidebarLeft }"
      >
        <div class="subject-select__sidebar system-border-r">
          <AssetFilter />
        </div>
        <div class="subject-select__content">
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
      <div class="subject-select__actions system-border-t">
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
