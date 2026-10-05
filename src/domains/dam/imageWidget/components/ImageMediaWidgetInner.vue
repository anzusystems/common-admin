<script lang="ts" setup>
import AImageDropzone from '@/domains/ui/file/components/AFileDropzone.vue'
import type { DocId, IntegerId, IntegerIdNullable } from '@/shared/types/common'
import type { ImageAware, ImageCreateUpdateAware } from '@/domains/dam/types/ImageAware'
import imagePlaceholderPath from '@/assets/image/placeholder16x9.svg'
import { useCommonAdminImageOptions } from '@/domains/dam/imageWidget/composables/commonAdminImageOptions'
import { useImageActions } from '@/domains/dam/imageWidget/composables/imageActions'
import { cloneDeep, isDefined, isNull, isNumber, isString, isUndefined } from '@/shared/utils/common'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { useAlerts } from '@/domains/system/composables/alerts'
import { DamAssetType, type DamAssetTypeType, type DamImageCopyToLicenceResponse } from '@/domains/dam/types/Asset'
import { useDamAcceptTypeAndSizeHelper } from '@/domains/dam/config/composables/acceptTypeAndSizeHelper'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import type { AssetSelectReturnData } from '@/domains/dam/types/AssetSelect'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'
import ImageDetailDialogMetadata from '@/domains/dam/imageWidget/components/ImageDetailDialogMetadata.vue'
import { computed, inject, onBeforeUnmount, ref, type ShallowRef, toRaw, watch } from 'vue'
import AssetDetailDialog from '@/domains/dam/assetDetail/components/AssetDetailDialog.vue'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { storeToRefs } from 'pinia'
import { fetchAsset, fetchAssetAsCmsMedia, fetchAssetByFileId, updateAssetAuthors } from '@/domains/dam/api/damAssetApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import UploadQueueDialogSingle from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingle.vue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { fetchAuthorListByIds } from '@/domains/dam/author/api/authorApi'
import { useI18n } from 'vue-i18n'
import type { VBtn } from 'vuetify/components'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import {
  type CollabComponentConfig,
  type CollabFieldData,
  type CollabFieldLockOptions,
  CollabStatus,
  type CollabStatusType,
} from '@/domains/collab/types/Collab'
import { useCommonAdminCollabOptions } from '@/domains/collab/composables/commonAdminCollabOptions'
import { useCollabState } from '@/domains/collab/composables/collabState'
import { useCollabField } from '@/domains/collab/composables/collabField'
import ACollabLockedByUser from '@/domains/collab/components/ACollabLockedByUser.vue'
import AFileInputDialog from '@/domains/ui/file/components/AFileInputDialog.vue'
import {
  CollabFieldLockStatus,
  type CollabFieldLockStatusPayload,
  CollabFieldLockType,
} from '@/domains/collab/composables/collabEventBus'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import AAssetSelectMedia from '@/domains/dam/assetSelect/components/AAssetSelectMedia.vue'
import {
  isImageCreateUpdateAware,
  isMediaAware,
  useImageMediaWidgetStore,
} from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import {
  type DamMediaFromDam,
  DamMediaType,
  type DamMediaTypeType,
  type ImageMediaCollabValue,
  type MediaAware,
} from '@/domains/dam/types/MediaAware'
import { assetFileIsAudioFile, assetFileIsVideoFile } from '@/domains/dam/types/AssetFile'
import { copyToLicence } from '@/domains/dam/api/damImageApi'

