<script lang="ts" setup>
import { computed, onMounted, onUnmounted, provide, ref, shallowRef, watch, withModifiers } from 'vue'
import ADialogToolbar from '@/domains/ui/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import { DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import { useAssetSelectActions } from '@/domains/dam/assetSelect/composables/assetSelectListActions'
import AssetSelectListTable from '@/domains/dam/assetSelect/components/AssetSelectListTable.vue'
import AssetSelectListBar from '@/domains/dam/assetSelect/components/AssetSelectListBar.vue'
import { AssetSelectGridView, useGridView } from '@/domains/dam/assetSelect/composables/assetSelectGridView'
import AssetSelectListTiles from '@/domains/dam/assetSelect/components/AssetSelectListTiles.vue'
import { useSidebar } from '@/domains/dam/assetSelect/composables/assetSelectFilterSidebar'
import AssetSelectFilter from '@/domains/dam/assetSelect/components/AssetSelectFilter.vue'
import {
  type AssetSelectReturnData,
  AssetSelectReturnType,
  type AssetSelectReturnTypeType,
} from '@/domains/dam/types/AssetSelect'
import { filterAllowedImageWidgetSelectConfigs } from '@/domains/dam/config/utils/damFilterUserAllowedUploadConfigs'
import { useAlerts } from '@/domains/system/composables/alerts'
import type { IntegerId } from '@/shared/types/common'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'
import { cloneDeep, isUndefined } from '@/shared/utils/common'
import AssetMetadata from '@/domains/dam/assetDetail/components/AssetMetadata.vue'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { storeToRefs } from 'pinia'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { type DatatableOrderingOption } from '@/domains/filters/datatable/utils/datatableColumns'
import { DatatablePaginationKey } from '@/domains/filters/utils/filterInjectionKeys'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const props = withDefaults(
  defineProps<{
    minCount: number
    maxCount: number
    selectLicences: IntegerId[]
    uploadLicence?: IntegerId | undefined
    returnType?: AssetSelectReturnTypeType
    configName?: string
    skipCurrentUserCheck?: boolean
    preselectAssetType?: DamAssetTypeType | undefined
    preselectInPodcast?: boolean | null | undefined
  }>(),
  {
    uploadLicence: undefined,
    returnType: AssetSelectReturnType.MainFileId,
    configName: undefined,
    skipCurrentUserCheck: false,
    preselectAssetType: undefined,
    preselectInPodcast: undefined,
  }
)

const emit = defineEmits<{
  (e: 'confirm', data: AssetSelectReturnData): void
}>()

const modelValue = defineModel<boolean>({ default: false, required: false })
const sortModel = defineModel<number>('sort', { default: 1, required: false })
const ready = defineModel<boolean>('ready', { default: false, required: false })
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const loading = ref(false)
const copyToLicence = ref(false)

const { t } = useI18n()

const {
  damClient,
  selectedCount,
  loader,
  pagination,
  fetchNextPage,
  fetchNextPageInView,
  fetchAssetListDebounced,
  getSelectedData,
  initStoreContext,
  detailLoading,
  giveUpDetailRead,
  reset,
} = useAssetSelectActions(damConfigName)
// The ordering in the list bar reads this; without it the dialog would pick up the host page's pagination.
provide(DatatablePaginationKey, pagination)

const { loadDamConfigAssetCustomFormElements, getDamConfigAssetCustomFormElements } = useDamConfigState(
  damClient,
  damConfigName
)
const { getOrLoadDamConfigExtSystemByLicences } = useDamConfigState(damClient, damConfigName)
const assetDetailStore = useAssetDetailStore()
const { asset } = storeToRefs(assetDetailStore)
const assetSelectStore = useAssetSelectStore()
const { selectedLicenceId, assetType } = storeToRefs(assetSelectStore)
const { copyToLicenceEnabled } = useCommonAdminCoreDamOptions(damConfigName)

const selectConfigs = shallowRef<DamConfigLicenceExtSystemReturnType[]>([])

const { openSidebarLeft, sidebarLeft, sidebarRight } = useSidebar()
const { showErrorT } = useAlerts()

const onOpen = () => {
  if (!ready.value) return
  let selectConfigLocal = cloneDeep(selectConfigs.value)
  if (!props.skipCurrentUserCheck) {
    selectConfigLocal = filterAllowedImageWidgetSelectConfigs(selectConfigs.value, damConfigName)
  }
  if (selectConfigLocal.length === 0) {
    showErrorT('common.assetSelect.error.unallowedLicence')
    // Not opened over no licence: it would list nothing, and the next press would not say why.
    modelValue.value = false
    return
  }

  reset()
  initStoreContext(
    selectConfigLocal,
    assetType.value,
    assetType.value === DamAssetType.Audio ? true : null,
    1 === props.minCount && props.minCount === props.maxCount,
    props.minCount,
    props.maxCount
  )
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
  reset()
}

