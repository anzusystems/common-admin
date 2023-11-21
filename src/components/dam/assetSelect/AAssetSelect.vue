<script lang="ts" setup>
import { computed, ref, watch, withModifiers } from 'vue'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import type { DamAssetType, DamAssetTypeValues } from '@/types/coreDam/Asset'
import { damAssetTypeValueToEnum } from '@/types/coreDam/Asset'
import { useAssetListActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import AssetSelectListTable from '@/components/dam/assetSelect/components/AssetSelectListTable.vue'
import AssetSelectListBar from '@/components/dam/assetSelect/components/AssetSelectListBar.vue'
import { AssetSelectGridView, useGridView } from '@/components/dam/assetSelect/composables/assetSelectGridView'
import AssetSelectListTiles from '@/components/dam/assetSelect/components/AssetSelectListTiles.vue'
import { useSidebar } from '@/components/dam/assetSelect/composables/assetSelectFilterSidebar'
import AssetSelectFilter from '@/components/dam/assetSelect/components/filter/AssetSelectFilter.vue'
import { isUndefined } from '@/utils/common'
import type {
  AssetSelectReturnData,
  AssetSelectReturnType,
  AssetSelectReturnTypeValues,
} from '@/types/coreDam/AssetSelect'
import { assetSelectReturnTypeValuesToEnum } from '@/types/coreDam/AssetSelect'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'

const props = withDefaults(
  defineProps<{
    modelValue?: boolean | undefined
    assetType: DamAssetType | DamAssetTypeValues
    minCount: number
    maxCount: number
    assetLicenceId?: number
    returnType?: AssetSelectReturnType | AssetSelectReturnTypeValues
    configName?: string
  }>(),
  {
    modelValue: undefined,
    assetLicenceId: undefined,
    returnType: 'mainFileId',
    configName: 'default',
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', data: boolean): void
  (e: 'onConfirm', data: AssetSelectReturnData): void
}>()

const { t } = useI18n()

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

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { defaultLicenceId } = useCommonAdminCoreDamOptions(props.configName)

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

watch(
  dialog,
  async (newValue, oldValue) => {
    if (newValue === oldValue || !newValue) return
    onOpen()
  },
  { immediate: true }
)

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
    case AssetSelectGridView.Table:
      return AssetSelectListTable
    default:
    case AssetSelectGridView.Masonry:
    case AssetSelectGridView.Thumbnail:
      return AssetSelectListTiles
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
      <AssetSelectListBar />
      <div
        class="subject-select__main"
        :class="{ 'subject-select__main--sidebar-active': sidebarLeft }"
      >
        <div class="subject-select__sidebar system-border-r">
          <AssetSelectFilter />
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
                {{ t('common.button.loadMore') }}
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
            {{ t('common.button.confirm') }}
          </slot>
        </ABtnPrimary>
      </div>
    </VCard>
  </VDialog>
</template>
