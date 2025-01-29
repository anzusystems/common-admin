<script lang="ts" setup>
import type { DocId, IntegerId } from '@/types/common'
import { computed, inject, nextTick, onMounted, ref, type ShallowRef, toRaw } from 'vue'
import { isNull, isString, isUndefined } from '@/utils/common'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
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
import {
  type AssetAuthorsItems,
  bulkUpdateAssetsAuthors,
  fetchAssetByFileId,
  fetchAssetListByIds,
  type IdsGroupedByLicences,
} from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import type { ImageStoreItem } from '@/types/ImageAware'
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
import { fetchDamAssetLicence } from '@/components/damImage/uploadQueue/api/damAssetLicenceApi'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import ImageWidgetMultipleLimitDialog from '@/components/damImage/uploadQueue/components/ImageWidgetMultipleLimitDialog.vue'
import { ImageWidgetUploadConfig } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import { fetchAssetListByFileIdsMultipleLicences } from '@/components/damImage/uploadQueue/api/damfetchAssetListByFileIdsMultipleLicences'

const props = withDefaults(
  defineProps<{
    modelValue: IntegerId[]
    queueKey: UploadQueueKey
    uploadLicence: IntegerId
    selectLicences: IntegerId[]
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

const imageWidgetUploadConfig = inject<ShallowRef<DamConfigLicenceExtSystemReturnType | undefined> | undefined>(
  ImageWidgetUploadConfig,
  undefined
)

if (isUndefined(imageWidgetUploadConfig) || isUndefined(imageWidgetUploadConfig.value)) {
  throw new Error("Fatal error, parent component doesn't provide necessary config ext system config.")
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imageOptions = useCommonAdminImageOptions(props.configName)
const { imageClient } = imageOptions
const { showErrorsDefault, showValidationError } = useAlerts()
const uploadButtonComponent = ref<InstanceType<any> | null>(null)

const { uploadSizes, uploadAccept } = useDamAcceptTypeAndSizeHelper(
  DamAssetType.Image,
  imageWidgetUploadConfig.value.extSystemConfig
)

const { t } = useI18n()

const imagesLoading = ref(false)

const imageStore = useImageStore()
const { images, maxPosition } = storeToRefs(imageStore)

const fetchImagesOnLoad = async () => {
  try {
    imagesLoading.value = true
    const imagesRes = await fetchImageListByIds(imageClient, props.modelValue)
    const groupedIds: IdsGroupedByLicences = new Map()
    imagesRes.forEach((image) => {
      const group = groupedIds.get(image.dam.licenceId)
      if (group) {
        group.push(image.dam.damId)
      } else {
        groupedIds.set(image.dam.licenceId, [image.dam.damId])
      }
    })

    const assetsRes = await fetchAssetListByFileIdsMultipleLicences(damClient, groupedIds)

    imageStore.setImages(
      imagesRes.map((imageRes) => {
        if (isUndefined(imageRes.position)) throw new Error('Image object needs position field!')
        imageStore.updateMaxPositionIfGreater(imageRes.position)
        const found = assetsRes.find((asset) => asset.mainFile?.id === imageRes.dam.damId)
        return {
          key: generateUUIDv1(),
          ...imageRes,
          ...{
            damAuthors: found ? found.authors : [],
            showDamAuthors: found ? found.authors.length === 0 : false,
            assetId: found ? found.id : undefined,
          },
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
  const config = imageWidgetUploadConfig.value
  if (isUndefined(config)) return
  cachedExtSystemId.value = config.extSystem
  // uploadQueuesStore.addByFiles(props.queueKey, props.uploadConfig.extSystem, props.uploadConfig.licence, files)
  limitDialogComponent.value?.check(files)
  uploadQueueDialog.value = props.queueKey
}

const onDrop = (files: File[]) => {
  const config = imageWidgetUploadConfig.value
  if (isUndefined(config)) return
  cachedExtSystemId.value = config.extSystem
  limitDialogComponent.value?.check(files)
  // uploadQueuesStore.addByFiles(props.queueKey, props.uploadConfig.extSystem, props.uploadConfig.licence, files)
  uploadQueueDialog.value = props.queueKey
}

const afterLimitDialogAdd = () => {
  uploadQueueDialog.value = props.queueKey
}

const assetSelectConfirmMap = async (items: AssetSearchListItemDto[]): Promise<ImageStoreItem[]> => {
  const assetSelectStore = useAssetSelectStore()
  const ids = items.map((item) => item.id)
  const assetMetadataMap = new Map<DocId, { description: string; authorIds: DocId[] }>()
  const authorIdsToFetch = new Set<DocId>()
  const authorsMap = new Map<DocId, string>()
  try {
    const assetDetails = await fetchAssetListByIds(damClient, ids, assetSelectStore.selectedLicenceId)
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
      const authorsRes = await fetchAuthorListByIds(damClient, assetSelectStore.selectedSelectConfig.extSystem, [
        ...authorIdsToFetch,
      ])
      authorsRes.forEach((author) => {
        authorsMap.set(author.id, author.name)
      })
    }
  } catch (e) {
    showErrorsDefault(e)
  }

  return items.map((asset) => {
    maxPosition.value++
    const authorIds = assetMetadataMap.get(asset.id)?.authorIds || []
    const description = assetMetadataMap.get(asset.id)?.description ?? ''
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
        description: description,
        source: authorNames.join(', '),
      },
      flags: {
        showSource: true,
      },
      dam: {
        damId: asset.mainFile!.id,
        regionPosition: 0,
        licenceId: asset.licence,
      },
      position: maxPosition.value,
      damAuthors: authorIds,
      showDamAuthors: authorIds.length === 0,
      assetId: asset.id,
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
  assetDialog.value = props.queueKey
  try {
    const asset = await fetchAssetByFileId(damClient, assetFileId)
    const licence = await fetchDamAssetLicence(damClient, asset.licence)
    if (licence.extSystem) {
      cachedExtSystemId.value = licence.extSystem
    }
    assetDetailStore.setAsset(asset)
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    assetLoading.value = false
  }
}

const onAssetUploadConfirm = (items: ImageStoreItem[]) => {
  if (items.length === 0) return
  imageStore.addImages(
    items.map((item) => {
      maxPosition.value++
      return {
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

const v$ = useVuelidate({ $scope: AImageMetadataValidationScopeSymbol })

const saveImages = async () => {
  v$.value.$touch()
  if (v$.value.$invalid) {
    showValidationError()
    return false
  }
  try {
    const assetUpdateItems: AssetAuthorsItems = []
    const imagesRaw = toRaw(images.value)
    for (const image of imagesRaw) {
      if (image.showDamAuthors && image.assetId) {
        assetUpdateItems.push({ id: image.assetId, authors: image.damAuthors })
      }
      if (image.damAuthors.length > 0) {
        const authorsRes = await fetchAuthorListByIds(damClient, cachedExtSystemId.value, image.damAuthors)
        image.texts.source = authorsRes.map((author) => author.name).join(', ')
      }
    }
    if (assetUpdateItems.length) {
      await bulkUpdateAssetsAuthors(damClient, assetUpdateItems)
    }
    const resItems = await bulkUpdateImages(imageClient, toRaw(images.value))
    const ids: IntegerId[] = []
    const items = resItems.map((resItem) => {
      ids.push(resItem.id)

      return {
        key: generateUUIDv1(),
        ...resItem,
        damAuthors: [],
        showDamAuthors: false,
        assetId: undefined,
      }
    })
    if (imageStore.images.length === 0) return

    const getUpdatedItem = async (item: ImageStoreItem): Promise<ImageStoreItem> => {
      const matchedImage = imageStore.images.find((storeItem) => storeItem.dam.damId === item.dam.damId)

      return {
        ...item,
        damAuthors: matchedImage ? matchedImage.damAuthors : item.damAuthors,
        showDamAuthors: matchedImage ? matchedImage.damAuthors.length === 0 : item.damAuthors.length === 0,
        assetId: item.assetId,
      }
    }

    const updatedItems = await Promise.all(items.map((item) => getUpdatedItem(item)))
    imageStore.setImages(updatedItems)
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
const limitDialogComponent = ref<InstanceType<typeof ImageWidgetMultipleLimitDialog> | null>(null)

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
        multiple
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
      :select-licences="selectLicences"
      :min-count="1"
      :max-count="50"
      :asset-type="DamAssetType.Image"
      return-type="asset"
      @on-confirm="onAssetSelectConfirm"
    />
    <div
      v-if="imagesLoading"
      class="w-100 d-flex align-center justify-center"
    >
      <VProgressCircular
        indeterminate
        color="primary"
      />
    </div>
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
      v-if="uploadQueueDialog === queueKey && imageWidgetUploadConfig"
      :queue-key="queueKey"
      :ext-system="imageWidgetUploadConfig.extSystem"
      :licence-id="imageWidgetUploadConfig.licence"
      :file-input-key="uploadQueue?.fileInputKey ?? -1"
      :accept="uploadAccept"
      :max-sizes="uploadSizes"
      multiple
      @on-apply="onAssetUploadConfirm"
      @on-files-input="onFileInput"
    />
    <AssetDetailDialog
      v-if="assetDialog === queueKey"
      :queue-key="queueKey"
      :ext-system="cachedExtSystemId"
    />
    <ImageWidgetMultipleLimitDialog
      ref="limitDialogComponent"
      :queue-key="queueKey"
      @after-add="afterLimitDialogAdd"
    />
  </div>
</template>
