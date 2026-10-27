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
import {
  type AssetDetailItemDto,
  DamAssetType,
  type DamAssetTypeType,
  type DamImageCopyToLicenceResponse,
} from '@/domains/dam/types/Asset'
import { useDamAcceptTypeAndSizeHelper } from '@/domains/dam/config/composables/acceptTypeAndSizeHelper'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import type { AssetSelectReturnData } from '@/domains/dam/types/AssetSelect'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'
import ImageDetailDialogMetadata from '@/domains/dam/imageWidget/components/ImageDetailDialogMetadata.vue'
import { computed, inject, onBeforeUnmount, ref, type ShallowRef, toRaw, watch } from 'vue'
import AssetDetailDialog from '@/domains/dam/assetDetail/components/AssetDetailDialog.vue'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { loadAssetDetailExtSystem } from '@/domains/dam/assetDetail/composables/assetDetailExtSystem'
import { storeToRefs } from 'pinia'
import {
  fetchAsset,
  fetchAssetAsCmsMedia,
  fetchAssetByFileId,
  showMetadataSaveError,
  updateAssetAuthors,
} from '@/domains/dam/api/damAssetApi'
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
import { createDamImage, imageFieldsOf } from '@/domains/dam/imageWidget/utils/damImage'
import { assetMetadataMayStillChange } from '@/domains/dam/assetDetail/utils/assetMetadataMayStillChange'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'
import {
  giveNamesToEmptySource,
  type HeldAssetAnew,
  useImageDialogDamAuthors,
} from '@/domains/dam/imageWidget/composables/imageDialogDamAuthors'
import { lastFieldLockTurn, takeFieldLockTurn } from '@/domains/dam/imageWidget/utils/fieldLockTurns'
import {
  holdImage,
  imageSavedSince,
  imageSavesOfOthersOver,
  noteImageSave,
} from '@/domains/dam/imageWidget/utils/imageSaves'
import { WAIT_RAN_OUT, withinWaitLimit } from '@/domains/dam/imageWidget/utils/waitLimit'

const props = withDefaults(
  defineProps<{
    queueKey: UploadQueueKey
    uploadLicence: IntegerId
    selectLicences: IntegerId[]
    initialImage?: ImageAware | undefined // If given, the image data is not fetched.
    configName?: string
    collab?: CollabComponentConfig
    collabStatus?: CollabStatusType
    label?: string | undefined
    required?: boolean
    readonly?: boolean
    dataCy?: string | undefined
    expandOptions?: boolean
    expandMetadata?: boolean // Only one per page at a time, for use in dialogs.
    disableOnClickMenu?: boolean
    width?: number | undefined
    maxWidth?: number | undefined
    height?: number | undefined
    callDeleteApiOnRemove?: boolean
    damWidth?: undefined | number
    damHeight?: undefined | number
  }>(),
  {
    configName: undefined,
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
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const { collabOptions } = useCommonAdminCollabOptions()
const { collabReconnecting } = useCollabState()

const releaseFieldLock = ref((_data: CollabFieldData, _options?: Partial<CollabFieldLockOptions>) => {})
const changeFieldData = ref((_data: CollabFieldData) => {})
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const acquireFieldLock = ref((options?: Partial<CollabFieldLockOptions>) => {})
const lockedByUserLocal = ref<IntegerIdNullable>(null)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
if (collabOptions.value.enabled && isDefined(props.collab)) {
  const {
    releaseCollabFieldLock,
    acquireCollabFieldLock,
    changeCollabFieldData,
    addCollabFieldLockStatusListener,
    lockedByUser,
  } = useCollabField(props.collab.room, props.collab.field)
  releaseFieldLock.value = releaseCollabFieldLock
  changeFieldData.value = changeCollabFieldData
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
      // A release answer sent before a pending request says nothing about that request. Only its own answer decides.
      // Reading a refused release as the lock held let a drop upload before its request was answered.
      return
    } else if (data.status === CollabFieldLockStatus.Success && data.type === CollabFieldLockType.Release) {
      collabFieldLockReallyLocked.value = false
    } else if (data.status === CollabFieldLockStatus.Failure && data.type === CollabFieldLockType.Release) {
      collabFieldLockReallyLocked.value = true
    }
  })
}
// Other editors need both the image and the media.
// A `v-model` assignment reaches the models only after the parent
// renders, so paths that just assigned send the assigned value directly.
const collabValue = (): ImageMediaCollabValue => ({ image: imageModel.value, media: mediaModel.value })
const lockedLocal = ref(false)
// Lock turn this widget took last, by request or release.
// A widget of the same field drawn in place of this one may have taken a turn since.
let ownLockTurn = 0
const takeLockTurn = () => {
  if (isDefined(props.collab)) ownLockTurn = takeFieldLockTurn(props.collab.room, props.collab.field)
}
const lockTurnTakenSince = () =>
  isDefined(props.collab) && lastFieldLockTurn(props.collab.room, props.collab.field) !== ownLockTurn
