<script lang="ts" setup>
import { computed, inject, onUnmounted, provide, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useI18n } from 'vue-i18n'
import { type AssetDetailItemDto, type DamAssetTypeType } from '@/types/coreDam/Asset'
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import AssetSelectListTable from '@/components/dam/assetSelect/components/AssetSelectListTable.vue'
import AssetSelectListBar from '@/components/dam/assetSelect/components/AssetSelectListBar.vue'
import {
  AssetSelectGridView,
  useGridView,
} from '@/components/dam/assetSelect/composables/assetSelectGridView'
import AssetSelectListTiles from '@/components/dam/assetSelect/components/AssetSelectListTiles.vue'
import { useSidebar } from '@/components/dam/assetSelect/composables/assetSelectFilterSidebar'
import AssetSelectFilterForm from '@/components/dam/assetSelect/components/filter/AssetSelectFilterForm.vue'
import { filterAllowedImageWidgetSelectConfigs } from '@/components/damImage/composables/damFilterUserAllowedUploadConfigs'
import { useAlerts } from '@/composables/system/alerts'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import type {
  DamConfigLicenceExtSystemReturnType,
  DamExtSystemConfig,
} from '@/types/coreDam/DamConfig'
import { cloneDeep, isDefined, isUndefined } from '@/utils/common'
import AssetMetadata from '@/components/damImage/uploadQueue/components/AssetMetadata.vue'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { storeToRefs } from 'pinia'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { type DatatableOrderingOption } from '@/composables/system/datatableColumns'
import { useAssetListFilter } from '@/model/coreDam/filter/AssetFilter'
import { FilterConfigKey, FilterDataKey } from '@/labs/filters/filterInjectionKeys'
import AFilterWrapper from '@/labs/filters/AFilterWrapper.vue'
import AFilterString from '@/labs/filters/AFilterString.vue'
import { useFilterHelpers } from '@/labs/filters/filterFactory'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import AssetDetailDialog from '@/components/damImage/uploadQueue/components/AssetDetailDialog.vue'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import { fetchAsset } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { ImageWidgetUploadConfig } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import { useDamAcceptTypeAndSizeHelper } from '@/components/damImage/uploadQueue/composables/acceptTypeAndSizeHelper'
import { useUploadQueueDialog } from '@/components/damImage/uploadQueue/composables/uploadQueueDialog'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import UploadQueueDialog from '@/components/damImage/uploadQueue/components/UploadQueueDialog.vue'
import AFileInput from '@/components/file/AFileInput.vue'

const props = withDefaults(
  defineProps<{
    assetType: DamAssetTypeType
    queueKey: UploadQueueKey
    selectConfigs: DamConfigLicenceExtSystemReturnType[]
    inPodcast?: boolean | null
    configName?: string
    skipCurrentUserCheck?: boolean
    onDetailLoadedCallback?: ((asset: AssetDetailItemDto) => void) | undefined
    variant?: 'default' | 'inline'
  }>(),
  {
    inPodcast: null,
    configName: 'default',
    skipCurrentUserCheck: false,
    onDetailLoadedCallback: undefined,
    variant: 'default',
  },
)

const sortModel = defineModel<number>('sort', { default: 1, required: false })

const { t } = useI18n()

const {
  damClient,
  loader,
  pagination,
  fetchNextPage,
  initStoreContext,
  detailLoading,
  fetchAssetListDebounced,
  reset,
  resetAssetList,
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
} = useAssetSelectActions('default', props.onDetailLoadedCallback)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { assetListEnabledFilters, endPointAsset } = useCommonAdminCoreDamOptions(props.configName)

const { loadDamConfigAssetCustomFormElements, getDamConfigAssetCustomFormElements } =
  useDamConfigState(damClient)

const assetDetailStore = useAssetDetailStore()
const { asset, dialog } = storeToRefs(assetDetailStore)
const assetSelectStore = useAssetSelectStore()
const { selectedLicenceId } = storeToRefs(assetSelectStore)

const { sidebarRight, closeSidebarRight, closeSidebarLeft } = useSidebar()
const { smAndDown } = useDisplay()
const { showErrorT } = useAlerts()

const { filterData, filterConfig } = useAssetListFilter()
provide(FilterConfigKey, filterConfig)
provide(FilterDataKey, filterData)

const { resetFilter, submitFilter } = useFilterHelpers(filterData, filterConfig, {
  populateUrlParams: false,
  storeFiltersLocalStorage: false,
})