const props = withDefaults(
  defineProps<{
    queueKey: UploadQueueKey
    uploadLicence: IntegerId
    selectLicences: IntegerId[]
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
const { collabReconnecting } = useCollabState()

const releaseFieldLock = ref((_data: CollabFieldData, _options?: Partial<CollabFieldLockOptions>) => {})
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
      lockRequestPending.value = false
      collabFieldLockReallyLocked.value = true
    } else if (data.status === CollabFieldLockStatus.Failure && data.type === CollabFieldLockType.Acquire) {
      lockRequestPending.value = false
      collabFieldLockReallyLocked.value = false
    } else if (lockRequestPending.value) {
      // The answer to a release sent before a request still out says nothing about that request, whose own answer
      // decides: a refused release read as the lock held let a drop upload before its request was answered.
      return
    } else if (data.status === CollabFieldLockStatus.Success && data.type === CollabFieldLockType.Release) {
      collabFieldLockReallyLocked.value = false
    } else if (data.status === CollabFieldLockStatus.Failure && data.type === CollabFieldLockType.Release) {
      collabFieldLockReallyLocked.value = true
    }
  })
}
// What the field holds, both halves: an image or a media, and the other editors have to know which. Read from the
// models only where they already hold it: an assignment to a `v-model` model shows there after the parent renders,
// so the paths that just assigned send what they assigned.
const collabValue = (): ImageMediaCollabValue => ({ image: imageModel.value, media: mediaModel.value })
const lockedLocal = ref(false)
// Asked for once per lock. A drop asks again for a lock not confirmed yet: a refused request left every later drop
// waiting on a lock never granted. A refusal does not forget the lock either: a timed-out request answers the same,
// and the server may have granted it, so it is still released. Never asked while a request is out: a second one
// could answer after the first, and one sent by the click that closes the menu raced its release on the server.
const lockRequestPending = ref(false)
const acquireFieldLockLocal = (again = false) => {
  if (props.collabStatus === CollabStatus.Inactive) return
  if (lockedLocal.value === true && (!again || lockRequestPending.value || collabFieldLockReallyLocked.value)) return
  // What an earlier answer left says nothing about this lock: the wait for it waits for this answer.
  collabFieldLockReallyLocked.value = false
  lockRequestPending.value = true
  acquireFieldLock.value()
  lockedLocal.value = true
}
// A lock taken while the room was active is released in an inactive one too: the room turned inactive because the
// other editor left, and the server still holds it for whoever comes back.
const releaseFieldLockLocal = () => {
  if (lockedLocal.value === false) return
  releaseFieldLock.value(collabValue())
  lockedLocal.value = false
}
// One release per lock: the server refuses a second one, and its refusal read as the lock still held. An inactive
// room keeps the value for the editors who join, lock or not.
const releaseFieldLockWith = (value: ImageMediaCollabValue) => {
  if (lockedLocal.value === false && props.collabStatus !== CollabStatus.Inactive) return
  releaseFieldLock.value(value)
  lockedLocal.value = false
}

const imageWidgetUploadConfig = inject<ShallowRef<DamConfigLicenceExtSystemReturnType | undefined> | undefined>(
  ImageWidgetUploadConfigKey,
  undefined
)

if (isUndefined(imageWidgetUploadConfig) || isUndefined(imageWidgetUploadConfig.value)) {
  throw new Error("Fatal error, parent component doesn't provide necessary config ext system config.")
}

const { t } = useI18n()

const { showErrorsDefault, showErrorT } = useAlerts()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imageOptions = useCommonAdminImageOptions(props.configName)
const { imageClient, imageApi } = imageOptions
const { widgetImageToDamImageUrl, damImageIdToDamImageUrl } = useImageActions(imageOptions)
const uploadQueuesStore = useUploadQueuesStore()
const { uploadQueueDialog } = useUploadQueueDialog()
// Before the immediate watcher below: with expandMetadata it writes the detail while setup runs.
const imageMediaWidgetStore = useImageMediaWidgetStore()
imageMediaWidgetStore.reset()
const { detail } = storeToRefs(imageMediaWidgetStore)

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

// Cancelling must settle the promise, not just clear the timer — `onDrop` awaits it. A Set
// because overlapping drops each have their own wait.
const LOCK_WAIT_CANCELLED = Symbol('lock wait cancelled')
type PendingLockWait = { timer: ReturnType<typeof setTimeout>; reject: (reason: unknown) => void }
const pendingLockWaits = new Set<PendingLockWait>()
let disposed = false

onBeforeUnmount(() => {
  disposed = true
  pendingLockWaits.forEach((wait) => {
    clearTimeout(wait.timer)
    wait.reject(LOCK_WAIT_CANCELLED)
  })
  pendingLockWaits.clear()
})