// Requested once per lock. A drop asks again for an unconfirmed
// lock, otherwise one refusal left every later drop waiting forever.
// A refusal still keeps the lock for release: a timed-out request
// answers the same way and the server may have granted it.
// Never requested while one is pending: a second answer could arrive after the
// first, and a request from the menu-closing click raced its release on the server.
const lockRequestPending = ref(false)
const acquireFieldLockLocal = (again = false) => {
  if (props.collabStatus === CollabStatus.Inactive) return
  if (lockedLocal.value === true && (!again || lockRequestPending.value || collabFieldLockReallyLocked.value)) return
  // An earlier answer says nothing about this lock. Waiters wait for this answer.
  collabFieldLockReallyLocked.value = false
  lockRequestPending.value = true
  acquireFieldLock.value()
  takeLockTurn()
  lockedLocal.value = true
}
// A lock taken while the room was active is released in an inactive room too.
// The room turns inactive when the other editor leaves, and the server still holds the lock for whoever returns.
const releaseFieldLockLocal = () => {
  if (lockedLocal.value === false) return
  releaseFieldLock.value(collabValue())
  takeLockTurn()
  lockedLocal.value = false
}
// One release per lock: the server refuses a second one, and the refusal reads as the lock still held.
// An inactive room still gets the value for editors who join, lock or not.
const releaseFieldLockWith = (value: ImageMediaCollabValue) => {
  if (lockedLocal.value === false && props.collabStatus !== CollabStatus.Inactive) return
  releaseFieldLock.value(value)
  takeLockTurn()
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

const { showErrorsDefault, showErrorT, showWarningT, showUnknownError } = useAlerts()

const imageOptions = useCommonAdminImageOptions(damConfigName)
const { imageClient, imageApi } = imageOptions
const { widgetImageToDamImageUrl, damImageIdToDamImageUrl } = useImageActions(imageOptions)
const uploadQueuesStore = useUploadQueuesStore()
const { uploadQueueDialog, stopQueueLeftBehind } = useUploadQueueDialog()
// Must run before the immediate watcher below, which writes the detail during setup with `expandMetadata`.
// Keeps a form shown by another widget's open dialog: a late-drawn widget used to empty it.
const imageMediaWidgetStore = useImageMediaWidgetStore()
imageMediaWidgetStore.resetUnlessShown()
const { detail } = storeToRefs(imageMediaWidgetStore)
const thisWidget = Symbol('image media widget')

const resImageMedia = ref<null | ImageCreateUpdateAware | MediaAware>(null)
const clickMenuOpened = ref(false)
const assetSelectDialog = ref(false)
const metadataDialog = ref(false)
const metadataDialogSaving = ref(false)
const metadataDialogLoading = ref(false)
const fileInputDialog = ref(false)

// DAM authors offered in the image dialog come from an asset this widget read
// itself for that image, also for the inline form with `expandMetadata`.
const {
  damAuthorsAsset,
  offerDamAuthorsOf,
  offerNoDamAuthors,
  pickDamAuthors,
  onAssetDetailClose,
  holdConfirmForDetailAssetRead,
  readHeldAnew,
  takeHeldAnew,
  letGoOnceSavedWithSource,
  authorsGivenMeanwhile,
  confirmWaits,
} = useImageDialogDamAuthors(
  damConfigName,
  () =>
    (metadataDialog.value || props.expandMetadata) && isImageCreateUpdateAware(detail.value) ? detail.value : null,
  () => props.readonly
)

// Marks the store as shown by this widget while its dialog or inline form is open, so no other widget empties it.
watch(
  () => metadataDialog.value || props.expandMetadata,
  (shows) => imageMediaWidgetStore.setShownBy(thisWidget, shows),
  { immediate: true, flush: 'sync' }
)

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

// Copy of the widget's image or media that "edit metadata" put into the dialog.
let ownInDialog: typeof detail.value = null
// What this widget's last pick or upload put into the dialog.
// The dialog store is page-wide, so it may show another widget's dialog opened over this one.
let pickInDialog: typeof detail.value = null
// What the dialog shows loading for: a pick being read, or "edit metadata"
// waiting for another widget's save or for a read of the held asset.
// The answer is applied only while the dialog still loads for it,
// not after close or once the page-wide store shows another dialog.
// Otherwise a pick answer replaced another widget's dialog form and lost the typed
// input. The loading dialog then closes, since its confirm would save that form here.
let loadingInDialog: symbol | null = null
const answerTakenFor = (opening: symbol) => {
  if (disposed || loadingInDialog !== opening) return false
  if (isNull(detail.value)) return true
  loadingInDialog = null
  metadataDialogLoading.value = false
  metadataDialog.value = false
  return false
}
// Number of answered page saves of the held image at the time the widget read it.
let resImageReadAt = 0
// Marks of this widget's image saves in flight.
const ownImageSaves = new Set<symbol>()
// Cancels the "edit metadata" wait for another widget's save. Called when the dialog closes.
let cancelSaveWait: (() => void) | null = null
// Type the dialog is opened for: held image or medium, picked asset, or uploaded image.
// Sets the title from the start, so it stays the same while loading, waiting and saving.
const dialogType = ref<DamAssetTypeType>(DamAssetType.Image)
const actionEditMeta = async () => {
  dialogType.value = type.value ?? DamAssetType.Image
  const heldId = () => (isImageCreateUpdateAware(resImageMedia.value) ? resImageMedia.value.id : undefined)
  // Another widget is saving the image, for example the one this
  // widget replaced. The dialog shows loading until that save ends.
  const id = heldId()
  const othersSaves = isNumber(id) ? imageSavesOfOthersOver(damConfigName, id, ownImageSaves) : null
  if (othersSaves) {
    const thisOpening = (loadingInDialog = Symbol('edit'))
    imageMediaWidgetStore.setDetail(null)
    metadataDialogLoading.value = true
    metadataDialog.value = true
    cancelSaveWait = othersSaves.cancel
    const over = await withinWaitLimit(othersSaves.over, 1, damConfigName)
    cancelSaveWait = null
    if (!answerTakenFor(thisOpening)) return
    loadingInDialog = null
    metadataDialogLoading.value = false
    // The other save timed out: the dialog closes and the user is told. Before, it loaded until the editor closed it.
    // Showing the earlier read would let the confirm overwrite what that save may still write.
    if (over === WAIT_RAN_OUT) {
      othersSaves.cancel()
      metadataDialog.value = false
      showErrorT('error.apiTimedOut.message')
      return
    }
  }
  // The held asset was picked without authors: the dialog loads while it is read
  // again, and the result goes into the dialog with the image. Never for a medium.
  const heldAnew = readHeldAnew(
    isImageCreateUpdateAware(resImageMedia.value) ? resImageMedia.value.dam.damId : undefined
  )
  let anew: HeldAssetAnew | null = null
  if (heldAnew) {
    const thisOpening = (loadingInDialog = Symbol('edit'))
    imageMediaWidgetStore.setDetail(null)
    metadataDialogLoading.value = true
    metadataDialog.value = true
    anew = await heldAnew
    if (!answerTakenFor(thisOpening)) return
    loadingInDialog = null
    metadataDialogLoading.value = false
  }
  // Another widget saved the image after this one read it: take the image as saved.
  // Otherwise the dialog offered stale texts and its confirm overwrote the saved ones.
  const savedId = heldId()
  const saved = isNumber(savedId) ? imageSavedSince(damConfigName, savedId, resImageReadAt) : null
  if (saved) void reloadImage(saved, null, true)
  imageMediaWidgetStore.setDetail(toRaw(resImageMedia.value))
  takeHeldAnew(anew, isImageCreateUpdateAware(detail.value) ? detail.value : null)
  ownInDialog = detail.value
  metadataDialog.value = true
}

// With `expandMetadata` the form is inline, with no "edit metadata" opening to
// wait for another widget's save or take its result, so the form does both.
// Otherwise it showed texts read before that save, and the host's confirm overwrote the saved ones.
// When the wait runs out the form shows the read data and the user is told the request timed out.
const showReadInForm = async () => {
  const heldId = () => (isImageCreateUpdateAware(resImageMedia.value) ? resImageMedia.value.id : undefined)
  const id = heldId()
  const othersSaves = isNumber(id) ? imageSavesOfOthersOver(damConfigName, id, ownImageSaves) : null
  if (othersSaves) {
    const thisOpening = (loadingInDialog = Symbol('edit'))
    imageMediaWidgetStore.setDetail(null)
    metadataDialogLoading.value = true
    cancelSaveWait = othersSaves.cancel
    const over = await withinWaitLimit(othersSaves.over, 1, damConfigName)
    cancelSaveWait = null
    if (!answerTakenFor(thisOpening)) return
    loadingInDialog = null
    metadataDialogLoading.value = false
    if (over === WAIT_RAN_OUT) {
      othersSaves.cancel()
      showErrorT('error.apiTimedOut.message')
    }
    if (heldId() !== id) return
  }
  const saved = isNumber(id) ? imageSavedSince(damConfigName, id, resImageReadAt) : null
  if (saved) return void reloadImage(saved, null, true)
  imageMediaWidgetStore.setDetail(toRaw(resImageMedia.value))
}

const actionLibrary = () => {
  assetSelectDialog.value = true
}

const { cachedExtSystemId } = useExtSystemIdForCached(damConfigName)

// Updated only when the socket confirms lock success or failure. Needed for file drops.
const collabFieldLockReallyLocked = ref(false)

// Cancelling must settle the promise, not only clear the timer, because `onDrop` awaits it.
// A Set because overlapping drops each have their own wait.
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
  // Whatever held the field lock goes with the widget. The server keeps a lock until
  // release or until the editor leaves, so the field stayed locked for others.
  // Released with the current value, unless a save or delete in flight releases
  // it at its end, or the replacing widget has taken a lock turn since.
  if (!metadataDialogSaving.value && !deletePending.value && !lockTurnTakenSince()) releaseFieldLockLocal()
  imageMediaWidgetStore.setShownBy(thisWidget, false)
  holdImage(damConfigName, thisWidget, null)
  cancelSaveWait?.()
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

// The single drop uploaded once the field lock arrives. The upload
// dialog shows one file but saves all it gets, so only one is kept.
let dropInWait: symbol | null = null

const onDrop = async (files: File[]) => {
  if (props.readonly) return
  // The dropzone rejected every file and reported it, so no lock is requested.
  if (files.length === 0) return
  // An earlier drop's lock request is still pending, so this drop is ignored.
  if (!isNull(dropInWait) && lockRequestPending.value) return
  // Same as a click on the dropzone: another editor holds the field.
  if (isLocked.value) {
    showErrorT('common.damImage.error.unableToLock')
    return
  }
  acquireFieldLockLocal(true)
  const config = imageWidgetUploadConfig.value!
  // After a refusal this drop asks again and replaces the one still waiting.
  const thisDrop = Symbol('drop')
  dropInWait = thisDrop
  try {
    await waitForFieldLockIsReallyAcquired()
    // The lock can resolve after the widget is gone; uploading into it is worse than dropping.
    if (disposed) return
    if (dropInWait !== thisDrop) return
    // Turned read-only while waiting for the lock: release it and upload nothing.
    if (props.readonly) {
      if (pendingLockWaits.size === 0 && !clickMenuOpened.value && !anyWidgetDialogOpened.value) releaseFieldLockLocal()
      return
    }
    cachedExtSystemId.value = config.extSystem
    // The widget holds one image and the upload dialog shows one file,
    // so only the first dropped file is uploaded and the user is warned.
    // Otherwise the extra files were uploaded unseen and left without an image.
    if (files.length > 1) showWarningT('common.damImage.upload.onlyOneFile')
    stopQueueLeftBehind(props.queueKey)
    uploadQueuesStore.addByFiles(props.queueKey, config.extSystem, config.licence, files.slice(0, 1), damConfigName)
    uploadQueueDialog.value = props.queueKey
  } catch (e) {
    if (disposed || e === LOCK_WAIT_CANCELLED) return
    // A timed-out request may have been granted, and nothing else would release it.
    // Released only when nothing else waits for or holds the lock. A refused release reads as the lock
    // held, so another waiting drop uploaded without its lock, or a menu opened meanwhile lost its lock.
    if (pendingLockWaits.size === 0 && !clickMenuOpened.value && !anyWidgetDialogOpened.value) releaseFieldLockLocal()
    showErrorT('common.damImage.error.unableToLock')
  } finally {
    if (dropInWait === thisDrop) dropInWait = null
  }
}

const onCopyToLicence = (data: DamImageCopyToLicenceResponse) => {
  if (props.readonly) return
  if (!data[0]) return
  const config = imageWidgetUploadConfig.value!
  cachedExtSystemId.value = config.extSystem
  stopQueueLeftBehind(props.queueKey)
  if (data[0].result === 'copy') {
    uploadQueuesStore.addByCopyToLicence(
      props.queueKey,
      config.extSystem,
      config.licence,
      [data[0].targetAsset],
      damConfigName
    )
  } else if (data[0].result === 'exists') {
    uploadQueuesStore.addByCopyToLicence(
      props.queueKey,
      config.extSystem,
      config.licence,
      [data[0].targetAsset],
      damConfigName
    )
    uploadQueuesStore.queueItemDuplicate(data[0].targetAsset, data[0].targetMainFile, DamAssetType.Image, damConfigName)
  } else {
    showErrorT('common.damImage.queueItem.errorUnableToCopyToLicence')
    return
  }
  uploadQueueDialog.value = props.queueKey
}

const onFileInput = (files: File[]) => {
  if (props.readonly) return
  // The input rejected every file and reported it. A dialog over a queue without a row would only show loading.
  if (files.length === 0) return
  const config = imageWidgetUploadConfig.value!
  cachedExtSystemId.value = config.extSystem
  stopQueueLeftBehind(props.queueKey)
  uploadQueuesStore.addByFiles(props.queueKey, config.extSystem, config.licence, files, damConfigName)
  uploadQueueDialog.value = props.queueKey
}

const { uploadSizes, uploadAccept } = useDamAcceptTypeAndSizeHelper(
  DamAssetType.Image,
  imageWidgetUploadConfig.value.extSystemConfig
)

// Id of the image this widget just created. The model changes to it, and the widget shows the create response.
// Reading it again made the preview fall back to the placeholder, and a failed read
// showed an error after a successful save. Any other id change triggers a read.
let createdImageId: IntegerIdNullable = null

const reloadImage = async (
  newImage: ImageCreateUpdateAware | undefined,
  newImageId: IntegerIdNullable,
  force = false
) => {
  resolvedSrc.value = imagePlaceholderPath
  if ((newImage && isNull(resImageMedia.value)) || (newImage && force)) {
    resImageMedia.value = cloneDeep(newImage)
    resImageReadAt = holdImage(damConfigName, thisWidget, newImage.id ?? null)
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
    // Counted when the read is sent: a save answered later may have taken effect after the read.
    const readAt = holdImage(damConfigName, thisWidget, newImageId)
    try {
      resImageMedia.value = await imageApi.fetchImage(imageClient, newImageId)
      resImageReadAt = readAt
    } catch (error) {
      showErrorsDefault(error)
    }
    // The widget is gone. With `expandMetadata` it would write its image into
    // the page-wide dialog store, which now shows the next widget's image.
    if (disposed) return
    if (isImageCreateUpdateAware(resImageMedia.value)) {
      if (isNumber(props.damWidth) && isNumber(props.damHeight)) {
        resolvedSrc.value = widgetImageToDamImageUrl(toRaw(resImageMedia.value), props.damWidth, props.damHeight)
      } else {
        resolvedSrc.value = widgetImageToDamImageUrl(toRaw(resImageMedia.value))
      }
      if (props.expandMetadata) void showReadInForm()
    }
    return
  }
  resImageMedia.value = null
  holdImage(damConfigName, thisWidget, null)
}

const reloadMedia = (newMedia: MediaAware | null) => {
  resolvedSrc.value = imagePlaceholderPath
  holdImage(damConfigName, thisWidget, null)
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

// `release` false: an open menu or dialog holds the lock and releases it on close or confirm.
// Otherwise the editor holds no lock, and the value reaches the buffer only here.
const reset = (release = true) => {
  resolvedSrc.value = imagePlaceholderPath
  resImageMedia.value = null
  holdImage(damConfigName, thisWidget, null)
  imageModel.value = null
  mediaModel.value = null
  // Keeps the form shown by another widget's open dialog.
  imageMediaWidgetStore.resetUnlessShown(thisWidget)
  if (release || props.collabStatus === CollabStatus.Inactive) releaseFieldLockWith({ image: null, media: null })
}

watch(
  [() => props.initialImage, imageModel, mediaModel],
  async ([newImage, newImageId, newMedia], [oldImage, oldImageId, oldMedia]) => {
    // Cleared on every run, also one that ends with media. Otherwise a later change to that id would not be read.
    const created = createdImageId
    createdImageId = null
    if (!isNull(newMedia) && JSON.stringify(newMedia) !== JSON.stringify(oldMedia)) {
      reloadMedia(newMedia)
      return
    }

    if (newImage !== oldImage || newImageId !== oldImageId) {
      if (!isNull(created) && newImageId === created && newImage === oldImage) return
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
const { getDamConfigExtSystem } = useDamConfigState(undefined, damConfigName)

// The picker closes as it answers, and the next dialog opens only after the asset is fetched or copied.
// Until then the pick counts as an open dialog, or the close watcher released the lock with the old value.
// Counts every pending pick: one whose dialog was closed released the lock under a later pick.
const assetPicksPending = ref(0)
const onAssetSelectConfirm = async (data: AssetSelectReturnData) => {
  if (props.readonly) return
  const thisPick = (loadingInDialog = Symbol('pick'))
  assetPicksPending.value++
  try {
    await pickAsset(data, thisPick)
  } finally {
    assetPicksPending.value--
    // A pick that ended early (no main file, media not loaded) left the
    // dialog loading, so the next upload or edit showed only a spinner.
    // Cleared unless the dialog now loads for something opened since.
    if (loadingInDialog === thisPick) {
      loadingInDialog = null
      metadataDialogLoading.value = false
    }
  }
}

const pickAsset = async (data: AssetSelectReturnData, thisPick: symbol) => {
  if (data.type !== 'asset' || !data.value[0]) return
  metadataDialogLoading.value = true
  imageMediaWidgetStore.setDetail(null)
  offerNoDamAuthors()
  let description = ''
  let source = ''
  const selectedAsset = data.value[0]
  if (!selectedAsset.mainFile) return
  dialogType.value = selectedAsset.attributes.assetType
  // The asset's role is known only after it is read. The dialog shows loading
  // until then and during the copy into the upload licence, like the image widget.
  // Otherwise nothing was shown, and this dialog covered another widget's dialog opened meanwhile.
  metadataDialog.value = true
  let mediaDataFromDam: DamMediaFromDam | null = null
  try {
    mediaDataFromDam = await fetchAssetAsCmsMedia(damClient, selectedAsset.id, endPointCmsAsset)
  } catch (e) {
    showErrorsDefault(e)
  }
  // Nothing is written to the page-wide dialog store if the widget is gone or the dialog no longer loads for this pick.
  if (!answerTakenFor(thisPick)) return
  if (!mediaDataFromDam) return void (metadataDialog.value = false)
  if (selectedAsset.attributes.assetType === DamAssetType.Video && assetFileIsVideoFile(selectedAsset.mainFile)) {
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
    // An asset already in the upload licence is used as is.
    if (
      copyToLicenceEnabled !== false &&
      !isUndefined(data.copyToLicence) &&
      selectedAsset.licence !== data.copyToLicence
    ) {
      let copyRes: DamImageCopyToLicenceResponse | null = null
      try {
        copyRes = await copyToLicence(damClient, endPointImage, [
          { asset: data.value[0].id, targetAssetLicence: data.copyToLicence },
        ])
      } catch (e) {
        showErrorsDefault(e)
      }
      // A gone widget, or a dialog no longer loading for this pick, opens no upload dialog.
      // Otherwise the copy continued in the replacing widget's upload dialog, which requested the field lock only then.
      if (!answerTakenFor(thisPick)) return
      // The upload dialog shows the copy and replaces the image dialog.
      metadataDialogLoading.value = false
      metadataDialog.value = false
      if (copyRes) onCopyToLicence(copyRes)
      return
    }
    metadataDialog.value = true
    // Authors are offered only if the pick still owns the dialog. Otherwise
    // a left pick's read offered its authors in a later pick's dialog.
    let authorsToOffer: AssetDetailItemDto | null = null
    try {
      const assetRes = await fetchAsset(damClient, endPointAsset, selectedAsset.id)
      // Like the image widget: if the application has its own mapping, it builds the texts from the asset.
      if (customAssetSelectMetadataToImageMap) {
        const mapped = customAssetSelectMetadataToImageMap(assetRes)
        description = mapped.description
        source = mapped.source
      } else {
        if (isString(assetRes.metadata.customData?.description)) {
          description = assetRes.metadata.customData.description.trim()
        }
        if (assetRes.authors.length > 0) {
          // Under the ext system of the asset's licence, like all DAM author names the
          // widgets write. Falls back to the picker's when the licence does not resolve.
          const authorsRes = await fetchAuthorListByIds(
            damClient,
            endPointAuthor,
            (await getExtSystemByLicence(assetRes.licence)) ?? assetSelectStore.requireSelectedSelectConfig().extSystem,
            assetRes.authors
          )
          source = authorsRes.map((author) => author.name).join(', ')
        } else if (assetRes.authors.length === 0) {
          const configExtSystem = getDamConfigExtSystem(imageWidgetUploadConfig.value!.extSystem)
          // Not while the server may still fill metadata from the file: saving
          // authors marks the asset described, and the server then fills nothing.
          if (configExtSystem?.[DamAssetType.Image]?.authors?.enabled && !assetMetadataMayStillChange(assetRes)) {
            authorsToOffer = assetRes
          }
        }
      }
    } catch (e) {
      showErrorsDefault(e)
    }
    if (!answerTakenFor(thisPick)) return
    if (authorsToOffer) offerDamAuthorsOf(authorsToOffer, selectedAsset.mainFile.id)
    const image = createDamImage(
      {
        fileId: selectedAsset.mainFile.id,
        licenceId: selectedAsset.licence,
        internal: selectedAsset.mainFileInternal,
      },
      { description, source },
      { position: 1, id: isNull(imageModel.value) ? undefined : imageModel.value }
    )
    imageMediaWidgetStore.setDetail(image)
    pickInDialog = detail.value
  } else {
    // Not a kind the widget accepts (audio not in a podcast, video without a video file): nothing to show.
    metadataDialog.value = false
  }
  metadataDialogLoading.value = false
  if (props.expandMetadata) {
    forceReloadViewWithExpandMetadata()
  }
}

const assetDetailStore = useAssetDetailStore()
const { dialog: assetDialog } = storeToRefs(assetDetailStore)
const {
  damClient,
  endPointAsset,
  endPointImage,
  endPointAuthor,
  endPointCmsAsset,
  copyToLicenceEnabled,
  showSourceEnabled,
  sourceLabel,
  editAssetLabel,
  addFromDamLabel,
  replaceFromDamLabel,
  customAssetSelectMetadataToImageMap,
} = useCommonAdminCoreDamOptions(damConfigName)

const { getExtSystemByLicence } = useDamConfigState(damClient, damConfigName)

const onEditAsset = async (assetFileId: DocId) => {
  let extSystem: IntegerId | null = null
  try {
    await assetDetailStore.open(
      props.queueKey,
      async () => {
        const assetRes = await fetchAssetByFileId(damClient, endPointAsset, assetFileId)
        // Falls back to the ext system of the widget's upload licence,
        // loaded by its root, when the licence cannot be resolved.
        const shownUnder = (await getExtSystemByLicence(assetRes.licence)) ?? imageWidgetUploadConfig.value!.extSystem
        // Must load before the detail shows the asset: it reads the ext
        // system configuration while rendering and threw without it.
        await loadAssetDetailExtSystem(damClient, shownUnder, assetRes.attributes.assetType, damConfigName)
        extSystem = shownUnder
        return assetRes
      },
      // Only for the asset the detail still shows: a stale answer must not change the ext system used for name lookups.
      () => {
        if (extSystem) cachedExtSystemId.value = extSystem
      }
    )
  } catch (e) {
    showErrorsDefault(e)
  }
}

const onMetadataDialogClose = () => {
  imageMediaWidgetStore.setDetail(null)
  metadataDialog.value = false
  // Nothing is applied once the dialog is closed. Otherwise a pending
  // pick answer overwrote another widget's dialog form opened meanwhile.
  loadingInDialog = null
  metadataDialogLoading.value = false
  // Cancels this opening's wait for another widget's save.
  cancelSaveWait?.()
}

const tryMediaConfirm = async () => {
  if (!isMediaAware(detail.value)) return
  // Ignored while this widget's image save is in flight, like a second image confirm. That save's
  // answer sets the image and dropped the media confirmed meanwhile. The button spins until then.
  if (metadataDialogSaving.value) return
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
  // The asset of a just-closed detail is still being read, and the read may change
  // what the form requires. The confirm waits for it, then the form confirms again.
  const confirmAgain = () => detailDialogMetadataComponent.value?.confirm()
  if (holdConfirmForDetailAssetRead(metadataDialogSaving.value, confirmAgain)) return
  // Ignores a second press during the save: a host button is not disabled meanwhile and
  // Enter reaches the dialog button. Otherwise the image is created or updated twice.
  if (metadataDialogSaving.value) return
  // A confirm belongs to the image it was pressed on. During waits the dialog
  // may close and reopen for another image or media, or the widget may unmount.
  // Until the save is sent, each step continues only if the widget exists and the dialog still shows that image.
  // Otherwise another image was saved without a press, or an image without fields was created for a media.
  const pressedOn = detail.value
  const confirmIsOver = () => disposed || detail.value !== pressedOn
  // Authors are also not sent if the widget turned read-only meanwhile.
  const authorsSendIsOver = () => confirmIsOver() || props.readonly
  metadataDialogSaving.value = true
  // The dialog shows the source from the held asset, not the pick (its read
  // failed). Once saved, the image has its own source and the asset is released.
  const letGoHeld = letGoOnceSavedWithSource(pressedOn)
  try {
    const authorsAsset = damAuthorsAsset.value
    if (authorsAsset) {
      if (authorsAsset.authors.length > 0) {
        // The asset was read at pick time and may have gained authors
        // since. The write would replace them, so it is read again first.
        // A failed read saves nothing. If it now has authors nothing is written: the pick is dropped,
        // an empty source takes their names, a persistent message is shown, and the dialog stays.
        let givenMeanwhile: string | null
        try {
          givenMeanwhile = await authorsGivenMeanwhile(authorsAsset)
        } catch (e) {
          if (!authorsSendIsOver() && !showErrorsDefault(e)) showUnknownError()
          return
        }
        if (authorsSendIsOver()) return
        if (!isNull(givenMeanwhile)) {
          offerNoDamAuthors()
          giveNamesToEmptySource(pressedOn, givenMeanwhile)
          showWarningT('common.damImage.image.meta.authorsGivenMeanwhile', -1)
          return
        }
        // Author names go into the image source only after the DAM accepts the authors, and are held aside until then.
        // Written earlier, they stayed in the hidden source after a refused
        // write, and a confirm with the pick cleared saved them with the image.
        // Looked up under the ext system of the asset's licence, like the read before the write.
        const authorsRes = await fetchAuthorListByIds(
          damClient,
          endPointAuthor,
          (await getExtSystemByLicence(authorsAsset.licence)) ??
            assetSelectStore.requireSelectedSelectConfig().extSystem,
          authorsAsset.authors
        )
        // Silently stops if the dialog was left or the widget is gone or read-only.
        if (authorsSendIsOver()) return
        const source = authorsRes.map((author) => author.name).join(', ')
        try {
          await updateAssetAuthors(damClient, endPointAsset, authorsAsset)
        } catch (e) {
          // Names the authors refused by validation as the forms name them. The image is not saved.
          showMetadataSaveError(e, assetSelectStore.requireSelectedSelectConfig().extSystem, damConfigName)
          return
        }
        // The DAM already has the authors. The image is not saved.
        if (confirmIsOver()) return
        pressedOn.texts.source = source
        offerNoDamAuthors()
      }
    }
    const image = imageFieldsOf(pressedOn)
    // The save is noted for the other widgets of the page, even if this widget is gone by the time it answers.
    const res = image.id
      ? await noteImageSave(damConfigName, image.id, ownImageSaves, imageApi.updateImage(imageClient, image.id, image))
      : await imageApi.createImage(imageClient, image)
    // The widget is gone, so nothing of the answer is written.
    // The dialog store is shared by the page and may already belong to the
    // next widget. Writing here emptied its form and then showed this image.
    if (disposed) return
    letGoHeld()
    // This confirm closes the dialog if it shows the pressed image or nothing, or if "edit
    // metadata" reopened it. That copy is stale and its confirm would overwrite this save.
    // A dialog of another pick or upload stays open and keeps the field lock. A dialog still
    // loading for a pick or "edit metadata" also stays open. Closing it broke that load.
    // If the dialog was closed meanwhile, the store may show another widget's dialog, so it is not emptied.
    // The `expandMetadata` form is not a dialog. It shows the widget's image, now the saved one.
    const ownDialogOpen = metadataDialog.value
    const shown = detail.value
    const dialogOfAnotherPick =
      !props.expandMetadata &&
      ownDialogOpen &&
      (isNull(shown) ? !isNull(loadingInDialog) : shown !== pressedOn && shown !== ownInDialog)
    if (!dialogOfAnotherPick) metadataDialog.value = false
    if (!image.id) createdImageId = res.id
    imageModel.value = res.id
    mediaModel.value = null
    if (!dialogOfAnotherPick && (ownDialogOpen || props.expandMetadata)) imageMediaWidgetStore.setDetail(null)
    // A dialog of another pick or upload opened during a create gets the created
    // id. Otherwise its confirm created a second image and left this one unused.
    // Only the pick of this widget is updated. An image another widget put in the store belongs to that widget.
    if (dialogOfAnotherPick && !image.id && shown === pickInDialog && isImageCreateUpdateAware(shown)) {
      if (isUndefined(shown.id)) shown.id = res.id
    }
    // Runs before the dialog close is observed, so this release with the saved value is the one
    // sent. When the editor is alone there is no lock and the value goes to the buffer here.
    // While the menu or another dialog holds the field, the lock
    // stays with it. Releasing here broke a picker opened since.
    // Not while a dialog of another pick or upload is open. It sets the final
    // value under this id, and other editors reload only when the id changes.
    if (props.collabStatus === CollabStatus.Inactive || (!clickMenuOpened.value && !anyWidgetDialogOpened.value)) {
      releaseFieldLockWith({ image: res.id, media: null })
    } else if (lockedLocal.value && !dialogOfAnotherPick) {
      changeFieldData.value({ image: res.id, media: null })
    }
    await reloadImage(res, res.id, true)
    emit('afterMetadataSaveSuccess')
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    metadataDialogSaving.value = false
    // A dialog closed during this confirm left the lock to it. It is released here once nothing else holds it.
    // A disposed widget also releases with its current field value.
    // The server keeps locks until release or leaving the room.
    // Skipped if the replacement widget has taken the lock since, because the release would free its lock.
    if (disposed ? !lockTurnTakenSince() : !clickMenuOpened.value && !anyWidgetDialogOpened.value) {
      releaseFieldLockLocal()
    }
  }
}

const onMetadataDialogConfirm = async () => {
  if (props.readonly) return
  await tryMediaConfirm()
  await tryImageConfirm()
}

// While a delete is pending, closing the menu or a dialog does not release the
// lock. The menu closes on the click and released with the image still there.
// Same while a dialog confirm runs. Otherwise the lock went back with
// the old value and the saved image never reached other editors.
const deletePending = ref(false)
const onImageMediaDelete = async () => {
  // Use the widget's own image. The store detail is shared and may be empty or another widget's.
  const imageId = imageModel.value
  if (props.callDeleteApiOnRemove && !isNull(imageId)) {
    deletePending.value = true
    try {
      await imageApi.deleteImage(imageClient, imageId)
      // A widget that is gone writes nothing into the page.
      if (!disposed) reset(!clickMenuOpened.value && !anyWidgetDialogOpened.value)
    } catch (e) {
      showErrorsDefault(e)
    } finally {
      deletePending.value = false
    }
    // A disposed widget releases the lock with its field value, unless the replacement widget has taken the lock since.
    // Otherwise the release freed the lock held by that widget's open menu.
    if (disposed ? !lockTurnTakenSince() : !clickMenuOpened.value && !anyWidgetDialogOpened.value)
      releaseFieldLockLocal()
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
  // An upload brings its own source, so authors of a previously picked asset are not offered.
  offerNoDamAuthors()
  dialogType.value = DamAssetType.Image
  imageMediaWidgetStore.setDetail(items[0])
  pickInDialog = detail.value
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
    assetPicksPending.value > 0 ||
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
    // On open, a lock left unconfirmed by a refused drop is requested again. It
    // is done here, not in the click handler, because the click also closes.
    if (newValue) return void acquireFieldLockLocal(true)
    if (anyWidgetDialogOpened.value || deletePending.value || metadataDialogSaving.value) return
    releaseFieldLockLocal()
  },
  { immediate: false }
)

watch(
  anyWidgetDialogOpened,
  (newValue, oldValue) => {
    if (newValue === oldValue) return
    // Opened from an `expandOptions` button there is no menu to request the lock, so
    // the dialog does. Opened from the menu, it requests only an unconfirmed lock.
    if (newValue) return void acquireFieldLockLocal(true)
    if (deletePending.value || metadataDialogSaving.value) return
    releaseFieldLockLocal()
  },
  { immediate: false }
)

// When read-only, open dialogs and menus close as on cancel and the lock is released
// once none holds it. A dialog left open kept the lock unseen and reappeared on edit.
// A dialog with a save in progress is left to that save, which closes it. If the save fails, it closes then.
// With `expandMetadata` the in-page form is kept for its host to confirm later. Emptying it lost the pick still shown.
watch([() => props.readonly, metadataDialogSaving], ([readonly]) => {
  if (!readonly) return
  clickMenuOpened.value = false
  fileInputDialog.value = false
  if (metadataDialog.value && !metadataDialogSaving.value && !props.expandMetadata) onMetadataDialogClose()
})

// A lost connection drops this editor's locks on the server. Kept as
// held, the lock was never requested again and its release was refused.
// On reconnect, an open menu or dialog requests the lock again. This includes
// one opened while alone and one whose request was refused or unanswered.
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
      :show-dam-authors="!!damAuthorsAsset"
      :dam-authors="damAuthorsAsset?.authors"
      :show-source-enabled="showSourceEnabled"
      :source-label="sourceLabel"
      :edit-asset-label="editAssetLabel"
      :expand="expandMetadata"
      :saving="metadataDialogSaving || confirmWaits"
      :loading="metadataDialogLoading"
      :type="dialogType"
      @edit-asset="onEditAsset"
      @update:dam-authors="pickDamAuthors"
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
    :config-name="damConfigName"
    return-type="asset"
    :preselect-asset-type="preselectType"
    :preselect-in-podcast="preselectType === DamAssetType.Audio || null"
    @confirm="onAssetSelectConfirm"
  />
  <AssetDetailDialog
    v-if="assetDialog === queueKey"
    :queue-key="queueKey"
    :config-name="damConfigName"
    :ext-system="cachedExtSystemId"
    @close="onAssetDetailClose"
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
