<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, shallowRef, watch, withModifiers } from 'vue'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import { type AssetDetailItemDto, DamAssetType } from '@/types/coreDam/Asset'
import { useAssetSelectActions } from '@/components/dam/assetSelect/composables/assetSelectListActions'
import AssetSelectListTable from '@/components/dam/assetSelect/components/AssetSelectListTable.vue'
import AssetSelectListBar from '@/components/dam/assetSelect/components/AssetSelectListBar.vue'
import { AssetSelectGridView, useGridView } from '@/components/dam/assetSelect/composables/assetSelectGridView'
import AssetSelectListTiles from '@/components/dam/assetSelect/components/AssetSelectListTiles.vue'
import { useSidebar } from '@/components/dam/assetSelect/composables/assetSelectFilterSidebar'
import AssetSelectFilter from '@/components/dam/assetSelect/components/filter/AssetSelectFilter.vue'
import {
  type AssetSelectReturnData,
  AssetSelectReturnType,
  type AssetSelectReturnTypeType,
} from '@/types/coreDam/AssetSelect'
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
import type {
  DatatableOrderingOption,
  DatatableOrderingOptions,
  DatatableSortBy,
} from '@/composables/system/datatableColumns'

const props = withDefaults(
  defineProps<{
    minCount: number
    maxCount: number
    selectLicences: IntegerId[]
    uploadLicence?: IntegerId | undefined
    returnType?: AssetSelectReturnTypeType
    configName?: string
    skipCurrentUserCheck?: boolean
    onDetailLoadedCallback?: ((asset: AssetDetailItemDto) => void) | undefined
    sortVariant?: 'default' | 'most-relevant'
    disableSort?: boolean
    customSortOptions?: undefined | DatatableOrderingOptions
    initialPaginationSort?: DatatableSortBy
  }>(),
  {
    uploadLicence: undefined,
    returnType: AssetSelectReturnType.MainFileId,
    configName: 'default',
    skipCurrentUserCheck: false,
    onDetailLoadedCallback: undefined,
    sortVariant: 'most-relevant',
    disableSort: false,
    customSortOptions: undefined,
    initialPaginationSort: () => ({ key: 'createdAt', order: 'desc' }),
  }
)

const emit = defineEmits<{
  (e: 'onConfirm', data: AssetSelectReturnData): void
}>()

const modelValue = defineModel<boolean>({ default: false, required: false })
const sortModel = defineModel<number>('sort', { default: 1, required: false })
const loading = ref(false)
const copyToLicence = ref(false)

const { t } = useI18n()

const {
  damClient,
  selectedCount,
  loader,
  pagination,
  fetchNextPage,
  fetchAssetList,
  resetAssetList,
  getSelectedData,
  initStoreContext,
  detailLoading,
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
} = useAssetSelectActions('default', props.onDetailLoadedCallback)

const { loadDamConfigAssetCustomFormElements, getDamConfigAssetCustomFormElements } = useDamConfigState(damClient)
const { getOrLoadDamConfigExtSystemByLicences } = useDamConfigState(damClient)
const assetDetailStore = useAssetDetailStore()
const { asset } = storeToRefs(assetDetailStore)
const assetSelectStore = useAssetSelectStore()
const { selectedLicenceId, assetType } = storeToRefs(assetSelectStore)

const selectConfigs = shallowRef<DamConfigLicenceExtSystemReturnType[]>([])

const { openSidebarLeft, sidebarLeft, sidebarRight } = useSidebar()
const { showErrorT } = useAlerts()

const onOpen = () => {
  let selectConfigLocal = cloneDeep(selectConfigs.value)
  if (!props.skipCurrentUserCheck) {
    selectConfigLocal = filterAllowedImageWidgetSelectConfigs(selectConfigs.value)
  }
  if (selectConfigLocal.length === 0) {
    showErrorT('common.assetSelect.error.unallowedLicence')
    return
  }

  initStoreContext(
    selectConfigLocal,
    assetType.value,
    1 === props.minCount && props.minCount === props.maxCount,
    props.minCount,
    props.maxCount
  )
  resetAssetList()
  openSidebarLeft()
  modelValue.value = true
}