const waitForFieldLockIsReallyAcquired = async () => {
  if (!collabOptions.value.enabled || isUndefined(props.collab) || props.collabStatus === CollabStatus.Inactive) {
    return Promise.resolve(true)
  }

  let count = 0

  const checkLock: () => Promise<Awaited<boolean>> = () => {
    if (disposed) {
      return Promise.reject(LOCK_WAIT_CANCELLED)
    }
    if (collabFieldLockReallyLocked.value) {
      return Promise.resolve(true)
    }

    count++
    if (count < 50) {
      return new Promise((resolve, reject) => {
        const wait: PendingLockWait = {
          timer: setTimeout(() => {
            pendingLockWaits.delete(wait)
            resolve(checkLock())
          }, 100),
          reject,
        }
        pendingLockWaits.add(wait)
      })
    }

    return Promise.reject(false)
  }

  return checkLock()
}

const onDrop = async (files: File[]) => {
  if (props.readonly) return
  // As a click on the dropzone: the field is another editor's.
  if (isLocked.value) {
    showErrorT('common.damImage.error.unableToLock')
    return
  }
  acquireFieldLockLocal(true)
  const config = imageWidgetUploadConfig.value!
  try {
    await waitForFieldLockIsReallyAcquired()
    // The lock can resolve after the widget is gone; uploading into it is worse than dropping.
    if (disposed) return
    // Turned read-only while the lock was awaited: the lock goes back and nothing is uploaded.
    if (props.readonly) {
      if (pendingLockWaits.size === 0 && !clickMenuOpened.value && !anyWidgetDialogOpened.value) releaseFieldLockLocal()
      return
    }
    cachedExtSystemId.value = config.extSystem
    uploadQueuesStore.addByFiles(props.queueKey, config.extSystem, config.licence, files)
    uploadQueueDialog.value = props.queueKey
  } catch (e) {
    if (disposed || e === LOCK_WAIT_CANCELLED) return
    // A request that timed out may have been granted after all, and nothing else would release it. Only when nothing
    // else waits for or holds it: refused, this release reads as the lock held, and another drop still waiting uploaded
    // without its lock, or a menu opened meanwhile lost the one it asked for.
    if (pendingLockWaits.size === 0 && !clickMenuOpened.value && !anyWidgetDialogOpened.value) releaseFieldLockLocal()
    showErrorT('common.damImage.error.unableToLock')
  }
}

const onCopyToLicence = (data: DamImageCopyToLicenceResponse) => {
  if (props.readonly) return
  if (!data[0]) return
  const config = imageWidgetUploadConfig.value!
  cachedExtSystemId.value = config.extSystem
  if (data[0].result === 'copy') {
    uploadQueuesStore.addByCopyToLicence(props.queueKey, config.extSystem, config.licence, [data[0].targetAsset])
  } else if (data[0].result === 'exists') {
    uploadQueuesStore.addByCopyToLicence(props.queueKey, config.extSystem, config.licence, [data[0].targetAsset])
    uploadQueuesStore.queueItemDuplicate(data[0].targetAsset, data[0].targetMainFile, DamAssetType.Image)
  } else {
    showErrorT('common.damImage.queueItem.errorUnableToCopyToLicence')
    return
  }
  uploadQueueDialog.value = props.queueKey
}

