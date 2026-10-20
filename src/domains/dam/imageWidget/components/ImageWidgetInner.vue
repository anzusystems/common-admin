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
import { type AssetDetailItemDto, DamAssetType, type DamImageCopyToLicenceResponse } from '@/domains/dam/types/Asset'
import { useDamAcceptTypeAndSizeHelper } from '@/domains/dam/config/composables/acceptTypeAndSizeHelper'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import AAssetSelect from '@/domains/dam/assetSelect/components/AAssetSelect.vue'
import type { AssetSelectReturnData } from '@/domains/dam/types/AssetSelect'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'
import ImageDetailDialogMetadata from '@/domains/dam/imageWidget/components/ImageDetailDialogMetadata.vue'
import { computed, inject, onBeforeUnmount, ref, type ShallowRef, toRaw, watch } from 'vue'
import AssetDetailDialog from '@/domains/dam/assetDetail/components/AssetDetailDialog.vue'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { storeToRefs } from 'pinia'
import {
  fetchAsset,
  fetchAssetByFileId,
  showMetadataSaveError,
  updateAssetAuthors,
} from '@/domains/dam/api/damAssetApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import UploadQueueDialogSingle from '@/domains/dam/uploadQueue/components/UploadQueueDialogSingle.vue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { fetchAuthorListByIds } from '@/domains/dam/author/api/authorApi'
import { useI18n } from 'vue-i18n'
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
import {
  isImageCreateUpdateAware,
  useImageMediaWidgetStore,
} from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
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
    image?: ImageAware | undefined // optional, if available, no need to fetch image data
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
    skipCurrentUserCheck?: boolean
  }>(),
  {
    configName: undefined,
    collab: undefined,
    collabStatus: CollabStatus.Inactive,
    label: undefined,
    required: false,
    image: undefined,
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
    skipCurrentUserCheck: false,
  }
)

const emit = defineEmits<{
  (e: 'afterMetadataSaveSuccess'): void
}>()

const modelValue = defineModel<IntegerIdNullable>({ required: true })
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
  // addCollabFieldDataChangeListener((data: CollabFieldDataEnvelope) => {
  //   modelValue.value = data.value as IntegerIdNullable
  //   reload(undefined, modelValue.value)
  // })
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
const releaseFieldLockLocal = (value: IntegerIdNullable) => {
  if (lockedLocal.value === false) return
  releaseFieldLock.value(value)
  takeLockTurn()
  lockedLocal.value = false
}
// One release per lock: the server refuses a second one, and its refusal read as the lock still held. An inactive
// room keeps the value for the editors who join, lock or not.
const releaseFieldLockWith = (value: IntegerIdNullable) => {
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
const { widgetImageToDamImageUrl } = useImageActions(imageOptions)
const uploadQueuesStore = useUploadQueuesStore()
// Before the immediate watcher below: with expandMetadata it writes the detail while setup runs. Not the form an open
// dialog of another widget shows: a widget drawn late, once its configuration was read, emptied that form.
const imageMediaWidgetStore = useImageMediaWidgetStore()
imageMediaWidgetStore.resetUnlessShown()
const { detail } = storeToRefs(imageMediaWidgetStore)
const thisWidget = Symbol('image widget')
const { uploadQueueDialog, stopQueueLeftBehind } = useUploadQueueDialog()

const resImage = ref<null | ImageCreateUpdateAware>(null)
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
  letGoOnceSavedWithSource,
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

const withoutImage = computed(() => {
  return isNull(modelValue.value)
})

const resolvedSrc = ref('')

const uploadQueue = computed(() => {
  return uploadQueuesStore.getQueue(props.queueKey)
})

const imageLoaded = computed(() => {
  return !isNull(resImage.value)
})

// What "edit metadata" has put into the dialog: a copy of the image of the widget, as it was then.
let ownImageInDialog: typeof detail.value = null
// What a pick or an upload of this widget has put into the dialog last. The store of the dialog is the page's: what
// it shows may be the image of another widget's dialog, opened over this one.
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
const actionEditMeta = async () => {
  const heldId = () => resImage.value?.id
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
    const over = await withinWaitLimit(othersSaves.over, 1, damConfigName)
    cancelSaveWait = null
    if (!answerTakenFor(thisOpening)) return
    loadingInDialog = null
    metadataDialogLoading.value = false
    // That save has not answered in time: the dialog closes, and the user is told the request timed out. It loaded
    // till the editor closed it. Shown, what the widget read before that save would go out with the confirm over what
    // the save may yet write.
    if (over === WAIT_RAN_OUT) {
      othersSaves.cancel()
      metadataDialog.value = false
      showErrorT('error.apiTimedOut.message')
      return
    }
  }
  // The widget holds the asset of the image's file, picked without authors: the dialog shows its loading while that
  // asset is read anew, and what the read finds goes into the dialog with the image.
  const heldAnew = readHeldAnew(resImage.value?.dam.damId)
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
  if (saved) void reload(saved, null, true)
  imageMediaWidgetStore.setDetail(toRaw(resImage.value))
  takeHeldAnew(anew, isImageCreateUpdateAware(detail.value) ? detail.value : null)
  ownImageInDialog = detail.value
  metadataDialog.value = true
}

