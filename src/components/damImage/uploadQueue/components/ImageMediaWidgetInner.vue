<script lang="ts" setup>
import AImageDropzone from '@/components/file/AFileDropzone.vue'
import type { DocId, IntegerId, IntegerIdNullable } from '@/types/common'
import type { ImageAware, ImageCreateUpdateAware } from '@/types/ImageAware'
import imagePlaceholderPath from '@/assets/image/placeholder16x9.jpg'
import { useCommonAdminImageOptions } from '@/components/damImage/composables/commonAdminImageOptions'
import { useImageActions } from '@/components/damImage/composables/imageActions'
import { cloneDeep, isDefined, isNull, isNumber, isString, isUndefined } from '@/utils/common'
import { useAlerts } from '@/composables/system/alerts'
import { DamAssetType, type DamAssetTypeType, type DamImageCopyToLicenceResponse } from '@/types/coreDam/Asset'
import { useDamAcceptTypeAndSizeHelper } from '@/components/damImage/uploadQueue/composables/acceptTypeAndSizeHelper'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import type { AssetSelectReturnData } from '@/types/coreDam/AssetSelect'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import { createImage, deleteImage, fetchImage, updateImage } from '@/components/damImage/uploadQueue/api/imageApi'
import ImageDetailDialogMetadata from '@/components/damImage/uploadQueue/components/ImageDetailDialogMetadata.vue'
import { computed, inject, onMounted, ref, type ShallowRef, toRaw, watch } from 'vue'
import AssetDetailDialog from '@/components/damImage/uploadQueue/components/AssetDetailDialog.vue'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { storeToRefs } from 'pinia'
import {
  fetchAsset,
  fetchAssetAsCmsMedia,
  fetchAssetByFileId,
  updateAssetAuthors,
} from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import UploadQueueDialogSingle from '@/components/damImage/uploadQueue/components/UploadQueueDialogSingle.vue'
import { useUploadQueueDialog } from '@/components/damImage/uploadQueue/composables/uploadQueueDialog'
import { fetchAuthorListByIds } from '@/components/damImage/uploadQueue/api/authorApi'
import { useI18n } from 'vue-i18n'
import type { VBtn } from 'vuetify/components'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { fetchDamAssetLicence } from '@/components/damImage/uploadQueue/api/damAssetLicenceApi'
import {
  type CollabComponentConfig,
  type CollabFieldData,
  type CollabFieldLockOptions,
  CollabStatus,
  type CollabStatusType,
} from '@/components/collab/types/Collab'
import { useCommonAdminCollabOptions } from '@/components/collab/composables/commonAdminCollabOptions'
import { useCollabField } from '@/components/collab/composables/collabField'
import ACollabLockedByUser from '@/components/collab/components/ACollabLockedByUser.vue'
import AFileInputDialog from '@/components/file/AFileInputDialog.vue'
import {
  CollabFieldLockStatus,
  type CollabFieldLockStatusPayload,
  CollabFieldLockType,
} from '@/components/collab/composables/collabEventBus'
import { ImageWidgetUploadConfig } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import AAssetSelectMedia from '@/components/dam/assetSelect/AAssetSelectMedia.vue'
import {
  isImageCreateUpdateAware,
  isMediaAware,
  useImageMediaWidgetStore,
} from '@/components/damImage/uploadQueue/composables/imageMediaWidgetStore'
import { type DamMediaFromDam, DamMediaType, type MediaAware, type MediaEntityKey } from '@/types/MediaAware'
import { assetFileIsAudioFile, assetFileIsVideoFile } from '@/types/coreDam/AssetFile'
import { copyToLicence } from '@/components/damImage/uploadQueue/api/damImageApi'

