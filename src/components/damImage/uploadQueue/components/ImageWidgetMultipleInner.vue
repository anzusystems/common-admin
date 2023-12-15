<script lang="ts" setup>
import type { DocId, IntegerId } from '@/types/common'
import { computed, inject, nextTick, onMounted, ref, type ShallowRef, toRaw } from 'vue'
import { isNull, isString, isUndefined } from '@/utils/common'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import { ImageWidgetExtSystemConfigs } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import type { DamExtSystemConfig } from '@/types/coreDam/DamConfig'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import ImageWidgetMultipleItem from '@/components/damImage/uploadQueue/components/ImageWidgetMultipleItem.vue'
import { storeToRefs } from 'pinia'
import { bulkUpdateImages, deleteImage, fetchImageListByIds } from '@/components/damImage/uploadQueue/api/imageApi'
import { useCommonAdminImageOptions } from '@/components/damImage/composables/commonAdminImageOptions'
import { useAlerts } from '@/composables/system/alerts'
import { type AssetSearchListItemDto, DamAssetType } from '@/types/coreDam/Asset'
import AAssetSelect from '@/components/dam/assetSelect/AAssetSelect.vue'
import AFileInput from '@/components/file/AFileInput.vue'
import AImageDropzone from '@/components/file/AFileDropzone.vue'
import { useDamAcceptTypeAndSizeHelper } from '@/components/damImage/uploadQueue/composables/acceptTypeAndSizeHelper'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import type { AssetSelectReturnData } from '@/types/coreDam/AssetSelect'
import UploadQueueDialog from '@/components/damImage/uploadQueue/components/UploadQueueDialog.vue'
import { useUploadQueueDialog } from '@/components/damImage/uploadQueue/composables/uploadQueueDialog'
import AssetDetailDialog from '@/components/damImage/uploadQueue/components/AssetDetailDialog.vue'
import { fetchAssetByFileId, fetchAssetListByIds } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import type { ImageCreateUpdateAware } from '@/types/ImageAware'
import { generateUUIDv1 } from '@/utils/generator'
import { CHOSEN_CLASS, DRAG_CLASS, GHOST_CLASS, GROUP_CLASS, HANDLE_CLASS } from '@/components/sortable/sortableActions'
import { useSortable, type UseSortableReturn } from '@vueuse/integrations/useSortable'
import type { SortableEvent } from 'sortablejs'
import { WIDGET_HTML_ID_PREFIX } from '@/components/sortable/sortableUtils'
import { fetchAuthorListByIds } from '@/components/damImage/uploadQueue/api/authorApi'
import { useI18n } from 'vue-i18n'
import useVuelidate from '@vuelidate/core'
import { AImageMetadataValidationScopeSymbol } from '@/components/damImage/uploadQueue/composables/uploadValidations'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'

