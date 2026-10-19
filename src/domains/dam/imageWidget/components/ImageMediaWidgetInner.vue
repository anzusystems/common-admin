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

// Collaboration
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
// The turn of the lock of the field this widget took last, by a request or a release. Another widget of the same field
// may have taken one since: the widget drawn in place of this one once it is gone.
let ownLockTurn = 0
const takeLockTurn = () => {
  if (isDefined(props.collab)) ownLockTurn = takeFieldLockTurn(props.collab.room, props.collab.field)
}
const lockTurnTakenSince = () =>
  isDefined(props.collab) && lastFieldLockTurn(props.collab.room, props.collab.field) !== ownLockTurn
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
  takeLockTurn()
  lockedLocal.value = true
}
// A lock taken while the room was active is released in an inactive one too: the room turned inactive because the
// other editor left, and the server still holds it for whoever comes back.
const releaseFieldLockLocal = () => {
  if (lockedLocal.value === false) return
  releaseFieldLock.value(collabValue())
  takeLockTurn()
  lockedLocal.value = false
}
// One release per lock: the server refuses a second one, and its refusal read as the lock still held. An inactive
// room keeps the value for the editors who join, lock or not.
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
// Before the immediate watcher below: with expandMetadata it writes the detail while setup runs. Not the form an open
// dialog of another widget shows: a widget drawn late, once its configuration was read, emptied that form.
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

// The authors of the DAM the dialog of the image offers are those of an asset this widget has read itself, for the
// image that dialog shows, or draws in the page with `expandMetadata`.
const {
  damAuthorsAsset,
  offerDamAuthorsOf,
  offerNoDamAuthors,
  pickDamAuthors,
  onAssetDetailClose,
  holdConfirmForDetailAssetRead,
  readHeldAnew,
  takeHeldAnew,
  authorsGivenMeanwhile,
  confirmWaits,
} = useImageDialogDamAuthors(
  damConfigName,
  () =>
    (metadataDialog.value || props.expandMetadata) && isImageCreateUpdateAware(detail.value) ? detail.value : null,
  () => props.readonly
)

// What the widget's open dialog, or its form in the page, shows is in the store of the dialog: no other widget empties
// it meanwhile.
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