// With `expandMetadata` the form of the image is in the page once the image is read, with no "edit metadata" to wait
// for a save of the image by another widget, or to take what such a save wrote: the form does both, as that opening
// does. It showed the texts read before that save took effect, and the confirm of its host saved them back over the
// saved ones. Once the wait runs out the form shows what was read, and the user is told the request timed out.
const showReadInForm = async () => {
  const heldId = () => resImage.value?.id
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
    // The widget has been given another image meanwhile: that one is shown.
    if (heldId() !== id) return
  }
  const saved = isNumber(id) ? imageSavedSince(damConfigName, id, resImageReadAt) : null
  if (saved) return void reload(saved, null, true)
  imageMediaWidgetStore.setDetail(toRaw(resImage.value))
}

const actionLibrary = () => {
  assetSelectDialog.value = true
}

const { cachedExtSystemId } = useExtSystemIdForCached(damConfigName)

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
  // the room, and the field stayed locked for the other editors. Given back with the value the field has, unless a
  // save or a delete of the widget is on its way, which gives it back at its end, or the widget drawn in its place has
  // taken a turn of the lock since.
  if (!metadataDialogSaving.value && !deletePending.value && !lockTurnTakenSince()) {
    releaseFieldLockLocal(modelValue.value)
  }
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
      if (pendingLockWaits.size === 0 && !clickMenuOpened.value && !anyWidgetDialogOpened.value)
        releaseFieldLockLocal(modelValue.value)
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
    if (pendingLockWaits.size === 0 && !clickMenuOpened.value && !anyWidgetDialogOpened.value)
      releaseFieldLockLocal(modelValue.value)
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

const reload = async (newImage: ImageCreateUpdateAware | undefined, newImageId: IntegerIdNullable, force = false) => {
  resolvedSrc.value = imagePlaceholderPath
  if ((newImage && isNull(resImage.value)) || (newImage && force)) {
    resImage.value = cloneDeep(newImage)
    resImageReadAt = holdImage(damConfigName, thisWidget, newImage.id ?? null)
    if (resImage.value) {
      if (isNumber(props.damWidth) && isNumber(props.damHeight)) {
        resolvedSrc.value = widgetImageToDamImageUrl(toRaw(resImage.value), props.damWidth, props.damHeight)
      } else {
        resolvedSrc.value = widgetImageToDamImageUrl(toRaw(resImage.value))
      }
      if (props.expandMetadata) {
        imageMediaWidgetStore.setDetail(toRaw(resImage.value))
      }
    }
    return
  }
  if (newImageId) {
    // Counted as the read is sent: a save answered after that may have taken effect only after the read.
    const readAt = holdImage(damConfigName, thisWidget, newImageId)
    try {
      resImage.value = await imageApi.fetchImage(imageClient, newImageId)
      resImageReadAt = readAt
    } catch (error) {
      showErrorsDefault(error)
    }
    // The widget is gone: with `expandMetadata` its image would be put into the store of the dialog, which is the
    // page's, and by now shows the image of the next widget.
    if (disposed) return
    if (!isNull(resImage.value)) {
      if (isNumber(props.damWidth) && isNumber(props.damHeight)) {
        resolvedSrc.value = widgetImageToDamImageUrl(toRaw(resImage.value), props.damWidth, props.damHeight)
      } else {
        resolvedSrc.value = widgetImageToDamImageUrl(toRaw(resImage.value))
      }
      if (props.expandMetadata) void showReadInForm()
    }
    return
  }
  resImage.value = null
  holdImage(damConfigName, thisWidget, null)
}