const onFileInput = (files: File[]) => {
  if (props.readonly) return
  const config = imageWidgetUploadConfig.value!
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
      resImageMedia.value = await imageApi.fetchImage(imageClient, newImageId)
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

// `release` false: a menu or dialog still open holds the lock, and its close or confirm releases it. Alone, the editor
// holds none, and the value goes to the buffer here or nowhere.
const reset = (release = true) => {
  resolvedSrc.value = imagePlaceholderPath
  resImageMedia.value = null
  imageModel.value = null
  mediaModel.value = null
  imageMediaWidgetStore.reset()
  if (release || props.collabStatus === CollabStatus.Inactive) releaseFieldLockWith({ image: null, media: null })
}

watch(
  [() => props.initialImage, imageModel, mediaModel],
  async ([newImage, newImageId, newMedia], [oldImage, oldImageId, oldMedia]) => {
    if (!isNull(newMedia) && JSON.stringify(newMedia) !== JSON.stringify(oldMedia)) {
      reloadMedia(newMedia)
      return
    }

    if (newImage !== oldImage || newImageId !== oldImageId) {
      await reloadImage(newImage, newImageId)
      return
    }

    if (isNull(newMedia) && !isNull(oldMedia)) {
      reloadMedia(null)
    }
  },
  { immediate: true }
)

const assetSelectStore = useAssetSelectStore()
const { getDamConfigExtSystem } = useDamConfigState()

// The picker closes itself as it answers, and the widget's next dialog opens only once the asset is fetched or
// copied: till then the pick counts as an open dialog, or the close watcher gave the lock up with the old value.
const assetPickPending = ref(false)
const onAssetSelectConfirm = async (data: AssetSelectReturnData) => {
  if (props.readonly) return
  assetPickPending.value = true
  try {
    await pickAsset(data)
  } finally {
    assetPickPending.value = false
    // Ended early (no main file, the media not loaded), the pick left the dialog loading: the next upload or edit
    // showed only a spinner. Whatever it loaded is loaded by now.
    metadataDialogLoading.value = false
  }
}

const pickAsset = async (data: AssetSelectReturnData) => {
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
      extService: 'damVideo',
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
      extService: 'damPodcast',
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
        const copyRes = await copyToLicence(damClient, endPointAsset, [
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
      const assetRes = await fetchAsset(damClient, endPointAsset, selectedAsset.id)
      if (isString(assetRes.metadata.customData?.description)) {
        description = assetRes.metadata.customData.description.trim()
      }
      if (assetRes.authors.length > 0) {
        const authorsRes = await fetchAuthorListByIds(
          damClient,
          assetSelectStore.requireSelectedSelectConfig().extSystem,
          assetRes.authors
        )
        source = authorsRes.map((author) => author.name).join(', ')
      } else if (assetRes.authors.length === 0) {
        const configExtSystem = getDamConfigExtSystem(imageWidgetUploadConfig.value!.extSystem)
        if (configExtSystem?.[DamAssetType.Image]?.authors?.enabled) {
          showDamAuthorsInCmsImage.value = true
          asset.value = assetRes
        }
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
        internal: false,
        overrideInternal: false,
      },
      dam: {
        damId: selectedAsset.mainFile.id,
        regionPosition: 0,
        licenceId: selectedAsset.licence,
        internal: selectedAsset.mainFileInternal ?? false,
      },
      position: 1,
    }
    if (!isNull(imageModel.value)) {
      image.id = imageModel.value
    }
    imageMediaWidgetStore.setDetail(image)
  }
  metadataDialogLoading.value = false
  if (props.expandMetadata) {
    forceReloadViewWithExpandMetadata()
  }
}

const assetDetailStore = useAssetDetailStore()
const { loading: assetLoading, dialog: assetDialog, asset } = storeToRefs(assetDetailStore)
const {
  damClient,
  endPointAsset,
  showSourceEnabled,
  sourceLabel,
  editAssetLabel,
  addFromDamLabel,
  replaceFromDamLabel,
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
} = useCommonAdminCoreDamOptions(props.configName)

const { getExtSystemByLicence } = useDamConfigState(damClient)

const onEditAsset = async (assetFileId: DocId) => {
  assetLoading.value = true
  assetDialog.value = props.queueKey
  try {
    const assetRes = await fetchAssetByFileId(damClient, endPointAsset, assetFileId)
    const extSystem = await getExtSystemByLicence(assetRes.licence)
    if (extSystem) {
      cachedExtSystemId.value = extSystem
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
    const media = detail.value
    mediaModel.value = media
    imageModel.value = null
    imageMediaWidgetStore.setDetail(null)
    reloadMedia(media)
    emit('afterMetadataSaveSuccess')
    releaseFieldLockWith({ image: null, media })
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
          assetSelectStore.requireSelectedSelectConfig().extSystem,
          asset.value.authors
        )
        detail.value.texts.source = authorsRes.map((author) => author.name).join(', ')
        await updateAssetAuthors(
          damClient,
          endPointAsset,
          asset.value,
          assetSelectStore.requireSelectedSelectConfig().extSystem
        )
        showDamAuthorsInCmsImage.value = false
      }
    }
    const res = detail.value.id
      ? await imageApi.updateImage(imageClient, detail.value.id, detail.value)
      : await imageApi.createImage(imageClient, detail.value)
    metadataDialog.value = false
    imageModel.value = res.id
    mediaModel.value = null
    imageMediaWidgetStore.setDetail(null)
    // Before the dialog's close is seen, so this release, with what was just assigned, is the one that goes.
    releaseFieldLockWith({ image: res.id, media: null })
    await reloadImage(res, res.id, true)
    emit('afterMetadataSaveSuccess')
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    metadataDialogSaving.value = false
  }
}