const props = withDefaults(
  defineProps<{
    queueKey: UploadQueueKey
    uploadLicence: IntegerId
    selectLicences: IntegerId[]
    siteGroup: IntegerId
    mediaEntity: {
      id: DocId | IntegerId
      name: MediaEntityKey
    }
    initialImage?: ImageAware | undefined // optional, if available, no need to fetch image data
    configName?: string
    collab?: CollabComponentConfig
    collabStatus?: CollabStatusType
    label?: string | undefined
    required?: boolean
    readonly?: boolean
    dataCy?: string | undefined
    expandOptions?: boolean
    expandMetadata?: boolean // only one at once, use in dialogs
    disableOnClickMenu?: boolean
    width?: number | undefined
    maxWidth?: number | undefined
    height?: number | undefined
    callDeleteApiOnRemove?: boolean
    damWidth?: undefined | number
    damHeight?: undefined | number
  }>(),
  {
    configName: 'default',
    collab: undefined,
    collabStatus: CollabStatus.Inactive,
    label: undefined,
    required: false,
    initialImage: undefined,
    initialMedia: undefined,
    readonly: false,
    lockable: false,
    lockedById: undefined,
    dataCy: undefined,
    expandOptions: false,
    expandMetadata: false,
    disableOnClickMenu: false,
    width: undefined,
    maxWidth: undefined,
    height: undefined,
    callDeleteApiOnRemove: false,
    damWidth: undefined,
    damHeight: undefined,
  }
)

const emit = defineEmits<{
  (e: 'afterMetadataSaveSuccess'): void
}>()

const imageModel = defineModel<IntegerIdNullable>('image', { required: true })
const mediaModel = defineModel<MediaAware | null>('media', { required: true })

// Collaboration
const { collabOptions } = useCommonAdminCollabOptions()
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const releaseFieldLock = ref((data: CollabFieldData, options?: Partial<CollabFieldLockOptions>) => {})
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const acquireFieldLock = ref((options?: Partial<CollabFieldLockOptions>) => {})
const lockedByUserLocal = ref<IntegerIdNullable>(null)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
if (collabOptions.value.enabled && isDefined(props.collab)) {
  const { releaseCollabFieldLock, acquireCollabFieldLock, addCollabFieldLockStatusListener, lockedByUser } =
    useCollabField(props.collab.room, props.collab.field)
  releaseFieldLock.value = releaseCollabFieldLock
  acquireFieldLock.value = acquireCollabFieldLock
  watch(
    lockedByUser,
    (newValue) => {
      lockedByUserLocal.value = newValue
    },
    { immediate: true }
  )
  addCollabFieldLockStatusListener((data: CollabFieldLockStatusPayload) => {
    if (data.status === CollabFieldLockStatus.Success && data.type === CollabFieldLockType.Acquire) {
      collabFieldLockReallyLocked.value = true
    } else if (data.status === CollabFieldLockStatus.Failure && data.type === CollabFieldLockType.Acquire) {
      collabFieldLockReallyLocked.value = false
    } else if (data.status === CollabFieldLockStatus.Success && data.type === CollabFieldLockType.Release) {
      collabFieldLockReallyLocked.value = false
    } else if (data.status === CollabFieldLockStatus.Failure && data.type === CollabFieldLockType.Release) {
      collabFieldLockReallyLocked.value = true
    }
  })
}
const lockedLocal = ref(false)
const acquireFieldLockLocal = () => {
  if (lockedLocal.value === true || props.collabStatus === CollabStatus.Inactive) return
  acquireFieldLock.value()
  lockedLocal.value = true
}
const releaseFieldLockLocal = (value: IntegerIdNullable) => {
  if (lockedLocal.value === false || props.collabStatus === CollabStatus.Inactive) return
  releaseFieldLock.value(value)
  lockedLocal.value = false
}

const imageWidgetUploadConfig = inject<ShallowRef<DamConfigLicenceExtSystemReturnType | undefined> | undefined>(
  ImageWidgetUploadConfig,
  undefined
)

if (isUndefined(imageWidgetUploadConfig) || isUndefined(imageWidgetUploadConfig.value)) {
  throw new Error("Fatal error, parent component doesn't provide necessary config ext system config.")
}

const { t } = useI18n()

const { showErrorsDefault, showError, showErrorT } = useAlerts()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imageOptions = useCommonAdminImageOptions(props.configName)
const { imageClient } = imageOptions
const { widgetImageToDamImageUrl, damImageIdToDamImageUrl } = useImageActions(imageOptions)
const uploadQueuesStore = useUploadQueuesStore()
const { uploadQueueDialog } = useUploadQueueDialog()