// The switch as the user left it, for the picked assets of another licence than the one of the upload: the picked ones
// outlive a change of the licence browsed, so the licence of each decides, not the one browsed now. One already in
// the licence of the upload is not copied; the widget takes it as it is.
const getCopyToLicenceId = () => {
  if (
    copyToLicenceEnabled !== false &&
    assetType.value === DamAssetType.Image &&
    copyToLicence.value &&
    props.uploadLicence &&
    [...assetSelectStore.selectedAssets.values()].some(({ asset }) => asset.licence !== props.uploadLicence)
  ) {
    return props.uploadLicence
  }
  return undefined
}

const onConfirm = () => {
  emit('confirm', getSelectedData(props.returnType, getCopyToLicenceId()))
  onClose()
}

const { gridView } = useGridView()

const showCopyToLicence = computed(() => {
  return (
    copyToLicenceEnabled !== false &&
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
// The configuration of the custom fields could not be read: the side panel says so, in place of the form of the
// asset, which cannot be drawn without it. It used to load without an end.
const customFormConfigFailed = ref(false)

const typeChange = () => {
  assetSelectStore.reset(false)
  // The read of a click in the list of the type left: its answer would show that asset beside the list of another type.
  giveUpDetailRead()
  assetDetailStore.reset()
  fetchAssetListDebounced()
}

const sortByChange = (option: DatatableOrderingOption) => {
  pagination.value.sortBy = null
  if (option.sortBy) {
    pagination.value.sortBy = { key: option.sortBy.key, order: option.sortBy.order }
  }
  fetchAssetListDebounced()
}

// Also as the type it lists changes: the custom fields of that type need not be loaded.
watch(
  [extId, assetType],
  async ([newValue, type]) => {
    if (isUndefined(newValue)) return
    customFormConfigLoading.value = true
    customFormConfigFailed.value = false
    // The custom fields of the type it lists: every type of the ext system where it has none yet, else that type alone
    // where its read failed before. The types loaded are not read again.
    if (isUndefined(getDamConfigAssetCustomFormElements(newValue, type))) {
      try {
        await loadDamConfigAssetCustomFormElements(
          newValue,
          getDamConfigAssetCustomFormElements(newValue) ? [type] : undefined
        )
      } catch (e) {
        showErrorsDefault(e)
      }
      // The answer for an ext system or a type the list has left since says nothing of what it lists now.
      if (extId.value !== newValue || assetType.value !== type) return
      customFormConfigFailed.value = isUndefined(getDamConfigAssetCustomFormElements(newValue, type))
    }
    customFormConfigLoading.value = false
  },
  { immediate: true }
)

onMounted(async () => {
  ready.value = false
  loading.value = true
  selectConfigs.value = await getOrLoadDamConfigExtSystemByLicences(props.selectLicences)
  loading.value = false
  ready.value = true
})

onUnmounted(() => {
  selectConfigs.value = []
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
          class="subject-select__toolbar border-b"
          @cancel="onClose"
        >
          <slot name="title">
            {{ t('common.assetSelect.meta.texts.title') }}
          </slot>
        </ADialogToolbar>
        <AssetSelectListBar
          v-model:sort="sortModel"
          show-types
          :preselect-asset-type="preselectAssetType"
          :preselect-in-podcast="preselectInPodcast"
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
          <div class="subject-select__sidebar border-e">
            <AssetSelectFilter :config-name="damConfigName" />
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
                v-intersect="fetchNextPageInView"
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
          <div class="subject-select__sidebar-right border-s">
            <div
              v-if="customFormConfigFailed"
              class="d-flex w-100 align-center justify-center text-body-large"
            >
              {{ t('common.damImage.error.loadingConfig') }}
            </div>
            <div
              v-else-if="loadingSidebarRight"
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
            <div v-else>
              <AssetMetadata
                v-if="extId && !customFormConfigLoading"
                :ext-system="extId"
                readonly
              />
            </div>
          </div>
        </div>
        <div class="subject-select__actions border-t">
          <div v-if="props.minCount === props.maxCount">
            {{
              t('common.assetSelect.meta.texts.pickExactCount', {
                count: props.minCount,
                selected: selectedCount,
              })
            }}
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
  <div v-else>{{ t('common.assetSelect.error.noSelectLicence') }}</div>
</template>
