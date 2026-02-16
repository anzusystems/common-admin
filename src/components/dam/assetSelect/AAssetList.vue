<script lang="ts" setup>
import { computed, onMounted, onUnmounted, provide, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type AssetDetailItemDto, type DamAssetTypeType } from '@/types/coreDam/Asset'
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import AssetSelectListTable from '@/components/dam/assetSelect/components/AssetSelectListTable.vue'
import AssetSelectListBar from '@/components/dam/assetSelect/components/AssetSelectListBar.vue'
import { AssetSelectGridView, useGridView } from '@/components/dam/assetSelect/composables/assetSelectGridView'
import AssetSelectListTiles from '@/components/dam/assetSelect/components/AssetSelectListTiles.vue'
import { useSidebar } from '@/components/dam/assetSelect/composables/assetSelectFilterSidebar'
import AssetSelectFilterForm from '@/components/dam/assetSelect/components/filter/AssetSelectFilterForm.vue'
import { filterAllowedImageWidgetSelectConfigs } from '@/components/damImage/composables/damFilterUserAllowedUploadConfigs'
import { useAlerts } from '@/composables/system/alerts'
import type { IntegerId } from '@/types/common'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import { cloneDeep, isUndefined } from '@/utils/common'
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
import AssetDetailDialog from '@/components/damImage/uploadQueue/components/AssetDetailDialog.vue'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import { fetchAsset } from '@/components/damImage/uploadQueue/api/damAssetApi'

const props = withDefaults(
  defineProps<{
    assetType: DamAssetTypeType
    queueKey: UploadQueueKey
    inPodcast?: boolean | null
    selectLicences: IntegerId[]
    configName?: string
    skipCurrentUserCheck?: boolean
    onDetailLoadedCallback?: ((asset: AssetDetailItemDto) => void) | undefined
  }>(),
  {
    inPodcast: null,
    configName: 'default',
    skipCurrentUserCheck: false,
    onDetailLoadedCallback: undefined,
  }
)

const sortModel = defineModel<number>('sort', { default: 1, required: false })

const loading = ref(false)
const ready = ref(false)

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

const { loadDamConfigAssetCustomFormElements, getDamConfigAssetCustomFormElements } = useDamConfigState(damClient)

const { getOrLoadDamConfigExtSystemByLicences } = useDamConfigState(damClient)
const assetDetailStore = useAssetDetailStore()
const { asset, dialog } = storeToRefs(assetDetailStore)
const assetSelectStore = useAssetSelectStore()
const { selectedLicenceId } = storeToRefs(assetSelectStore)

const selectConfigs = shallowRef<DamConfigLicenceExtSystemReturnType[]>([])

const { sidebarRight } = useSidebar()
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
}

const resetFilterAction = () => {
  resetFilter(pagination, resetAssetList)
}

const onInit = () => {
  if (!ready.value) return
  let selectConfigLocal = cloneDeep(selectConfigs.value)
  if (!props.skipCurrentUserCheck) {
    selectConfigLocal = filterAllowedImageWidgetSelectConfigs(selectConfigs.value)
  }
  if (selectConfigLocal.length === 0) {
    showErrorT('common.assetSelect.error.unallowedLicence')
    return
  }

  reset()
  initStoreContext(
    selectConfigLocal,
    props.assetType,
    props.inPodcast,
    false,
    0,
    0
  )
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
  if (selectConfigs.value.length === 0) return undefined
  if (selectedLicenceId.value > 0) {
    const found = selectConfigs.value.find((config) => config.licence === selectedLicenceId.value)
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
  { immediate: true }
)

watch(selectedLicenceId, (newValue, oldValue) => {
  if (newValue === oldValue) return
  resetFilterAction()
})

onMounted(async () => {
  ready.value = false
  loading.value = true
  selectConfigs.value = await getOrLoadDamConfigExtSystemByLicences(props.selectLicences)
  loading.value = false
  ready.value = true
  onInit()
})

onUnmounted(() => {
  selectConfigs.value = []
  reset()
})
</script>

<template>
  <div
    v-if="loading"
    class="w-100 d-flex align-center justify-center"
  >
    <VProgressCircular indeterminate />
  </div>
  <template v-else-if="ready && selectConfigs.length > 0">
    <div class="subject-select__card">
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
          'subject-select__main--sidebar-right-active': sidebarRight,
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
        <div class="subject-select__sidebar-right">
          <div
            v-if="loadingSidebarRight"
            class="d-flex w-100 align-center justify-center"
          >
            <VProgressCircular indeterminate />
          </div>
          <div
            v-else-if="!asset"
            class="d-flex w-100 align-center justify-center"
          >
            {{ t('common.assetSelect.meta.info.noAssetSelected') }}
          </div>
          <div
            v-else
            class="w-100"
          >
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
    </div>
  </template>
  <div v-else>
    Error, no select licence.
  </div>
  <AssetDetailDialog
    v-if="dialog === queueKey && extId"
    :queue-key="queueKey"
    :ext-system="extId"
    @close="onCloseEditDialog"
  />
</template>