const submitFilterAction = () => {
  submitFilter(pagination, fetchAssetListDebounced)
  if (smAndDown.value) closeSidebarLeft()
}

const resetFilterAction = () => {
  resetFilter(pagination, resetAssetList)
  if (smAndDown.value) closeSidebarLeft()
}

const onInit = () => {
  let selectConfigLocal = cloneDeep(props.selectConfigs)
  if (!props.skipCurrentUserCheck) {
    selectConfigLocal = filterAllowedImageWidgetSelectConfigs(props.selectConfigs)
  }
  if (selectConfigLocal.length === 0) {
    showErrorT('common.assetSelect.error.unallowedLicence')
    return
  }

  reset()
  initStoreContext(selectConfigLocal, props.assetType, props.inPodcast, false, 0, 0)
  fetchAssetListDebounced()
}

const autoloadOnIntersect = (isIntersecting: boolean) => {
  if (isIntersecting && pagination.value.hasNextPage === true) {
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

const extId = computed(() => {
  if (props.selectConfigs.length === 0) return undefined
  if (selectedLicenceId.value > 0) {
    const found = props.selectConfigs.find((config) => config.licence === selectedLicenceId.value)
    if (found) return found.extSystem
  }
  return undefined
})

const loadingSidebarRight = computed(() => {
  return customFormConfigLoading.value || detailLoading.value
})

const { showErrorsDefault } = useAlerts()
const customFormConfigLoading = ref(true)

const sortByChange = (option: DatatableOrderingOption) => {
  pagination.value.sortBy = null
  if (option.sortBy) {
    pagination.value.sortBy = { key: option.sortBy.key, order: option.sortBy.order }
  }
  fetchAssetListDebounced()
}

const onOpenEditDialog = () => {
  if (!asset.value) return
  dialog.value = props.queueKey
}

const onCloseEditDialog = async () => {
  const activeItem = assetSelectStore.assetListItems.find((item) => item.active)
  if (!activeItem) return
  detailLoading.value = true
  try {
    const assetData = await fetchAsset(damClient, endPointAsset, activeItem.asset.id)
    assetDetailStore.setAsset(assetData)
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    detailLoading.value = false
  }
}

const imageWidgetUploadConfig = inject(ImageWidgetUploadConfig, undefined)
const uploadEnabled = computed(
  () => isDefined(imageWidgetUploadConfig) && isDefined(imageWidgetUploadConfig.value),
)

const { uploadQueueDialog } = useUploadQueueDialog()
const uploadQueuesStore = useUploadQueuesStore()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { uploadSizes, uploadAccept } = useDamAcceptTypeAndSizeHelper(
  props.assetType,
  (imageWidgetUploadConfig?.value?.extSystemConfig ?? {}) as DamExtSystemConfig,
)

const uploadQueue = computed(() => {
  return uploadQueuesStore.getQueue(props.queueKey)
})

const onFileInput = (files: File[]) => {
  if (files.length === 0) return
  const config = imageWidgetUploadConfig?.value
  if (!config) return
  uploadQueuesStore.addByFiles(props.queueKey, config.extSystem, config.licence, files)
  uploadQueueDialog.value = props.queueKey
}

const onUploadApply = () => {
  uploadQueueDialog.value = null
  uploadQueuesStore.stopUpload(props.queueKey)
  fetchAssetListDebounced()
}

watch(
  extId,
  async (newValue) => {
    if (isUndefined(newValue)) return
    customFormConfigLoading.value = true
    const configAssetCustomFormElements = getDamConfigAssetCustomFormElements(newValue)
    if (isUndefined(configAssetCustomFormElements)) {
      try {
        await loadDamConfigAssetCustomFormElements(newValue)
        customFormConfigLoading.value = false
      } catch (e) {
        showErrorsDefault(e)
      }
    } else {
      customFormConfigLoading.value = false
    }
  },
  { immediate: true },
)

watch(selectedLicenceId, (newValue, oldValue) => {
  if (newValue === oldValue) return
  resetFilterAction()
})

onInit()

onUnmounted(() => {
  reset()
})
</script>

<template>
  <slot
    v-if="uploadEnabled"
    name="upload-activator"
    :on-file-input="onFileInput"
    :upload-accept="uploadAccept"
    :upload-sizes="uploadSizes"
  >
    <AFileInput
      :file-input-key="uploadQueue?.fileInputKey"
      :accept="uploadAccept"
      :max-sizes="uploadSizes"
      multiple
      @files-input="onFileInput"
    >
      <template #activator="{ props: fileInputProps }">
        <VBtn v-bind="fileInputProps">
          {{ t('common.button.upload') }}
        </VBtn>
      </template>
    </AFileInput>
  </slot>
  <div
    class="subject-select__card"
    :class="{ 'subject-select__card--inline': variant === 'inline' }"
  >
    <div class="px-2 pt-2">
      <slot name="filter">
        <AFilterWrapper
          @submit="submitFilterAction"
          @reset="resetFilterAction"
        >
          <template #search>
            <AFilterString name="text" />
          </template>
          <template #detail>
            <VRow v-if="selectConfigs.length > 1">
              <VCol :cols="12">
                <VSelect
                  v-model="selectedLicenceId"
                  :label="t('common.assetSelect.filter.licence')"
                  :items="selectConfigs"
                  item-title="licenceName"
                  item-value="licence"
                  hide-details
                />
              </VCol>
            </VRow>
            <AssetSelectFilterForm
              use-config-layout
              hide-text-search
              :enabled-filters="assetListEnabledFilters"
              :config-name="configName"
            />
          </template>
        </AFilterWrapper>
      </slot>
    </div>
    <AssetSelectListBar
      v-model:sort="sortModel"
      hide-filter-toggle
      @sort-by-change="sortByChange"
    />
    <div
      class="subject-select__main"
      :class="{
        'subject-select__main--sidebar-right-active': sidebarRight && !smAndDown,
      }"
    >
      <div class="subject-select__content">
        <component
          :is="componentComputed"
          v-if="extId"
          :ext-system="extId"
        />
        <div class="d-flex w-100 align-center justify-center pa-4">
          <ABtnSecondary
            v-show="pagination.hasNextPage || loader"
            v-intersect="autoloadOnIntersect"
            :loading="loader"
            size="small"
            @click="fetchNextPage"
          >
            {{ t('common.button.loadMore') }}
          </ABtnSecondary>
        </div>
      </div>
      <div
        v-if="!smAndDown"
        class="subject-select__sidebar-right system-border-l"
      >
        <div
          v-if="loadingSidebarRight"
          class="d-flex w-100 align-center justify-center"
        >
          <VProgressCircular indeterminate />
        </div>
        <div
          v-else-if="!asset"
          class="d-flex w-100 align-center justify-center text-body-large"
        >
          {{ t('common.assetSelect.meta.info.noAssetSelected') }}
        </div>
        <div
          v-else
          class="w-100"
        >
          <slot
            name="sidebar-prepend"
            :asset="asset"
          />
          <AssetMetadata
            v-if="extId && !customFormConfigLoading"
            :ext-system="extId"
            readonly
            show-edit-button
            @edit-in-dam="onOpenEditDialog"
          />
        </div>
      </div>
    </div>
    <VDialog
      v-if="smAndDown"
      v-model="sidebarRight"
      scrollable
      @update:model-value="
        (v) => {
          if (!v) closeSidebarRight()
        }
      "
    >
      <VCard>
        <ADialogToolbar @on-cancel="closeSidebarRight">
          {{ t('common.assetSelect.meta.info.toggle') }}
        </ADialogToolbar>
        <VCardText>
          <div
            v-if="loadingSidebarRight"
            class="d-flex w-100 align-center justify-center"
          >
            <VProgressCircular indeterminate />
          </div>
          <div
            v-else-if="asset"
            class="w-100"
          >
            <slot
              name="sidebar-prepend"
              :asset="asset"
            />
            <AssetMetadata
              v-if="extId && !customFormConfigLoading"
              :ext-system="extId"
              readonly
              show-edit-button
              @edit-in-dam="onOpenEditDialog"
            />
          </div>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn @click="closeSidebarRight">
            {{ t('common.button.close') }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
  <AssetDetailDialog
    v-if="dialog === queueKey && extId"
    :queue-key="queueKey"
    :ext-system="extId"
    @close="onCloseEditDialog"
  />
  <UploadQueueDialog
    v-if="uploadEnabled && uploadQueueDialog === queueKey && imageWidgetUploadConfig"
    :queue-key="queueKey"
    :ext-system="imageWidgetUploadConfig.extSystem"
    :licence-id="imageWidgetUploadConfig.licence"
    :file-input-key="uploadQueue?.fileInputKey ?? -1"
    :accept="uploadAccept"
    :max-sizes="uploadSizes"
    @on-apply="onUploadApply"
    @on-files-input="onFileInput"
  />
</template>