const showDamAuthorsInCmsImage = ref(false)
const resImageMedia = ref<null | ImageCreateUpdateAware | MediaAware>(null)
const clickMenuOpened = ref(false)
const assetSelectDialog = ref(false)
const metadataDialog = ref(false)
const metadataDialogSaving = ref(false)
const metadataDialogLoading = ref(false)
const fileInputDialog = ref(false)

const hideDropzoneText = computed(() => {
  return !isNull(imageModel.value) || !isNull(mediaModel.value)
})

const resolvedSrc = ref('')

const uploadQueue = computed(() => {
  return uploadQueuesStore.getQueue(props.queueKey)
})

const imageMediaLoaded = computed(() => {
  return !isNull(resImageMedia.value)
})

const actionEditMeta = () => {
  imageMediaWidgetStore.setDetail(toRaw(resImageMedia.value))
  metadataDialog.value = true
}

const actionLibrary = () => {
  assetSelectDialog.value = true
}

const { cachedExtSystemId } = useExtSystemIdForCached()

// this ref is updating only when the lock was really success or failure using sockets, needed for drop files
const collabFieldLockReallyLocked = ref(false)

const waitForFieldLockIsReallyAcquired = async () => {
  if (!collabOptions.value.enabled || isUndefined(props.collab) || props.collabStatus === CollabStatus.Inactive) {
    return Promise.resolve(true)
  }

  let count = 0

  const checkLock: () => Promise<Awaited<boolean>> = () => {
    if (collabFieldLockReallyLocked.value) {
      return Promise.resolve(true)
    }

    count++
    if (count < 50) {
      return new Promise((resolve) => setTimeout(() => resolve(checkLock()), 100))
    }

    return Promise.reject(false)
  }

  return checkLock()
}

const onDrop = async (files: File[]) => {
  acquireFieldLockLocal()
  const config = imageWidgetUploadConfig.value
  if (isUndefined(config)) return
  try {
    await waitForFieldLockIsReallyAcquired()
    cachedExtSystemId.value = config.extSystem
    uploadQueuesStore.addByFiles(props.queueKey, config.extSystem, config.licence, files)
    uploadQueueDialog.value = props.queueKey
  } catch (e) {
    showError('Unable to lock image widget by current user.')
  }
}

const onCopyToLicence = (data: DamImageCopyToLicenceResponse) => {
  if (!data[0]) return
  const config = imageWidgetUploadConfig.value
  if (isUndefined(config)) return
  cachedExtSystemId.value = config.extSystem
  if (data[0].result === 'copy') {
    uploadQueuesStore.addByCopyToLicence(props.queueKey, config.extSystem, config.licence, [data[0].targetAsset])
  } else if (data[0].result === 'exists') {
    uploadQueuesStore.addByCopyToLicence(props.queueKey, config.extSystem, config.licence, [data[0].targetAsset])
    uploadQueuesStore.queueItemDuplicate(data[0].targetAsset, data[0].targetMainFile, DamAssetType.Image)
  } else {
    showErrorT('damImage.queueItem.errorUnableToCopyToLicence')
    return
  }
  uploadQueueDialog.value = props.queueKey
}

const onFileInput = (files: File[]) => {
  const config = imageWidgetUploadConfig.value
  if (isUndefined(config)) return
  cachedExtSystemId.value = config.extSystem
  uploadQueuesStore.addByFiles(props.queueKey, config.extSystem, config.licence, files)
  uploadQueueDialog.value = props.queueKey
}

const { uploadSizes, uploadAccept } = useDamAcceptTypeAndSizeHelper(
  DamAssetType.Image,
  imageWidgetUploadConfig.value.extSystemConfig
)