// `release` false: a menu or dialog still open holds the lock, and its close or confirm releases it. Alone, the editor
// holds none, and the value goes to the buffer here or nowhere.
const reset = (release = true) => {
  resolvedSrc.value = imagePlaceholderPath
  resImage.value = null
  holdImage(damConfigName, thisWidget, null)
  modelValue.value = null
  if (release || props.collabStatus === CollabStatus.Inactive) releaseFieldLockWith(null)
}

const assetSelectStore = useAssetSelectStore()
const { getDamConfigExtSystem } = useDamConfigState(undefined, damConfigName)

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
  metadataDialogLoading.value = true
  imageMediaWidgetStore.setDetail(null)
  offerNoDamAuthors()
  let description = ''
  let source = ''
  if (data.type === 'asset') {
    if (!data.value[0] || !data.value[0].mainFile) return
    // The dialog shows its loading while the asset is read or copied into the licence of the upload, and nothing else
    // can be opened meanwhile. During a copy nothing was shown: the upload dialog it opened covered a dialog opened
    // since, and its "Save and apply" replaced the form of that dialog.
    metadataDialog.value = true
    // An asset already in the licence of the upload is taken as it is.
    if (
      copyToLicenceEnabled !== false &&
      !isUndefined(data.copyToLicence) &&
      data.value[0].licence !== data.copyToLicence
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
    // The authors are offered once the pick still has the dialog: the read of a pick the dialog has left offered those
    // of its asset in the dialog of the pick shown since.
    let authorsToOffer: AssetDetailItemDto | null = null
    try {
      const assetRes = await fetchAsset(damClient, endPointAsset, data.value[0].id)
      if (customAssetSelectMetadataToImageMap) {
        const mapped = customAssetSelectMetadataToImageMap(assetRes)
        description = mapped.description
        source = mapped.source
      } else {
        if (isString(assetRes.metadata.customData?.description)) {
          description = assetRes.metadata.customData.description.trim()
        }
        if (assetRes.authors.length > 0) {
          // Under the ext system of the licence of the asset, as every name of the authors of the DAM the widgets
          // write; that of the picker where the licence does not tell.
          const authorsRes = await fetchAuthorListByIds(
            damClient,
            endPointAuthor,
            (await getExtSystemByLicence(assetRes.licence)) ?? assetSelectStore.requireSelectedSelectConfig().extSystem,
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
    // The widget is gone: the image of its pick is not put into the store of the dialog, which is the page's. Nor
    // when the dialog no longer loads for this pick.
    if (!answerTakenFor(thisPick)) return
    if (authorsToOffer) offerDamAuthorsOf(authorsToOffer, data.value[0].mainFile.id)
    const image = createDamImage(
      {
        fileId: data.value[0].mainFile.id,
        licenceId: data.value[0].licence,
        internal: data.value[0].mainFileInternal,
      },
      { description, source },
      { position: 1, id: isNull(modelValue.value) ? undefined : modelValue.value }
    )
    imageMediaWidgetStore.setDetail(image)
    pickInDialog = detail.value
    metadataDialogLoading.value = false
    if (props.expandMetadata) {
      forceReloadViewWithExpandMetadata()
    }
  }
}

const assetDetailStore = useAssetDetailStore()
const { dialog: assetDialog } = storeToRefs(assetDetailStore)

const coreDamOptions = useCommonAdminCoreDamOptions(damConfigName)
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
} = coreDamOptions

const { getExtSystemByLicence } = useDamConfigState(damClient, damConfigName)

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
      // Only for the asset the detail shows: an answer it no longer waits for must not change the ext system its
      // configuration asks for names under.
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

const onMetadataDialogConfirm = async () => {
  if (props.readonly) return
  if (!isImageCreateUpdateAware(detail.value)) return
  // The asset of a detail that has just closed is still being read. What the dialog offers may change by that read,
  // and with it what its form asks for: the confirm waits for the read, and is then taken again by the form.
  const confirmAgain = () => detailDialogMetadataComponent.value?.confirm()
  if (holdConfirmForDetailAssetRead(metadataDialogSaving.value, confirmAgain)) return
  // Pressed again while the save of the first press runs (the button of a host is not disabled meanwhile, and Enter
  // reaches the one of the dialog), it is not taken: the image would be created, or updated, a second time.
  if (metadataDialogSaving.value) return
  // A confirm is for the image it was pressed on. While it waits for an answer the dialog can be closed, and opened
  // again for another image, and the widget can go away with its page. Until the image is sent to be saved, the
  // confirm goes on after each wait only for a widget that is still there, and only while the dialog still shows
  // that image. It went on with whatever the dialog showed by then: that image was saved without a press, and its
  // dialog closed.
  const pressedOn = detail.value
  const confirmIsOver = () => disposed || detail.value !== pressedOn
  // Nor are the authors sent by a widget that has turned read-only meanwhile.
  const authorsSendIsOver = () => confirmIsOver() || props.readonly
  metadataDialogSaving.value = true
  // The dialog shows the source of the image of the asset the widget holds, not the pick (a read of it failed): once
  // saved, the image has a source of its own, and the asset is let go.
  const letGoHeld = letGoOnceSavedWithSource(pressedOn)
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
        // Under the ext system of the licence of the asset, as the read before the write names authors given since.
        const authorsRes = await fetchAuthorListByIds(
          damClient,
          endPointAuthor,
          (await getExtSystemByLicence(authorsAsset.licence)) ??
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
          showMetadataSaveError(e, assetSelectStore.requireSelectedSelectConfig().extSystem, damConfigName)
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
    letGoHeld()
    // The save went through, and the widget takes its image. The dialog is this confirm's to close while it shows the
    // image the confirm was pressed on, or none. It is closed as well when "edit metadata" has opened it since: what
    // it shows is a copy of the image the widget had before this save, and its confirm would save that image over the
    // one saved here. The dialog of another pick or upload, opened since, stays as it is, with the lock of the field,
    // which its own close or confirm gives back. The form `expandMetadata` draws in the page is no such dialog: it
    // shows the image of the widget, the saved one from here on. With the dialog closed meanwhile, what the store of
    // the dialog shows by then is no longer this widget's to empty: it is the image of another widget's open dialog.
    // A dialog opened since that still loads for a pick (or for "edit metadata") stays open as well: what it loads for
    // fills it, with the id saved here. Closed here, it left the widget loading for that pick, whose answer opened the
    // dialog again, or closed an "edit metadata" opened meanwhile, which showed only the spinner.
    const ownDialogOpen = metadataDialog.value
    const shown = detail.value
    const dialogOfAnotherPick =
      !props.expandMetadata &&
      ownDialogOpen &&
      (isNull(shown) ? !isNull(loadingInDialog) : shown !== pressedOn && shown !== ownImageInDialog)
    if (!dialogOfAnotherPick) metadataDialog.value = false
    if (!image.id) createdImageId = res.id
    modelValue.value = res.id
    if (!dialogOfAnotherPick && (ownDialogOpen || props.expandMetadata)) imageMediaWidgetStore.setDetail(null)
    // That dialog was opened while this image was being created, for a widget that had no image: the image its pick or
    // upload put there takes the id created here, and its confirm updates this image. It created a second one, and
    // this one was left unused. Only that image: one another widget has put into the store since is that widget's.
    if (dialogOfAnotherPick && !image.id && shown === pickInDialog && isImageCreateUpdateAware(shown)) {
      if (isUndefined(shown.id)) shown.id = res.id
    }
    // Before the dialog's close is seen, so this release, with the id just assigned, is the one that goes. Alone, the
    // editor holds no lock, and the value goes to the buffer here or nowhere. While the menu of the widget or another
    // of its dialogs (that of another pick, the picker, the upload) holds the field, the lock stays with it, and gives
    // it back as it closes; the other editors are sent the saved image now. Released here, a picker opened since lost
    // its lock, and what it put into the field later went to nobody. Not while the dialog of another pick or upload
    // is open: it sets what the field ends with, also under the id saved here (it is given that id when this was a
    // create), and the other editors, who read an image again only when its id changes, kept this one.
    if (props.collabStatus === CollabStatus.Inactive || (!clickMenuOpened.value && !anyWidgetDialogOpened.value)) {
      releaseFieldLockWith(res.id)
    } else if (lockedLocal.value && !dialogOfAnotherPick) {
      changeFieldData.value(res.id)
    }
    await reload(res, res.id, true)
    emit('afterMetadataSaveSuccess')
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    metadataDialogSaving.value = false
    // A dialog closed while this confirm ran left the lock of the field to it (see the watchers): given back once it
    // is over, when nothing else of the widget holds it. Saved, the image went with it above; otherwise the field
    // keeps the value it had. A widget that is gone gives it back too, with the value its field has: it wrote none
    // of the answer. The server keeps a lock till it is released or the editor leaves the room, and the field stayed
    // locked for the other editors. Unless the widget drawn in its place has taken a turn of the lock since: the
    // release would free the lock that one holds.
    if (disposed ? !lockTurnTakenSince() : !clickMenuOpened.value && !anyWidgetDialogOpened.value) {
      releaseFieldLockLocal(modelValue.value)
    }
  }
}

// Till the delete is answered, neither the menu's close nor a dialog's gives the lock up: the menu closes on the click,
// and its release went out with the image still there, the reset's own skipped as for a lock already given back. Nor
// while a confirm of the dialog runs: closed before its save answered, the dialog gave the lock back with the image the
// field had before, and the release of the answer, as for a lock already given back, never sent the saved image to the
// other editors.
const deletePending = ref(false)
const onImageDelete = async () => {
  if (isNull(modelValue.value)) return
  if (props.callDeleteApiOnRemove) {
    deletePending.value = true
    try {
      await imageApi.deleteImage(imageClient, modelValue.value)
      // A widget that is gone writes nothing into the page.
      if (!disposed) reset(!clickMenuOpened.value && !anyWidgetDialogOpened.value)
    } catch (e) {
      showErrorsDefault(e)
    } finally {
      deletePending.value = false
    }
    // Gone, the widget gives the lock back with the value its field has, as it does at the end of a confirm: unless the
    // widget drawn in its place has taken a turn of the lock since. The release of the reset freed the lock that one
    // held, under its open menu.
    if (disposed ? !lockTurnTakenSince() : !clickMenuOpened.value && !anyWidgetDialogOpened.value) {
      releaseFieldLockLocal(modelValue.value)
    }
    return
  }
  reset()
}

const forceReloadViewWithExpandMetadata = () => {
  if (!isImageCreateUpdateAware(detail.value)) return
  reload(detail.value, null, true)
}

const onAssetUploadConfirm = (items: ImageCreateUpdateAware[]) => {
  if (props.readonly) return
  if (!items[0]) return

  if (!isNull(modelValue.value)) {
    items[0].id = modelValue.value
  }
  // The image of an upload comes with its source: the authors of an asset picked before are not offered with it.
  offerNoDamAuthors()
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

watch(
  clickMenuOpened,
  (newValue, oldValue) => {
    if (newValue === oldValue) return
    // Opened: a lock a refused drop left unconfirmed is asked for again, here and not in the click, which also closes.
    if (newValue) return void acquireFieldLockLocal(true)
    if (anyWidgetDialogOpened.value || deletePending.value || metadataDialogSaving.value) return
    releaseFieldLockLocal(modelValue.value)
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
    releaseFieldLockLocal(modelValue.value)
  },
  { immediate: false }
)

watch(
  [() => props.image, modelValue],
  async ([newImage, newImageId], [oldImage]) => {
    const created = createdImageId
    createdImageId = null
    if (!isNull(created) && newImageId === created && newImage === oldImage) return
    await reload(newImage, newImageId)
  },
  { immediate: true }
)

// Read-only, the widget draws none of its dialogs and menus (`!readonly`): those open close as their cancel does,
// nothing is saved, and the lock of the field goes back once none holds it. A dialog left open kept the lock for the
// other editors unseen, and came back by itself once the widget could be edited again. The dialog of a save on its
// way is left to that save, which closes it and gives the lock back as it ends; one the save leaves open (it failed)
// closes then. With `expandMetadata` the form is in the page and no dialog is closed: the form of a pick not yet
// confirmed stays, for its host to confirm once the widget can be edited again. It was emptied, while the widget went
// on showing the pick.
watch([() => props.readonly, metadataDialogSaving], ([readonly]) => {
  if (!readonly) return
  clickMenuOpened.value = false
  fileInputDialog.value = false
  if (metadataDialog.value && !metadataDialogSaving.value && !props.expandMetadata) onMetadataDialogClose()
})

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
            class="d-flex flex-row flex-wrap"
          >
            <VBtn
              v-if="imageLoaded && !expandMetadata"
              class="mr-2 mb-2"
              :disabled="isLocked"
              @click="actionEditMeta"
            >
              {{ t('common.damImage.image.meta.edit') }}
            </VBtn>
            <VBtn
              class="mr-2 mb-2"
              :disabled="isLocked"
              @click="actionLibrary"
            >
              <span v-if="imageLoaded">{{ replaceFromDamLabel }}</span>
              <span v-else>{{ addFromDamLabel }}</span>
            </VBtn>
            <AFileInputDialog
              ref="expandedUploadDialog"
              v-model="fileInputDialog"
              :file-input-key="uploadQueue?.fileInputKey"
              :accept="uploadAccept"
              :max-sizes="uploadSizes"
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
                    v-if="imageLoaded && !expandMetadata"
                    @click="actionEditMeta"
                  >
                    <VListItemTitle>{{ t('common.damImage.image.meta.edit') }}</VListItemTitle>
                  </VListItem>
                  <VListItem @click="actionLibrary">
                    <VListItemTitle>
                      <span v-if="imageLoaded">{{ replaceFromDamLabel }}</span>
                      <span v-else>{{ addFromDamLabel }}</span>
                    </VListItemTitle>
                  </VListItem>
                  <AFileInputDialog
                    v-model="fileInputDialog"
                    :file-input-key="uploadQueue?.fileInputKey"
                    :accept="uploadAccept"
                    :max-sizes="uploadSizes"
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
                    v-if="imageLoaded"
                    @click="onImageDelete"
                  >
                    <VListItemTitle>
                      {{ t('common.damImage.image.button.removeImage') }}
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
        <template #error>
          <div class="d-flex align-center justify-center h-100">
            <VIcon icon="mdi-alert-circle-outline" />
          </div>
        </template>
        <template #placeholder>
          <div class="d-flex align-center justify-center h-100">
            <VProgressCircular
              indeterminate
              color="grey-lighten-4"
            />
          </div>
        </template>
      </VImg>
      <AImageDropzone
        v-if="!readonly"
        variant="fill"
        transparent
        :accept="uploadAccept"
        :max-sizes="uploadSizes"
        :hide-text="!withoutImage || isLocked"
        @click="onDropzoneClick"
        @drop="onDrop"
      />
    </div>
    <slot
      name="append"
      :image="resImage"
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
      :type="DamAssetType.Image"
      @edit-asset="onEditAsset"
      @update:dam-authors="pickDamAuthors"
      @confirm="onMetadataDialogConfirm"
      @close="onMetadataDialogClose"
    />
  </div>
  <AAssetSelect
    v-model="assetSelectDialog"
    :select-licences="selectLicences"
    :upload-licence="uploadLicence"
    :min-count="1"
    :max-count="1"
    :asset-type="DamAssetType.Image"
    :skip-current-user-check="skipCurrentUserCheck"
    :config-name="damConfigName"
    return-type="asset"
    @confirm="onAssetSelectConfirm"
  >
    <template
      v-if="$slots['asset-select-sidebar-prepend']"
      #sidebar-prepend="slotProps"
    >
      <slot
        name="asset-select-sidebar-prepend"
        v-bind="slotProps"
      />
    </template>
  </AAssetSelect>
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