const props = withDefaults(
  defineProps<{
    modelValue: IntegerId[]
    queueKey: UploadQueueKey
    licenceId: IntegerId
    extSystem: IntegerId
    configName?: string
    label?: string | undefined
    readonly?: boolean
    dataCy?: string | undefined
    width?: number | undefined
    disableDraggable?: boolean
    widgetIdentifierId?: string | undefined
    callDeleteApiOnRemove?: boolean
  }>(),
  {
    configName: 'default',
    label: undefined,
    image: undefined,
    readonly: false,
    lockable: false,
    lockedById: undefined,
    dataCy: undefined,
    width: undefined,
    disableDraggable: false,
    widgetIdentifierId: undefined,
    callDeleteApiOnRemove: false,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', data: IntegerId[]): void
}>()

const assetSelectDialog = ref(false)

const imageWidgetExtSystemConfigs = inject<ShallowRef<Map<IntegerId, DamExtSystemConfig>> | undefined>(
  ImageWidgetExtSystemConfigs,
  undefined
)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imageWidgetExtSystemConfig = imageWidgetExtSystemConfigs?.value?.get(props.extSystem)

if (isUndefined(imageWidgetExtSystemConfigs) || isUndefined(imageWidgetExtSystemConfig)) {
  throw new Error("Fatal error, parent component doesn't provide necessary config ext system config.")
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imageOptions = useCommonAdminImageOptions(props.configName)
const { imageClient } = imageOptions
const { showErrorsDefault, showValidationError } = useAlerts()
const uploadButtonComponent = ref<InstanceType<any> | null>(null)

const { uploadSizes, uploadAccept } = useDamAcceptTypeAndSizeHelper(
  DamAssetType.Image,
  imageWidgetExtSystemConfig
)

const { t } = useI18n()

const imagesLoading = ref(false)

const imageStore = useImageStore()
const { images, maxPosition } = storeToRefs(imageStore)

const fetchImagesOnLoad = async () => {
  try {
    imagesLoading.value = true
    const imagesRes = await fetchImageListByIds(imageClient, props.modelValue)
    imageStore.setImages(
      imagesRes.map((imageRes) => {
        imageStore.updateMaxPositionIfGreater(imageRes.position)
        return {
          key: generateUUIDv1(),
          ...imageRes,
        }
      })
    )
    emit('update:modelValue', images.value.map((image) => image.id).filter((id) => id !== undefined) as IntegerId[])
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    imagesLoading.value = false
  }
}

const uploadQueuesStore = useUploadQueuesStore()

const uploadQueue = computed(() => {
  return uploadQueuesStore.getQueue(props.queueKey)
})

const { cachedExtSystemId } = useExtSystemIdForCached()

const { uploadQueueDialog } = useUploadQueueDialog()

const onFileInput = (files: File[]) => {
  cachedExtSystemId.value = props.extSystem
  uploadQueuesStore.addByFiles(props.queueKey, props.extSystem, props.licenceId, files)
  uploadQueueDialog.value = props.queueKey
}

const onDrop = (files: File[]) => {
  cachedExtSystemId.value = props.extSystem
  uploadQueuesStore.addByFiles(props.queueKey, props.extSystem, props.licenceId, files)
  uploadQueueDialog.value = props.queueKey
}

const assetSelectConfirmMap = async (items: AssetSearchListItemDto[]) => {
  const ids = items.map((item) => item.id)
  const assetMetadataMap = new Map<DocId, { description: string; authorIds: DocId[] }>()
  const authorIdsToFetch = new Set<DocId>()
  const authorsMap = new Map<DocId, string>()
  try {
    const assetDetails = await fetchAssetListByIds(damClient, ids, props.licenceId)
    assetDetails.forEach((assetDetail) => {
      assetMetadataMap.set(assetDetail.id, {
        description: isString(assetDetail.metadata.customData?.description)
          ? assetDetail.metadata.customData.description.trim()
          : '',
        authorIds: assetDetail.authors,
      })
    })
    assetMetadataMap.forEach((assetMeta) => {
      assetMeta.authorIds.forEach((authorId) => {
        authorIdsToFetch.add(authorId)
      })
    })
    if (authorIdsToFetch.size > 0) {
      const authorsRes = await fetchAuthorListByIds(damClient, props.extSystem, [...authorIdsToFetch])
      authorsRes.forEach((author) => {
        authorsMap.set(author.id, author.name)
      })
    }
  } catch (e) {
    showErrorsDefault(e)
  }

  return items.map((asset) => {
    maxPosition.value++
    const description = assetMetadataMap.get(asset.id)?.description
    const authorNames: string[] = []
    assetMetadataMap.get(asset.id)?.authorIds.forEach((authorId) => {
      const name = authorsMap.get(authorId)
      if (!isUndefined(name) && name.trim().length > 0) {
        authorNames.push(name)
      }
    })
    return {
      key: generateUUIDv1(),
      texts: {
        description: description ?? '',
        source: authorNames.join(', '),
      },
      dam: {
        damId: asset.mainFile!.id,
        regionPosition: 0,
        licenceId: props.licenceId,
      },
      position: maxPosition.value,
    }
  })
}

const onAssetSelectConfirm = async (data: AssetSelectReturnData) => {
  if (data.type === 'asset') {
    if (data.value.length === 0) return
    const items = await assetSelectConfirmMap(data.value.filter((asset) => !isNull(asset.mainFile)))
    imageStore.addImages(items)
  }
}

const assetDetailStore = useAssetDetailStore()
const { loading: assetLoading, dialog: assetDialog } = storeToRefs(assetDetailStore)
const { damClient } = useCommonAdminCoreDamOptions()

const onEditAsset = async (assetFileId: DocId) => {
  assetLoading.value = true
  cachedExtSystemId.value = props.extSystem
  assetDialog.value = props.queueKey
  try {
    const asset = await fetchAssetByFileId(damClient, assetFileId)
    assetDetailStore.setAsset(asset)
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    assetLoading.value = false
  }
}

const onAssetUploadConfirm = (items: ImageCreateUpdateAware[]) => {
  if (items.length === 0) return
  imageStore.addImages(
    items.map((item) => {
      maxPosition.value++
      return {
        key: generateUUIDv1(),
        ...item,
        position: maxPosition.value,
      }
    })
  )
  uploadQueueDialog.value = null
  uploadQueuesStore.stopUpload(props.queueKey)
}

const actionLibrary = () => {
  assetSelectDialog.value = true
}

const v$ = useVuelidate({}, {}, { $scope: AImageMetadataValidationScopeSymbol })

const saveImages = async () => {
  v$.value.$touch()
  if (v$.value.$invalid) {
    showValidationError()
    return false
  }
  try {
    const resItems = await bulkUpdateImages(imageClient, toRaw(images.value))
    const ids: IntegerId[] = []
    const items = resItems.map((resItem) => {
      ids.push(resItem.id)
      return {
        key: generateUUIDv1(),
        ...resItem,
      }
    })
    imageStore.setImages(items)
    emit('update:modelValue', ids)
    return true
  } catch (e) {
    return false
  }
}

const removeItem = async (index: number) => {
  const image = images.value[index]
  if (!image) return
  if (isUndefined(image.id)) {
    imageStore.removeImageByIndex(index)
    return
  }
  if (props.callDeleteApiOnRemove) {
    try {
      await deleteImage(imageClient, image.id)
      imageStore.removeImageByIndex(index)
    } catch (e) {
      showErrorsDefault(e)
    }
    return
  }
  imageStore.removeImageByIndex(index)
}

const widgetEl = ref<HTMLElement | null>(null)
const randomUuid = ref<string>(generateUUIDv1())
const sortableInstance = ref<UseSortableReturn | null>(null)
const forceRerender = ref(0)

const widgetHtmlId = computed(() => {
  return isUndefined(props.widgetIdentifierId) ? WIDGET_HTML_ID_PREFIX + randomUuid.value : props.widgetIdentifierId
})

const forceRerenderWidgetHtml = () => {
  forceRerender.value++
  nextTick(() => {
    initSortable()
  })
}

const updateAllPositions = () => {
  let pos = 0
  images.value.forEach((image) => {
    pos++
    image.position = pos
  })
  imageStore.maxPosition = pos
}
const moveImagePositions = (from: number, to: number) => {
  if (to >= 0 && to < images.value.length) {
    const element = images.value.splice(from, 1)[0]
    images.value.splice(to, 0, element)
    updateAllPositions()
    forceRerenderWidgetHtml()
  }
}

const initSortable = () => {
  if (props.disableDraggable) return
  if (!widgetEl.value) return
  const nestedSortable = widgetEl.value.querySelector<HTMLElement>('.' + GROUP_CLASS)
  if (!nestedSortable) return
  sortableInstance.value = useSortable(nestedSortable, [], {
    handle: '.' + HANDLE_CLASS,
    ghostClass: GHOST_CLASS,
    dragClass: DRAG_CLASS,
    chosenClass: CHOSEN_CLASS,
    onEnd: async (event: SortableEvent) => {
      if (isUndefined(event.oldIndex) || isUndefined(event.newIndex)) return
      moveImagePositions(event.oldIndex, event.newIndex)
    },
  })
}

nextTick(() => {
  widgetEl.value = document.querySelector('#' + widgetHtmlId.value)
  initSortable()
})

defineExpose({
  saveImages,
})

onMounted(() => {
  fetchImagesOnLoad()
})
</script>

<template>
  <div :id="widgetHtmlId">
    <h4
      v-if="label"
      class="font-weight-bold text-subtitle-2"
    >
      {{ label }}
    </h4>
    <div class="pb-2">
      <AFileInput
        :file-input-key="uploadQueue?.fileInputKey"
        :accept="uploadAccept"
        :max-sizes="uploadSizes"
        @files-input="onFileInput"
      >
        <template #activator="{ props: fileInputProps }">
          <VBtn
            ref="uploadButtonComponent"
            v-bind="fileInputProps"
          >
            {{ t('common.damImage.image.button.upload') }}
          </VBtn>
        </template>
      </AFileInput>
      <VBtn
        class="mr-2"
        @click="actionLibrary"
      >
        {{ t('common.damImage.image.button.addFromDam') }}
      </VBtn>
    </div>
    <AAssetSelect
      v-model="assetSelectDialog"
      :select-config="[
        {
          title: 'Default',
          licence: licenceId,
          extSystem: extSystem,
        },
      ]"
      :min-count="1"
      :max-count="50"
      :asset-type="DamAssetType.Image"
      return-type="asset"
      @on-confirm="onAssetSelectConfirm"
    />

    <div
      class="position-relative w-100"
      style="min-height: 140px"
    >
      <div
        :key="forceRerender"
        :class="GROUP_CLASS"
        class="asset-list-tiles asset-list-tiles--thumbnail"
      >
        <ImageWidgetMultipleItem
          v-for="(image, index) in images"
          :key="image.key"
          :index="index"
          :disable-draggable="disableDraggable"
          @edit-asset="onEditAsset"
          @remove-item="removeItem"
        />
      </div>
      <AImageDropzone
        variant="fill"
        :hover-only="modelValue.length > 0 || images.length > 0"
        :accept="uploadAccept"
        :max-sizes="uploadSizes"
        @on-drop="onDrop"
        @on-click="uploadButtonComponent?.$el.click()"
      />
    </div>
    <UploadQueueDialog
      v-if="uploadQueueDialog === queueKey"
      :queue-key="queueKey"
      :ext-system="extSystem"
      :licence-id="licenceId"
      :file-input-key="uploadQueue?.fileInputKey ?? -1"
      :accept="uploadAccept"
      :max-sizes="uploadSizes"
      multiple
      @on-apply="onAssetUploadConfirm"
    />
    <AssetDetailDialog
      v-if="assetDialog === queueKey"
      :queue-key="queueKey"
      :ext-system="extSystem"
    />
  </div>
</template>