const reloadImage = async (
  newImage: ImageCreateUpdateAware | undefined,
  newImageId: IntegerIdNullable,
  force = false
) => {
  resolvedSrc.value = imagePlaceholderPath
  if ((newImage && isNull(resImageMedia.value)) || (newImage && force)) {
    resImageMedia.value = cloneDeep(newImage)
    if (isImageCreateUpdateAware(resImageMedia.value)) {
      if (isNumber(props.damWidth) && isNumber(props.damHeight)) {
        resolvedSrc.value = widgetImageToDamImageUrl(toRaw(resImageMedia.value), props.damWidth, props.damHeight)
      } else {
        resolvedSrc.value = widgetImageToDamImageUrl(toRaw(resImageMedia.value))
      }
      if (props.expandMetadata) {
        imageMediaWidgetStore.setDetail(toRaw(resImageMedia.value))
      }
    }
    return
  }
  if (newImageId) {
    try {
      resImageMedia.value = await fetchImage(imageClient, newImageId)
    } catch (error) {
      showErrorsDefault(error)
    }
    if (isImageCreateUpdateAware(resImageMedia.value)) {
      if (isNumber(props.damWidth) && isNumber(props.damHeight)) {
        resolvedSrc.value = widgetImageToDamImageUrl(toRaw(resImageMedia.value), props.damWidth, props.damHeight)
      } else {
        resolvedSrc.value = widgetImageToDamImageUrl(toRaw(resImageMedia.value))
      }
      if (props.expandMetadata) {
        imageMediaWidgetStore.setDetail(toRaw(resImageMedia.value))
      }
    }
    return
  }
  resImageMedia.value = null
}

const reloadMedia = (newMedia: MediaAware | null) => {
  resolvedSrc.value = imagePlaceholderPath
  if (newMedia) {
    resImageMedia.value = cloneDeep(newMedia)
    if (isMediaAware(resImageMedia.value) && !isNull(resImageMedia.value.damMedia.imageFileId)) {
      if (isNumber(props.damWidth) && isNumber(props.damHeight)) {
        resolvedSrc.value = damImageIdToDamImageUrl(
          resImageMedia.value.damMedia.imageFileId,
          props.damWidth,
          props.damHeight
        )
      } else {
        resolvedSrc.value = damImageIdToDamImageUrl(resImageMedia.value.damMedia.imageFileId)
      }
      if (props.expandMetadata) {
        imageMediaWidgetStore.setDetail(toRaw(resImageMedia.value))
      }
    }
    return
  }
  resImageMedia.value = null
}

const reset = () => {
  resolvedSrc.value = imagePlaceholderPath
  resImageMedia.value = null
  imageModel.value = null
  mediaModel.value = null
  imageMediaWidgetStore.reset()
  releaseFieldLock.value(null)
}

watch(
  [() => props.initialImage, imageModel],
  async ([newImage, newImageId]) => {
    await reloadImage(newImage, newImageId)
  },
  { immediate: true }
)

watch(
  mediaModel,
  async (newMedia, oldMedia) => {
    if (JSON.stringify(newMedia) === JSON.stringify(oldMedia)) return
    reloadMedia(newMedia)
  },
  { immediate: true }
)

const assetSelectStore = useAssetSelectStore()
const imageMediaWidgetStore = useImageMediaWidgetStore()
const { detail } = storeToRefs(imageMediaWidgetStore)