// What "edit metadata" has put into the dialog: a copy of the image or the media of the widget, as it was then.
let ownInDialog: typeof detail.value = null
// What a pick or an upload of this widget has put into the dialog last. The store of the dialog is the page's: what
// it shows may be what another widget's dialog, opened over this one, shows.
let pickInDialog: typeof detail.value = null
// What the dialog shows its loading for: a pick whose asset is being read, or "edit metadata" waiting for a save of the
// image by another widget, or for a read of the asset the widget holds. Its answer is put into the dialog only while
// the dialog still loads for it: not once the editor has closed it, nor once the store of the dialog, which is the
// page's, holds what another dialog shows. The answer of a pick replaced the form of the dialog of another widget,
// opened meanwhile, and what the editor had typed there was lost. The dialog that loads for it then closes: it shows
// that form too, and its confirm would save it here.
let loadingInDialog: symbol | null = null
const answerTakenFor = (opening: symbol) => {
  if (disposed || loadingInDialog !== opening) return false
  if (isNull(detail.value)) return true
  loadingInDialog = null
  metadataDialogLoading.value = false
  metadataDialog.value = false
  return false
}
// How many saves of the image it holds the page had seen answered when the widget read that image.
let resImageReadAt = 0
// The marks of the saves of images the widget has on their way.
const ownImageSaves = new Set<symbol>()
// The wait of an opening of "edit metadata" for a save of another widget: let go once the dialog closes.
let cancelSaveWait: (() => void) | null = null
// What the dialog is opened for: the image or the medium the widget holds, the asset picked, the uploaded image. Its
// title says it from the start, the same while the dialog loads, waits and saves.
const dialogType = ref<DamAssetTypeType>(DamAssetType.Image)
const actionEditMeta = async () => {
  dialogType.value = type.value ?? DamAssetType.Image
  const heldId = () => (isImageCreateUpdateAware(resImageMedia.value) ? resImageMedia.value.id : undefined)
  // Another widget of the page is saving the image (the widget this one was drawn in place of, its save still on its
  // way): the dialog shows its loading till that save is over.
  const id = heldId()
  const othersSaves = isNumber(id) ? imageSavesOfOthersOver(damConfigName, id, ownImageSaves) : null
  if (othersSaves) {
    const thisOpening = (loadingInDialog = Symbol('edit'))
    imageMediaWidgetStore.setDetail(null)
    metadataDialogLoading.value = true
    metadataDialog.value = true
    cancelSaveWait = othersSaves.cancel
    await othersSaves.over
    cancelSaveWait = null
    if (!answerTakenFor(thisOpening)) return
    loadingInDialog = null
    metadataDialogLoading.value = false
  }
  // The widget holds the asset of the image's file, picked without authors: the dialog shows its loading while that
  // asset is read anew, and what the read finds goes into the dialog with the image. Never for a medium.
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
  // Saved by another widget of the page after this one read it: the widget takes the image as that save left it. It
  // offered the texts it had read, and its confirm saved them back over the saved ones.
  const savedId = heldId()
  const saved = isNumber(savedId) ? imageSavedSince(damConfigName, savedId, resImageReadAt) : null
  if (saved) void reloadImage(saved, null, true)
  imageMediaWidgetStore.setDetail(toRaw(resImageMedia.value))
  takeHeldAnew(anew, isImageCreateUpdateAware(detail.value) ? detail.value : null)
  ownInDialog = detail.value
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
  // What held the lock of the field goes with the widget (its menu, a dialog, the picker, a pick being read, a drop
  // waiting for the lock), and nothing gave it back: the server keeps a lock till it is released or the editor leaves
  // the room, and the field stayed locked for the other editors. Given back with what the field has, unless a save or
  // a delete of the widget is on its way, which gives it back at its end, or the widget drawn in its place has taken a
  // turn of the lock since.
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

// The drop that is uploaded once the lock of the field comes: one, as the upload dialog shows one file while it saves
// all it is given. Each drop that waited used to queue its file.
let dropInWait: symbol | null = null

const onDrop = async (files: File[]) => {
  if (props.readonly) return
  // The dropzone has turned every file away, and said so: there is nothing to ask the lock of the field for.
  if (files.length === 0) return
  // The lock an earlier drop asked for is still on its way: this one is not taken.
  if (!isNull(dropInWait) && lockRequestPending.value) return
  // As a click on the dropzone: the field is another editor's.
  if (isLocked.value) {
    showErrorT('common.damImage.error.unableToLock')
    return
  }
  acquireFieldLockLocal(true)
  const config = imageWidgetUploadConfig.value!
  // After a refusal this drop has asked again, as before: it takes the place of the one still waiting.
  const thisDrop = Symbol('drop')
  dropInWait = thisDrop
  try {
    await waitForFieldLockIsReallyAcquired()
    // The lock can resolve after the widget is gone; uploading into it is worse than dropping.
    if (disposed) return
    if (dropInWait !== thisDrop) return
    // Turned read-only while the lock was awaited: the lock goes back and nothing is uploaded.
    if (props.readonly) {
      if (pendingLockWaits.size === 0 && !clickMenuOpened.value && !anyWidgetDialogOpened.value) releaseFieldLockLocal()
      return
    }
    cachedExtSystemId.value = config.extSystem
    // The widget holds one image, and its upload dialog shows one file: of several dropped at once the first is
    // uploaded, and the user is told. The others used to be uploaded too, unseen, and left without an image.
    if (files.length > 1) showWarningT('common.damImage.upload.onlyOneFile')
    stopQueueLeftBehind(props.queueKey)
    uploadQueuesStore.addByFiles(props.queueKey, config.extSystem, config.licence, files.slice(0, 1), damConfigName)
    uploadQueueDialog.value = props.queueKey
  } catch (e) {
    if (disposed || e === LOCK_WAIT_CANCELLED) return
    // A request that timed out may have been granted after all, and nothing else would release it. Only when nothing
    // else waits for or holds it: refused, this release reads as the lock held, and another drop still waiting uploaded
    // without its lock, or a menu opened meanwhile lost the one it asked for.
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
    uploadQueuesStore.queueItemDuplicate(data[0].targetAsset, data[0].targetMainFile, DamAssetType.Image)
  } else {
    showErrorT('common.damImage.queueItem.errorUnableToCopyToLicence')
    return
  }
  uploadQueueDialog.value = props.queueKey
}

const onFileInput = (files: File[]) => {
  if (props.readonly) return
  // The input has turned every file away, and said so: a dialog over a queue without a row would only load.
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

// The id of the image this widget has just created. Its model changes to that id, and what the widget shows is the
// answer to the create: read again, the preview fell back to the placeholder meanwhile, and a read that failed said
// an error after a save that went through. Any other change of the id is read as before.
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
    // Counted as the read is sent: a save answered after that may have taken effect only after the read.
    const readAt = holdImage(damConfigName, thisWidget, newImageId)
    try {
      resImageMedia.value = await imageApi.fetchImage(imageClient, newImageId)
      resImageReadAt = readAt
    } catch (error) {
      showErrorsDefault(error)
    }
    // The widget is gone: with `expandMetadata` its image would be put into the store of the dialog, which is the
    // page's, and by now shows the image of the next widget.
    if (disposed) return
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

// `release` false: a menu or dialog still open holds the lock, and its close or confirm releases it. Alone, the editor
// holds none, and the value goes to the buffer here or nowhere.
const reset = (release = true) => {
  resolvedSrc.value = imagePlaceholderPath
  resImageMedia.value = null
  holdImage(damConfigName, thisWidget, null)
  imageModel.value = null
  mediaModel.value = null
  // Not the form the open dialog of another widget shows.
  imageMediaWidgetStore.resetUnlessShown(thisWidget)
  if (release || props.collabStatus === CollabStatus.Inactive) releaseFieldLockWith({ image: null, media: null })
}

watch(
  [() => props.initialImage, imageModel, mediaModel],
  async ([newImage, newImageId, newMedia], [oldImage, oldImageId, oldMedia]) => {
    // Used up by every run, also one that ends at the media: left standing, it would keep a later change to that id
    // from being read.
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
const { getDamConfigExtSystem } = useDamConfigState()

// The picker closes itself as it answers, and the widget's next dialog opens only once the asset is fetched or
// copied: till then the pick counts as an open dialog, or the close watcher gave the lock up with the old value. Each
// pick on its way counts: the end of one whose dialog the editor had closed gave the lock up under a later one.
const assetPicksPending = ref(0)
const onAssetSelectConfirm = async (data: AssetSelectReturnData) => {
  if (props.readonly) return
  const thisPick = (loadingInDialog = Symbol('pick'))
  assetPicksPending.value++
  try {
    await pickAsset(data, thisPick)
  } finally {
    assetPicksPending.value--
    // Ended early (no main file, the media not loaded), the pick left the dialog loading: the next upload or edit
    // showed only a spinner. Whatever it loaded is loaded by now. Unless the dialog loads for what has opened it since.
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
  // What the asset is to the widget is known once it is read: the dialog shows its loading till then, and while an
  // image is copied into the licence of the upload, as that of the image widget does. Nothing was shown, and a dialog
  // of another widget opened meanwhile was covered by this one.
  metadataDialog.value = true
  let mediaDataFromDam: DamMediaFromDam | null = null
  try {
    mediaDataFromDam = await fetchAssetAsCmsMedia(damClient, selectedAsset.id)
  } catch (e) {
    showErrorsDefault(e)
  }
  // The widget is gone: nothing of its pick is put into the store of the dialog, which is the page's. Nor when the
  // dialog no longer loads for this pick.
  if (!answerTakenFor(thisPick)) return
  // Nothing to show: the dialog closes.
  if (!mediaDataFromDam) return void (metadataDialog.value = false)
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
    // An asset already in the licence of the upload is taken as it is.
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
      // A widget that is gone, or a dialog that no longer loads for the pick, opens no upload dialog: the copy of a
      // widget that is gone went on in the upload dialog of the widget drawn in its place, which asked for the lock of
      // the field only then.
      if (!answerTakenFor(thisPick)) return
      // The upload dialog shows the copy, and takes the place of the dialog of the image.
      metadataDialogLoading.value = false
      metadataDialog.value = false
      if (copyRes) onCopyToLicence(copyRes)
      return
    }
    metadataDialog.value = true
    // The authors are offered once the pick still has the dialog: the read of a pick the dialog has left offered those
    // of its asset in the dialog of the pick shown since.
    let authorsToOffer: AssetDetailItemDto | null = null
    try {
      const assetRes = await fetchAsset(damClient, endPointAsset, selectedAsset.id)
      // As the image widget: the texts are the application's to make of the asset, where it has a mapping of its own.
      if (customAssetSelectMetadataToImageMap) {
        const mapped = customAssetSelectMetadataToImageMap(assetRes)
        description = mapped.description
        source = mapped.source
      } else {
        if (isString(assetRes.metadata.customData?.description)) {
          description = assetRes.metadata.customData.description.trim()
        }
        if (assetRes.authors.length > 0) {
          const authorsRes = await fetchAuthorListByIds(
            damClient,
            endPointAuthor,
            assetSelectStore.requireSelectedSelectConfig().extSystem,
            assetRes.authors
          )
          source = authorsRes.map((author) => author.name).join(', ')
        } else if (assetRes.authors.length === 0) {
          const configExtSystem = getDamConfigExtSystem(imageWidgetUploadConfig.value!.extSystem)
          // Not while the server may yet fill in its metadata from the file: saving the authors marks the asset
          // described, and the server then fills in nothing.
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
    // Of no kind the widget takes (an audio in no podcast, a video whose file is no video): nothing to show.
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
  copyToLicenceEnabled,
  showSourceEnabled,
  sourceLabel,
  editAssetLabel,
  addFromDamLabel,
  replaceFromDamLabel,
  customAssetSelectMetadataToImageMap,
} = useCommonAdminCoreDamOptions(damConfigName)

const { getExtSystemByLicence } = useDamConfigState(damClient)

const onEditAsset = async (assetFileId: DocId) => {
  let extSystem: IntegerId | null = null
  try {
    await assetDetailStore.open(
      props.queueKey,
      async () => {
        const assetRes = await fetchAssetByFileId(damClient, endPointAsset, assetFileId)
        extSystem = await getExtSystemByLicence(assetRes.licence)
        return assetRes
      },
      // Only for the asset the detail shows: an answer it no longer waits for must not change the ext system the page
      // asks for names under.
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
  // What it was loading for is not shown once it is closed: the answer of a pick being read went into the store of the
  // dialog all the same, over the form of a dialog of another widget opened meanwhile.
  loadingInDialog = null
  metadataDialogLoading.value = false
  // The wait of the opening it was loading for, for a save of another widget, is taken off that save.
  cancelSaveWait?.()
}

const tryMediaConfirm = async () => {
  if (!isMediaAware(detail.value)) return
  // Not taken while the save of an image of this widget is on its way, as a second confirm of that image is not: the
  // answer of that save sets the image, and took away the media confirmed meanwhile. The button spins till then.
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
  // The asset of a detail that has just closed is still being read. What the dialog offers may change by that read,
  // and with it what its form asks for: the confirm waits for the read, and is then taken again by the form.
  const confirmAgain = () => detailDialogMetadataComponent.value?.confirm()
  if (holdConfirmForDetailAssetRead(metadataDialogSaving.value, confirmAgain)) return
  // Pressed again while the save of the first press runs (the button of a host is not disabled meanwhile, and Enter
  // reaches the one of the dialog), it is not taken: the image would be created, or updated, a second time.
  if (metadataDialogSaving.value) return
  // A confirm is for the image it was pressed on. While it waits for an answer the dialog can be closed, and opened
  // again for another image or for a media, and the widget can go away with its page. Until the image is sent to be
  // saved, the confirm goes on after each wait only for a widget that is still there, and only while the dialog still
  // shows that image. It went on with whatever the dialog showed by then: that image was saved without a press, and
  // its dialog closed, and for a media an image without its fields was sent to be created.
  const pressedOn = detail.value
  const confirmIsOver = () => disposed || detail.value !== pressedOn
  // Nor are the authors sent by a widget that has turned read-only meanwhile.
  const authorsSendIsOver = () => confirmIsOver() || props.readonly
  metadataDialogSaving.value = true
  try {
    const authorsAsset = damAuthorsAsset.value
    if (authorsAsset) {
      if (authorsAsset.authors.length > 0) {
        // The asset was read at its pick, and may have been given authors elsewhere since: the write replaces them
        // with those picked here. It is read again first. A read that fails saves nothing. Once it has authors nothing
        // is written either: the pick goes, an empty source takes their names, the user is told till they close the
        // message, and the dialog stays.
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
        // Their names become the source of the image once the DAM has taken the authors, and wait aside till then.
        // Written before, they stayed in the source, which the dialog does not show, after a write the DAM refused,
        // and a confirm with the pick emptied saved them with the image.
        const authorsRes = await fetchAuthorListByIds(
          damClient,
          endPointAuthor,
          assetSelectStore.requireSelectedSelectConfig().extSystem,
          authorsAsset.authors
        )
        // Nothing is written and nothing said: the authors are not sent for a dialog the user has left, nor by a
        // widget that is gone or read-only.
        if (authorsSendIsOver()) return
        const source = authorsRes.map((author) => author.name).join(', ')
        try {
          await updateAssetAuthors(damClient, endPointAsset, authorsAsset)
        } catch (e) {
          // The authors refused by validation are named as the forms name them. The image is not saved.
          showMetadataSaveError(e, assetSelectStore.requireSelectedSelectConfig().extSystem)
          return
        }
        // The DAM has the authors, and the image is not saved.
        if (confirmIsOver()) return
        pressedOn.texts.source = source
        offerNoDamAuthors()
      }
    }
    const image = imageFieldsOf(pressedOn)
    // An update is noted for the other widgets of the page, also when this one is gone by its answer.
    const res = image.id
      ? await noteImageSave(damConfigName, image.id, ownImageSaves, imageApi.updateImage(imageClient, image.id, image))
      : await imageApi.createImage(imageClient, image)
    // The widget is gone: nothing of the answer is written. The store of the dialog is the page's, and by now the
    // next widget's: its form was emptied, and then showed the image saved here.
    if (disposed) return
    // The save went through, and the widget takes its image. The dialog is this confirm's to close while it shows the
    // image the confirm was pressed on, or none. It is closed as well when "edit metadata" has opened it since: what
    // it shows is a copy of the image or the media the widget had before this save, and its confirm would put that
    // over the image saved here. The dialog of another pick or upload, opened since, stays as it is, with the lock of
    // the field, which its own close or confirm gives back. The form `expandMetadata` draws in the page is no such
    // dialog: it shows the image of the widget, the saved one from here on. With the dialog closed meanwhile, what the
    // store of the dialog shows by then is no longer this widget's to empty: it is what another widget's open dialog
    // shows. A dialog opened since that still loads for a pick (or for "edit metadata") stays open as well: what it
    // loads for fills it, with the id saved here. Closed here, it left the widget loading for that pick, whose answer
    // opened the dialog again, or closed an "edit metadata" opened meanwhile, which showed only the spinner.
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
    // That dialog was opened while this image was being created, for a widget that had no image: the image its pick or
    // upload put there takes the id created here, and its confirm updates this image. It created a second one, and
    // this one was left unused. Only that image: one another widget has put into the store since is that widget's.
    if (dialogOfAnotherPick && !image.id && shown === pickInDialog && isImageCreateUpdateAware(shown)) {
      if (isUndefined(shown.id)) shown.id = res.id
    }
    // Before the dialog's close is seen, so this release, with what was just assigned, is the one that goes. Alone,
    // the editor holds no lock, and the value goes to the buffer here or nowhere. While the menu of the widget or
    // another of its dialogs (that of another pick, the picker, the upload) holds the field, the lock stays with it,
    // and gives it back as it closes; the other editors are sent the saved image now. Released here, a picker opened
    // since lost its lock, and what it put into the field later went to nobody. Not while the dialog of another pick
    // or upload is open: it sets what the field ends with, also under the id saved here (it is given that id when
    // this was a create), and the other editors, who read an image again only when its id changes, kept this one.
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
    // A dialog closed while this confirm ran left the lock of the field to it (see the watchers): given back once it
    // is over, when nothing else of the widget holds it. Saved, the image went with it above; otherwise the field
    // keeps what it had. A widget that is gone gives it back too, with what its field has: it wrote nothing of the
    // answer. The server keeps a lock till it is released or the editor leaves the room, and the field stayed locked
    // for the other editors. Unless the widget drawn in its place has taken a turn of the lock since: the release
    // would free the lock that one holds.
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

// Till the delete is answered, neither the menu's close nor a dialog's gives the lock up: the menu closes on the click,
// and its release went out with the image still there, the reset's own skipped as for a lock already given back. Nor
// while a confirm of the dialog runs: closed before its save answered, the dialog gave the lock back with what the
// field had before, and the release of the answer, as for a lock already given back, never sent the saved image to the
// other editors.
const deletePending = ref(false)
const onImageMediaDelete = async () => {
  // The widget's own image: the store's detail is shared, empty unless a dialog loaded it, or another widget's.
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
    // Gone, the widget gives the lock back with what its field has, as it does at the end of a confirm: unless the
    // widget drawn in its place has taken a turn of the lock since. The release of the reset freed the lock that one
    // held, under its open menu.
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
  // The image of an upload comes with its source: the authors of an asset picked before are not offered with it.
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
    // Opened: a lock a refused drop left unconfirmed is asked for again, here and not in the click, which also closes.
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
    // Opened by a button of `expandOptions`, with no menu to ask for the lock, the dialog asks; opened from the menu,
    // only for a lock not confirmed yet.
    if (newValue) return void acquireFieldLockLocal(true)
    if (deletePending.value || metadataDialogSaving.value) return
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