const onMetadataDialogConfirm = async () => {
  if (props.readonly) return
  await tryMediaConfirm()
  await tryImageConfirm()
}

// Till the delete is answered, neither the menu's close nor a dialog's gives the lock up: the menu closes on the click,
// and its release went out with the image still there, the reset's own skipped as for a lock already given back.
const deletePending = ref(false)
const onImageMediaDelete = async () => {
  // The widget's own image: the store's detail is shared, empty unless a dialog loaded it, or another widget's.
  const imageId = imageModel.value
  if (props.callDeleteApiOnRemove && !isNull(imageId)) {
    deletePending.value = true
    try {
      await imageApi.deleteImage(imageClient, imageId)
      reset(!clickMenuOpened.value && !anyWidgetDialogOpened.value)
    } catch (e) {
      showErrorsDefault(e)
    } finally {
      deletePending.value = false
    }
    if (!clickMenuOpened.value && !anyWidgetDialogOpened.value) releaseFieldLockLocal()
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
  if (props.readonly) return
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
  if (isLocked.value || props.readonly) return
  acquireFieldLockLocal()
  if (!props.expandOptions) {
    clickMenuOpened.value = true
    return
  }
  expandedUploadDialog.value?.activate()
}

const detailDialogMetadataComponent = ref<InstanceType<typeof ImageDetailDialogMetadata> | null>(null)

const metadataConfirm = () => {
  if (props.readonly) return
  detailDialogMetadataComponent.value?.confirm()
}

const onOptionsButtonClick = () => {
  acquireFieldLockLocal()
}

const anyWidgetDialogOpened = computed(() => {
  return (
    assetPickPending.value ||
    metadataDialog.value ||
    assetSelectDialog.value ||
    fileInputDialog.value ||
    uploadQueueDialog.value === props.queueKey
  )
})

const isLocked = computed(() => {
  return !isNull(lockedByUserLocal.value)
})

const preselectType = computed(() => {
  if (mediaModel.value && mediaModel.value.damMedia.assetType) {
    return mediaModel.value.damMedia.assetType
  }
  return DamAssetType.Image as DamMediaTypeType
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
    if (newValue === oldValue) return
    // Opened: a lock a refused drop left unconfirmed is asked for again, here and not in the click, which also closes.
    if (newValue) return void acquireFieldLockLocal(true)
    if (anyWidgetDialogOpened.value || deletePending.value) return
    releaseFieldLockLocal()
  },
  { immediate: false }
)

watch(
  anyWidgetDialogOpened,
  (newValue, oldValue) => {
    if (newValue === oldValue) return
    // Opened by a button of `expandOptions`, with no menu to ask for the lock, the dialog asks; opened from the menu,
    // only for a lock not confirmed yet.
    if (newValue) return void acquireFieldLockLocal(true)
    if (deletePending.value) return
    releaseFieldLockLocal()
  },
  { immediate: false }
)

// A lost connection took this editor's locks on the server: counted still, the lock was never asked for again and the
// server refused its release. When the room is active again, a menu or dialog still open asks for it anew, as does one
// opened while the editor was alone, once the other editor arrives, and one whose ask was refused or went unanswered.
watch(collabReconnecting, (reconnecting) => {
  if (!reconnecting) return
  lockedLocal.value = false
  lockRequestPending.value = false
  collabFieldLockReallyLocked.value = false
})
watch(
  () => props.collabStatus,
  (status, previous) => {
    if (status === CollabStatus.Inactive || previous !== CollabStatus.Inactive) return
    if (clickMenuOpened.value || anyWidgetDialogOpened.value) acquireFieldLockLocal(true)
  }
)

defineExpose({
  metadataConfirm,
})
</script>

<template>
  <div
    class="a-image-widget"
    :class="{ 'a-image-widget--locked': isLocked }"
    :style="{
      width: width ? width + 'px' : undefined,
      maxWidth: maxWidth ? maxWidth + 'px' : undefined,
    }"
  >
    <div class="a-image-widget__options">
      <h4
        v-if="label"
        class="font-weight-bold text-label-large"
      >
        {{ label
        }}<span
          v-if="required"
          class="a-required-mark"
        />
      </h4>
      <div class="d-flex">
        <div v-if="isLocked && collab">
          <ACollabLockedByUser
            :id="lockedByUserLocal"
            :users="collab.cachedUsers"
          />
        </div>
        <div v-if="!readonly">
          <div
            v-if="expandOptions"
            class="d-flex flex-row"
          >
            <VBtn
              v-if="imageMediaLoaded && !expandMetadata"
              class="mr-2 mb-2"
              :disabled="isLocked"
              :text="
                type === DamAssetType.Image
                  ? t('common.damImage.image.meta.edit')
                  : t('common.damImage.media.meta.edit')
              "
              @click="actionEditMeta"
            />
            <VBtn
              class="mr-2 mb-2"
              :disabled="isLocked"
              @click="actionLibrary"
            >
              <span v-if="imageMediaLoaded">{{ replaceFromDamLabel }}</span>
              <span v-else>{{ addFromDamLabel }}</span>
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
                <VBtn
                  v-bind="fileInputProps"
                  :disabled="isLocked"
                >
                  {{ t('common.damImage.image.button.upload') }}
                </VBtn>
              </template>
            </AFileInputDialog>
            <span
              v-if="required"
              class="a-required-mark ml-2"
            />
          </div>
          <VBtn
            v-else
            variant="text"
            size="x-small"
            icon
            :disabled="isLocked"
            :aria-label="t('common.damImage.image.button.options')"
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
                      <span v-if="imageMediaLoaded">{{ replaceFromDamLabel }}</span>
                      <span v-else>{{ addFromDamLabel }}</span>
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
        v-if="!readonly"
        variant="fill"
        transparent
        :accept="uploadAccept"
        :max-sizes="uploadSizes"
        :hide-text="hideDropzoneText || isLocked"
        @click="onDropzoneClick"
        @drop="onDrop"
      />
    </div>
    <slot
      name="append"
      :image-media="resImageMedia"
    />
    <ImageDetailDialogMetadata
      v-if="!readonly"
      ref="detailDialogMetadataComponent"
      v-model="metadataDialog"
      :show-dam-authors="showDamAuthorsInCmsImage"
      :show-source-enabled="showSourceEnabled"
      :source-label="sourceLabel"
      :edit-asset-label="editAssetLabel"
      :expand="expandMetadata"
      :saving="metadataDialogSaving"
      :loading="metadataDialogLoading"
      @edit-asset="onEditAsset"
      @confirm="onMetadataDialogConfirm"
      @close="onMetadataDialogClose"
    >
      <template #preview="{ imageMedia: appendMedia }">
        <slot
          name="preview"
          :image-media="appendMedia"
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
    :config-name="configName"
    return-type="asset"
    :preselect-asset-type="preselectType"
    :preselect-in-podcast="preselectType === DamAssetType.Audio || null"
    @confirm="onAssetSelectConfirm"
  />
  <AssetDetailDialog
    v-if="assetDialog === queueKey"
    :queue-key="queueKey"
    :config-name="configName"
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
    @apply="onAssetUploadConfirm"
  />
</template>