const onAssetSelectConfirm = async (data: AssetSelectReturnData) => {
  if (data.type !== 'asset' || !data.value[0]) return
  metadataDialogLoading.value = true
  imageMediaWidgetStore.setDetail(null)
  // metadataDialog.value = true
  showDamAuthorsInCmsImage.value = false
  let description = ''
  let source = ''
  const selectedAsset = data.value[0]
  if (!selectedAsset.mainFile) return
  let mediaDataFromDam: DamMediaFromDam | null = null
  try {
    mediaDataFromDam = await fetchAssetAsCmsMedia(damClient, selectedAsset.id)
  } catch (e) {
    showErrorsDefault(e)
  }
  if (!mediaDataFromDam) return
  if (selectedAsset.attributes.assetType === DamAssetType.Video && assetFileIsVideoFile(selectedAsset.mainFile)) {
    // video
    metadataDialog.value = true
    const mediaData: MediaAware = {
      siteGroup: props.siteGroup,
      extService: 'damVideo',
      [props.mediaEntity.name]: props.mediaEntity.id,
      damMedia: {
        imageFileId: selectedAsset.mainFile.imagePreview?.imageFile || null,
        assetId: selectedAsset.id,
        licenceId: selectedAsset.licence,
        assetType: DamAssetType.Video,
        title: mediaDataFromDam.title,
        description: mediaDataFromDam.description,
        seriesName: mediaDataFromDam.seriesName,
        authorNames: mediaDataFromDam.authorNames,
        publishedAt: mediaDataFromDam.publishedAt,
        duration: mediaDataFromDam.duration,
        mediaUrl: mediaDataFromDam.mediaUrl,
        playable: mediaDataFromDam.playable,
        syncedWithDam: true,
        episodeName: mediaDataFromDam.episodeName,
        episodeNumber: mediaDataFromDam.episodeNumber,
      },
    }
    imageMediaWidgetStore.setDetail(mediaData)
  } else if (
    selectedAsset.attributes.assetType === DamAssetType.Audio &&
    selectedAsset.podcasts.length > 0 &&
    assetFileIsAudioFile(selectedAsset.mainFile)
  ) {
    // podcast audio
    metadataDialog.value = true
    const mediaData: MediaAware = {
      siteGroup: props.siteGroup,
      extService: 'damAudio',
      [props.mediaEntity.name]: props.mediaEntity.id,
      damMedia: {
        imageFileId: selectedAsset.mainFile.imagePreview?.imageFile || null,
        assetId: selectedAsset.id,
        licenceId: selectedAsset.licence,
        assetType: DamAssetType.Audio,
        title: mediaDataFromDam.title,
        description: mediaDataFromDam.description,
        seriesName: mediaDataFromDam.seriesName,
        authorNames: mediaDataFromDam.authorNames,
        publishedAt: mediaDataFromDam.publishedAt,
        duration: mediaDataFromDam.duration,
        mediaUrl: mediaDataFromDam.mediaUrl,
        playable: mediaDataFromDam.playable,
        syncedWithDam: true,
        episodeName: mediaDataFromDam.episodeName,
        episodeNumber: mediaDataFromDam.episodeNumber,
      },
    }
    imageMediaWidgetStore.setDetail(mediaData)
  } else if (selectedAsset.attributes.assetType === DamAssetType.Image) {
    // image
    if (!isUndefined(data.copyToLicence)) {
      try {
        const copyRes = await copyToLicence(damClient, [
          { asset: data.value[0].id, targetAssetLicence: data.copyToLicence },
        ])
        onCopyToLicence(copyRes)
      } catch (e) {
        showErrorsDefault(e)
      } finally {
        metadataDialogLoading.value = false
      }
      return
    }
    metadataDialog.value = true
    try {
      const assetRes = await fetchAsset(damClient, selectedAsset.id)
      if (isString(assetRes.metadata.customData?.description)) {
        description = assetRes.metadata.customData.description.trim()
      }
      if (assetRes.authors.length > 0) {
        const authorsRes = await fetchAuthorListByIds(
          damClient,
          assetSelectStore.selectedSelectConfig.extSystem,
          assetRes.authors
        )
        source = authorsRes.map((author) => author.name).join(', ')
      } else if (assetRes.authors.length === 0) {
        showDamAuthorsInCmsImage.value = true
        asset.value = assetRes
      }
    } catch (e) {
      showErrorsDefault(e)
    }
    const image: ImageCreateUpdateAware = {
      texts: {
        description: description,
        source: source,
      },
      flags: {
        showSource: true,
      },
      dam: {
        damId: selectedAsset.mainFile.id,
        regionPosition: 0,
        licenceId: selectedAsset.licence,
      },
      position: 1,
    }
    if (!isNull(imageModel.value)) {
      image.id = imageModel.value
    }
    imageMediaWidgetStore.setDetail(image)
  }
  metadataDialogLoading.value = false
  // forceReloadViewWithExpandMetadata()
}

const assetDetailStore = useAssetDetailStore()
const { loading: assetLoading, dialog: assetDialog, asset } = storeToRefs(assetDetailStore)
const { damClient } = useCommonAdminCoreDamOptions()