watch(
  modelValue,
  async (newValue, oldValue) => {
    if (newValue === oldValue || !newValue) return
    onOpen()
  },
  { immediate: true }
)

const onClose = () => {
  modelValue.value = false
  assetDetailStore.reset()
}

const getCopyToLicenceId = () => {
  if (copyToLicence.value && props.uploadLicence) {
    return props.uploadLicence
  }
  return undefined
}

const onConfirm = () => {
  emit('onConfirm', getSelectedData(props.returnType, getCopyToLicenceId()))
  onClose()
}

const autoloadOnIntersect = (isIntersecting: boolean) => {
  if (isIntersecting && pagination.hasNextPage === true) {
    fetchNextPage()
  }
}

const { gridView } = useGridView()

const showCopyToLicence = computed(() => {
  return (
    assetType.value === DamAssetType.Image &&
    selectedLicenceId.value > 0 &&
    !isUndefined(props.uploadLicence) &&
    selectedLicenceId.value !== props.uploadLicence
  )
})

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

const typeChange = () => {
  assetSelectStore.reset()
  assetDetailStore.reset()
  fetchAssetList()
}

const sortByChange = (option: DatatableOrderingOption) => {
  pagination.sortBy = null
  if (option.sortBy) {
    pagination.sortBy = option.sortBy.key
    pagination.descending = option.sortBy.order === 'desc'
  }
  fetchAssetList()
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

onMounted(async () => {
  if (props.initialPaginationSort) {
    pagination.sortBy = props.initialPaginationSort.key
    pagination.descending = props.initialPaginationSort.order === 'desc'
  }
  loading.value = true
  selectConfigs.value = await getOrLoadDamConfigExtSystemByLicences(props.selectLicences)
  loading.value = false
})

onUnmounted(() => {
  selectConfigs.value = []
  assetDetailStore.reset()
})

defineExpose({
  open: onOpen,
})
</script>

<template>
  <div
    v-if="loading"
    class="w-100 d-flex align-center justify-center"
  >
    <VProgressCircular indeterminate />
  </div>
  <template v-else-if="selectConfigs.length > 0">
    <slot
      name="activator"
      :props="{ onClick: withModifiers(() => onOpen(), ['stop']) }"
    />
    <VDialog
      v-model="modelValue"
      fullscreen
      class="subject-select"
    >
      <VCard
        v-if="modelValue"
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
        <AssetSelectListBar
          v-model:sort="sortModel"
          :sort-variant="sortVariant"
          :disable-sort="disableSort"
          :custom-sort-options="customSortOptions"
          show-types
          @type-change="typeChange"
          @sort-by-change="sortByChange"
        />
        <div
          class="subject-select__main"
          :class="{
            'subject-select__main--sidebar-active': sidebarLeft,
            'subject-select__main--sidebar-right-active': sidebarRight,
          }"
        >
          <div class="subject-select__sidebar system-border-r">
            <AssetSelectFilter />
          </div>
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
                <slot name="button-confirm-title">
                  {{ t('common.button.loadMore') }}
                </slot>
              </ABtnSecondary>
            </div>
          </div>
          <div class="subject-select__sidebar-right system-border-l">
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
            <div v-else>
              <AssetMetadata
                v-if="extId && !customFormConfigLoading"
                :ext-system="extId"
                readonly
              />
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
          <VSwitch
            v-if="showCopyToLicence"
            v-model="copyToLicence"
            :label="t('common.assetSelect.meta.texts.copyToLicence')"
            hide-details
            class="mr-2"
          />
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
  <div v-else>
    Error, no select licence.
  </div>
</template>