const onEditAsset = async (assetFileId: DocId) => {
  assetLoading.value = true
  assetDialog.value = props.queueKey
  try {
    const assetRes = await fetchAssetByFileId(damClient, assetFileId)
    const licence = await fetchDamAssetLicence(damClient, assetRes.licence)
    if (licence.extSystem) {
      cachedExtSystemId.value = licence.extSystem
    }
    assetDetailStore.setAsset(assetRes)
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    assetLoading.value = false
  }
}

const onMetadataDialogClose = () => {
  imageMediaWidgetStore.setDetail(null)
  metadataDialog.value = false
}

const tryMediaConfirm = async () => {
  if (!isMediaAware(detail.value)) return
  metadataDialogSaving.value = true
  try {
    metadataDialog.value = false
    mediaModel.value = detail.value
    imageModel.value = null
    imageMediaWidgetStore.setDetail(null)
    reloadMedia(mediaModel.value)
    emit('afterMetadataSaveSuccess')
    releaseFieldLock.value(mediaModel.value.id)
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    metadataDialogSaving.value = false
  }
}

const tryImageConfirm = async () => {
  if (!isImageCreateUpdateAware(detail.value)) return
  metadataDialogSaving.value = true
  try {
    if (showDamAuthorsInCmsImage.value && asset.value) {
      if (asset.value.authors.length > 0) {
        const authorsRes = await fetchAuthorListByIds(
          damClient,
          assetSelectStore.selectedSelectConfig.extSystem,
          asset.value.authors
        )
        detail.value.texts.source = authorsRes.map((author) => author.name).join(', ')
        await updateAssetAuthors(damClient, asset.value, assetSelectStore.selectedSelectConfig.extSystem)
        showDamAuthorsInCmsImage.value = false
      }
    }
    const res = detail.value.id
      ? await updateImage(imageClient, detail.value.id, detail.value)
      : await createImage(imageClient, detail.value)
    metadataDialog.value = false
    imageModel.value = res.id
    mediaModel.value = null
    imageMediaWidgetStore.setDetail(null)
    await reloadImage(res, res.id, true)
    emit('afterMetadataSaveSuccess')
    releaseFieldLock.value(res.id)
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    metadataDialogSaving.value = false
  }
}

const onMetadataDialogConfirm = async () => {
  await tryMediaConfirm()
  await tryImageConfirm()
}

const onImageMediaDelete = async () => {
  if (props.callDeleteApiOnRemove && isImageCreateUpdateAware(detail.value) && detail.value.id) {
    try {
      await deleteImage(imageClient, detail.value.id)
      reset()
    } catch (e) {
      showErrorsDefault(e)
    }
    return
  }
  reset()
}

const forceReloadViewWithExpandMetadata = () => {
  if (isMediaAware(detail.value)) {
    reloadMedia(detail.value)
    return
  } else if (isImageCreateUpdateAware(detail.value)) {
    reloadImage(detail.value, null, true)
  }
}

const onAssetUploadConfirm = (items: ImageCreateUpdateAware[]) => {
  if (!items[0]) return

  if (!isNull(imageModel.value)) {
    items[0].id = imageModel.value
  }
  imageMediaWidgetStore.setDetail(items[0])
  metadataDialog.value = true
  if (props.expandMetadata) {
    forceReloadViewWithExpandMetadata()
  }
}

const expandedUploadDialog = ref<InstanceType<typeof AFileInputDialog> | null>(null)

const onDropzoneClick = () => {
  if (isLocked.value) return
  acquireFieldLockLocal()
  if (!props.expandOptions) {
    clickMenuOpened.value = true
    return
  }
  expandedUploadDialog.value?.activate()
}

const detailDialogMetadataComponent = ref<InstanceType<typeof ImageDetailDialogMetadata> | null>(null)

const metadataConfirm = () => {
  detailDialogMetadataComponent.value?.confirm()
}

const onOptionsButtonClick = () => {
  acquireFieldLockLocal()
}

const anyWidgetDialogOpened = computed(() => {
  return (
    metadataDialog.value ||
    assetSelectDialog.value ||
    fileInputDialog.value ||
    uploadQueueDialog.value === props.queueKey
  )
})

const isLocked = computed(() => {
  return !isNull(lockedByUserLocal.value)
})

const type = computed<DamAssetTypeType | null>(() => {
  if (isMediaAware(resImageMedia.value)) {
    return resImageMedia.value.damMedia.assetType === DamMediaType.Video ? DamAssetType.Video : DamAssetType.Audio
  } else if (isImageCreateUpdateAware(resImageMedia.value)) {
    return DamAssetType.Image
  }
  return null
})

watch(
  clickMenuOpened,
  (newValue, oldValue) => {
    if (newValue === oldValue || newValue || anyWidgetDialogOpened.value) return
    releaseFieldLockLocal(imageModel.value)
  },
  { immediate: false }
)

watch(
  anyWidgetDialogOpened,
  (newValue, oldValue) => {
    if (newValue === oldValue || newValue) return
    releaseFieldLockLocal(imageModel.value)
  },
  { immediate: false }
)

onMounted(() => {
  imageMediaWidgetStore.reset()
})

defineExpose({
  metadataConfirm,
})
</script>

<template>
  <div
    class="a-image-widget"
    :class="{ 'a-image-widget--locked': isLocked }"
    :style="{ width: width ? width + 'px' : undefined, maxWidth: maxWidth ? maxWidth + 'px' : undefined }"
  >
    <div class="a-image-widget__options">
      <h4
        v-if="label"
        class="font-weight-bold text-subtitle-2"
      >
        {{ label
        }}<span
          v-if="required"
          class="required-mark"
        />
      </h4>
      <div class="d-flex">
        <div v-if="isLocked && collab">
          <ACollabLockedByUser
            :id="lockedByUserLocal"
            :users="collab.cachedUsers"
          />
        </div>
        <div>
          <div
            v-if="expandOptions"
            class="d-flex flex-row"
          >
            <VBtn
              v-if="imageMediaLoaded && !expandMetadata"
              class="mr-2 mb-2"
              :text="
                type === DamAssetType.Image
                  ? t('common.damImage.image.meta.edit')
                  : t('common.damImage.media.meta.edit')
              "
              @click="actionEditMeta"
            />
            <VBtn
              class="mr-2 mb-2"
              @click="actionLibrary"
            >
              <span v-if="imageMediaLoaded">{{ t('common.damImage.image.button.replaceFromDam') }}</span>
              <span v-else>{{ t('common.damImage.image.button.addFromDam') }}</span>
            </VBtn>
            <AFileInputDialog
              ref="expandedUploadDialog"
              v-model="fileInputDialog"
              :file-input-key="uploadQueue?.fileInputKey"
              :accept="uploadAccept"
              :max-sizes="uploadSizes"
              toolbar-t="common.damImage.image.button.upload"
              @files-input="onFileInput"
            >
              <template #activator="{ props: fileInputProps }">
                <VBtn v-bind="fileInputProps">
                  {{ t('common.damImage.image.button.upload') }}
                </VBtn>
              </template>
            </AFileInputDialog>
            <span
              v-if="required"
              class="required-mark ml-2"
            />
          </div>
          <VBtn
            v-else
            variant="text"
            size="x-small"
            icon
            :disabled="isLocked"
            @click.stop="onOptionsButtonClick"
          >
            <VIcon icon="mdi-dots-horizontal" />
            <VTooltip
              activator="parent"
              location="top"
            >
              {{ t('common.damImage.image.button.options') }}
            </VTooltip>
            <VMenu
              v-model="clickMenuOpened"
              activator="parent"
              location="bottom right"
              eager
            >
              <VCard>
                <VList density="compact">
                  <VListItem
                    v-if="imageMediaLoaded && !expandMetadata"
                    @click="actionEditMeta"
                  >
                    <VListItemTitle>
                      {{
                        type === DamAssetType.Image
                          ? t('common.damImage.image.meta.edit')
                          : t('common.damImage.media.meta.edit')
                      }}
                    </VListItemTitle>
                  </VListItem>
                  <VListItem @click="actionLibrary">
                    <VListItemTitle>
                      <span v-if="imageMediaLoaded">{{ t('common.damImage.image.button.replaceFromDam') }}</span>
                      <span v-else>{{ t('common.damImage.image.button.addFromDam') }}</span>
                    </VListItemTitle>
                  </VListItem>
                  <AFileInputDialog
                    v-model="fileInputDialog"
                    :file-input-key="uploadQueue?.fileInputKey"
                    :accept="uploadAccept"
                    :max-sizes="uploadSizes"
                    toolbar-t="common.damImage.image.button.upload"
                    @files-input="onFileInput"
                  >
                    <template #activator="{ props: fileInputProps }">
                      <VListItem
                        @click="
                          ($event: any) => {
                            fileInputProps.onClick($event)
                            clickMenuOpened = false
                          }
                        "
                      >
                        {{ t('common.damImage.image.button.upload') }}
                      </VListItem>
                    </template>
                  </AFileInputDialog>
                  <VListItem
                    v-if="imageMediaLoaded"
                    @click="onImageMediaDelete"
                  >
                    <VListItemTitle>
                      {{
                        type === DamAssetType.Image
                          ? t('common.damImage.image.button.removeImage')
                          : t('common.damImage.media.button.remove')
                      }}
                    </VListItemTitle>
                  </VListItem>
                </VList>
              </VCard>
            </VMenu>
          </VBtn>
        </div>
      </div>
    </div>
    <div class="position-relative">
      <VImg
        :lazy-src="imagePlaceholderPath"
        :src="resolvedSrc"
        :width="width"
        :height="height"
        cover
        max-width="100%"
        class="disable-radius"
      >
        <template #placeholder>
          <div class="d-flex align-center justify-center h-100">
            <VProgressCircular
              indeterminate
              color="grey-lighten-4"
            />
          </div>
        </template>
      </VImg>
      <div
        v-if="type"
        class="a-image-widget__icon"
      >
        <div v-if="type === DamAssetType.Audio">
          <VIcon
            size="80"
            icon="mdi-music"
            color="#505050"
          />
        </div>
        <div v-else-if="type === DamAssetType.Video">
          <VIcon
            size="80"
            icon="mdi-video"
            color="#505050"
          />
        </div>
      </div>
      <AImageDropzone
        variant="fill"
        transparent
        :accept="uploadAccept"
        :max-sizes="uploadSizes"
        :hide-text="hideDropzoneText || isLocked"
        @on-click="onDropzoneClick"
        @on-drop="onDrop"
      />
    </div>
    <slot
      name="append"
      :image-media="resImageMedia"
    />
    <ImageDetailDialogMetadata
      ref="detailDialogMetadataComponent"
      v-model="metadataDialog"
      :show-dam-authors="showDamAuthorsInCmsImage"
      :expand="expandMetadata"
      :saving="metadataDialogSaving"
      :loading="metadataDialogLoading"
      :type="type"
      @edit-asset="onEditAsset"
      @on-confirm="onMetadataDialogConfirm"
      @on-close="onMetadataDialogClose"
    >
      <template #preview="{ imageMedia: appendImage }">
        <slot
          name="preview"
          :image-media="appendImage"
        />
      </template>
    </ImageDetailDialogMetadata>
  </div>
  <AAssetSelectMedia
    v-model="assetSelectDialog"
    :select-licences="selectLicences"
    :upload-licence="uploadLicence"
    :min-count="1"
    :max-count="1"
    return-type="asset"
    @on-confirm="onAssetSelectConfirm"
  />
  <AssetDetailDialog
    v-if="assetDialog === queueKey"
    :queue-key="queueKey"
    :ext-system="cachedExtSystemId"
  />
  <UploadQueueDialogSingle
    v-if="uploadQueueDialog === queueKey && imageWidgetUploadConfig"
    :queue-key="queueKey"
    :ext-system="imageWidgetUploadConfig.extSystem"
    :licence-id="imageWidgetUploadConfig.licence"
    :file-input-key="uploadQueue?.fileInputKey ?? -1"
    :accept="uploadAccept"
    :max-sizes="uploadSizes"
    @on-apply="onAssetUploadConfirm"
  />
</template>
