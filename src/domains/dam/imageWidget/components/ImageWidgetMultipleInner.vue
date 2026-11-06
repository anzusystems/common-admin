<script lang="ts" setup>
import type { DocId, IntegerId } from '@/shared/types/common'
import { computed, inject, onBeforeUnmount, onMounted, ref, type ShallowRef, toRaw, watch } from 'vue'
import { isNull, isString, isUndefined } from '@/shared/utils/common'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import ImageWidgetMultipleItem from '@/domains/dam/imageWidget/components/ImageWidgetMultipleItem.vue'
import { storeToRefs } from 'pinia'
import { useCommonAdminImageOptions } from '@/domains/dam/imageWidget/composables/commonAdminImageOptions'
import { useAlerts } from '@/domains/system/composables/alerts'
import {
  type AssetDetailItemDto,
  type AssetSearchListItemDto,
  DamAssetType,
  type DamImageCopyToLicenceResponse,
} from '@/domains/dam/types/Asset'
import AAssetSelect from '@/domains/dam/assetSelect/components/AAssetSelect.vue'
import AFileInput from '@/domains/ui/file/components/AFileInput.vue'
import AImageDropzone from '@/domains/ui/file/components/AFileDropzone.vue'
import { useDamAcceptTypeAndSizeHelper } from '@/domains/dam/config/composables/acceptTypeAndSizeHelper'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { AssetSelectReturnData } from '@/domains/dam/types/AssetSelect'
import UploadQueueDialog from '@/domains/dam/uploadQueue/components/UploadQueueDialog.vue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import AssetDetailDialog from '@/domains/dam/assetDetail/components/AssetDetailDialog.vue'
import {
  type AssetAuthorsItems,
  bulkUpdateAssetsAuthors,
  fetchAsset,
  fetchAssetByFileId,
  fetchAssetListByIds,
  type IdsGroupedByLicences,
  showMetadataSaveError,
} from '@/domains/dam/api/damAssetApi'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { loadAssetDetailExtSystem } from '@/domains/dam/assetDetail/composables/assetDetailExtSystem'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import type { ImageStoreItem } from '@/domains/dam/types/ImageAware'
import { generateUUIDv1 } from '@/shared/utils/generator'
import ASortableListEditor from '@/domains/listEditor/components/ASortableListEditor.vue'
import AImageWidgetSimple from '@/domains/dam/imageWidget/components/AImageWidgetSimple.vue'
import { fetchAuthorListByIds } from '@/domains/dam/author/api/authorApi'
import { useI18n } from 'vue-i18n'
import useVuelidate from '@vuelidate/core'
import { AImageMetadataValidationScopeSymbol } from '@/domains/dam/composables/uploadValidations'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import ImageWidgetMultipleLimitDialog from '@/domains/dam/imageWidget/components/ImageWidgetMultipleLimitDialog.vue'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { fetchAssetListByFileIdsMultipleLicences } from '@/domains/dam/api/damfetchAssetListByFileIdsMultipleLicences'
import { copyToLicence } from '@/domains/dam/api/damImageApi'
import { createDamImage, imageFieldsOf } from '@/domains/dam/imageWidget/utils/damImage'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { useDamConfigStoreOf } from '@/domains/dam/config/store/damConfigStore'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'
import {
  holdImages,
  imageSavedSince,
  imageSavesOfOthersOver,
  noteImagesSave,
} from '@/domains/dam/imageWidget/utils/imageSaves'
import { WAIT_RAN_OUT, withinWaitLimit } from '@/domains/dam/imageWidget/utils/waitLimit'

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
    skipCurrentUserCheck?: boolean
  }>(),
  {
    configName: undefined,
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
    skipCurrentUserCheck: false,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', data: IntegerId[]): void
}>()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const assetSelectDialog = ref(false)

const imageWidgetUploadConfig = inject<ShallowRef<DamConfigLicenceExtSystemReturnType | undefined> | undefined>(
  ImageWidgetUploadConfigKey,
  undefined
)

if (isUndefined(imageWidgetUploadConfig) || isUndefined(imageWidgetUploadConfig.value)) {
  throw new Error("Fatal error, parent component doesn't provide necessary config ext system config.")
}

const imageOptions = useCommonAdminImageOptions(damConfigName)
const { imageClient, imageApi } = imageOptions
const { showErrorsDefault, showValidationError, showErrorT, showWarningT, showUnknownError } = useAlerts()
const uploadButtonComponent = ref<InstanceType<any> | null>(null)

const { uploadSizes, uploadAccept } = useDamAcceptTypeAndSizeHelper(
  DamAssetType.Image,
  imageWidgetUploadConfig.value.extSystemConfig
)

const { t } = useI18n()

const imagesLoading = ref(false)
const imagesLoadFailed = ref(false)

// Editor must not mount before the fetch lands: its dirty baseline is captured once, so rows
// arriving later would read as "added". One-shot, like the fetch.
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imagesReady = ref(props.modelValue.length === 0)

const listEditor = ref<{ commit: (rows?: ImageStoreItem[]) => void; cancelReorderMode: () => void } | null>(null)

const imageStore = useImageStore()
// The store is shared by all widgets. Leftovers from the previous one do not belong to this entity.
imageStore.reset()
watch(
  () => props.readonly,
  (value) => {
    imageStore.readonly = value
  },
  { immediate: true }
)
const { images, maxPosition } = storeToRefs(imageStore)

// Identity of this widget among the image-saving widgets (`imageSaves.ts`), and marks of its own pending saves.
const thisWidget = Symbol('image widget multiple')
const ownImageSaves = new Set<symbol>()
// Cancels waiting on other widgets' saves when this widget unmounts.
let cancelSaveWaits: (() => void) | null = null

/**
 * Resolves once no other widget has a pending save of any of `ids`, such as the
 * widget this one replaced. On timeout the user is told the request timed out.
 */
const savesOfOthersOver = async (ids: IntegerId[]) => {
  const waits = ids
    .map((id) => imageSavesOfOthersOver(damConfigName, id, ownImageSaves))
    .filter((wait) => !isNull(wait))
  if (waits.length === 0) return
  cancelSaveWaits = () => waits.forEach((wait) => wait.cancel())
  const over = await withinWaitLimit(Promise.all(waits.map((wait) => wait.over)), 1, damConfigName)
  cancelSaveWaits = null
  if (over !== WAIT_RAN_OUT) return
  waits.forEach((wait) => wait.cancel())
  if (!unmounted) showErrorT('error.apiTimedOut.message')
}

// Rows added while the entity images load wait for the load and
// come after them. Otherwise the load replaced them silently.
let imagesLoaded: Promise<void> = Promise.resolve()

const fetchImagesOnLoad = async () => {
  if (props.modelValue.length === 0) {
    return
  }
  try {
    imagesLoading.value = true
    // Counted when the read is sent: a save answered later may have taken effect after the read.
    const readAt = holdImages(damConfigName, thisWidget, props.modelValue)
    const read = await imageApi.fetchImageListByIds(imageClient, props.modelValue)
    // Rows wait until other widgets' saves of these images are over, using the latest saved state.
    // Otherwise a row had old texts and this widget's save wrote them back over the saved ones.
    await savesOfOthersOver(read.map((image) => image.id))
    if (unmounted) return
    const imagesRes = read
      .map((image) => {
        const saved = imageSavedSince(damConfigName, image.id, readAt.get(image.id) ?? 0)
        return saved ? { ...image, ...saved, id: image.id, position: saved.position ?? image.position } : image
      })
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    const groupedIds: IdsGroupedByLicences = new Map()
    imagesRes.forEach((image) => {
      const group = groupedIds.get(image.dam.licenceId)
      if (group) {
        group.push(image.dam.damId)
      } else {
        groupedIds.set(image.dam.licenceId, [image.dam.damId])
      }
    })

    let assetsRes: Awaited<ReturnType<typeof fetchAssetListByFileIdsMultipleLicences>> = []
    try {
      assetsRes = await fetchAssetListByFileIdsMultipleLicences(damClient, endPointAsset, groupedIds)
    } catch (e) {
      // Read-only shows images without DAM authors. A user without upload rights is often refused the assets.
      if (!props.readonly) throw e
    }

    imageStore.setImages(
      imagesRes.map((imageRes) => {
        if (isUndefined(imageRes.position)) throw new Error('Image object needs position field!')
        imageStore.updateMaxPositionIfGreater(imageRes.position)
        const found = assetsRes.find((asset) => asset.mainFile?.id === imageRes.dam.damId)
        return {
          key: generateUUIDv1(),
          ...imageRes,
          // Each row gets its own copy. Rows of the same asset shared the array.
          damAuthors: found ? [...found.authors] : [],
          showDamAuthors: found ? found.authors.length === 0 : false,
          assetId: found ? found.id : undefined,
        }
      })
    )
    // Displaying a read-only widget must not rewrite the form's value with the stored order.
    if (!props.readonly) {
      emit('update:modelValue', images.value.map((image) => image.id).filter((id) => id !== undefined) as IntegerId[])
    }
  } catch (e) {
    imagesLoadFailed.value = true
    showErrorsDefault(e)
  } finally {
    imagesLoading.value = false
    imagesReady.value = true
  }
}

const uploadQueuesStore = useUploadQueuesStore()

const uploadQueue = computed(() => {
  return uploadQueuesStore.getQueue(props.queueKey)
})

const { cachedExtSystemId } = useExtSystemIdForCached(damConfigName)

const { uploadQueueDialog, stopQueueLeftBehind } = useUploadQueueDialog()

const onFileInput = (files: File[]) => {
  if (props.readonly) return
  // The input rejected every file and reported it. Opening the queue dialog would show nothing new.
  if (files.length === 0) return
  const config = imageWidgetUploadConfig.value
  if (isUndefined(config)) return
  cachedExtSystemId.value = config.extSystem
  // `afterLimitDialogAdd` opens the queue dialog once files are
  // queued. Over the limit nothing is queued until the user agrees.
  // Rows of a queue no dialog shows are not counted. They go first.
  stopQueueLeftBehind(props.queueKey)
  limitDialogComponent.value?.check(files)
}

const onDrop = (files: File[]) => {
  if (props.readonly) return
  // Same as the input: the dropzone rejected every file and reported it.
  if (files.length === 0) return
  const config = imageWidgetUploadConfig.value
  if (isUndefined(config)) return
  cachedExtSystemId.value = config.extSystem
  stopQueueLeftBehind(props.queueKey)
  limitDialogComponent.value?.check(files)
}

const onCopyToLicence = (data: DamImageCopyToLicenceResponse) => {
  if (props.readonly) return
  if (data.length === 0) return
  const config = imageWidgetUploadConfig.value
  if (isUndefined(config)) return
  cachedExtSystemId.value = config.extSystem
  stopQueueLeftBehind(props.queueKey)
  let refused = 0
  data.forEach((item) => {
    if (item.result === 'copy') {
      uploadQueuesStore.addByCopyToLicence(
        props.queueKey,
        config.extSystem,
        config.licence,
        [item.targetAsset],
        damConfigName
      )
    } else if (item.result === 'exists') {
      uploadQueuesStore.addByCopyToLicence(
        props.queueKey,
        config.extSystem,
        config.licence,
        [item.targetAsset],
        damConfigName
      )
      uploadQueuesStore.queueItemDuplicate(item.targetAsset, item.targetMainFile, DamAssetType.Image, damConfigName)
    } else {
      refused++
    }
  })
  if (refused > 0) showErrorT('common.damImage.queueItem.errorUnableToCopyToLicence')
  if (refused === data.length) return
  uploadQueueDialog.value = props.queueKey
}

const afterLimitDialogAdd = () => {
  uploadQueueDialog.value = props.queueKey
}

/**
 * Images of picked assets, without position. Each asset is read under
 * its own licence, and its authors under that licence's ext system.
 * The browsed licence can change after picking, and the DAM silently omits assets of another licence.
 * `readUnder`: the licence of all assets and its ext system, when the caller knows them.
 */
const assetSelectConfirmMap = async (
  items: AssetSearchListItemDto[],
  readUnder?: { licence: IntegerId; extSystem: IntegerId }
): Promise<ImageStoreItem[]> => {
  const assetSelectStore = useAssetSelectStore()
  const assetMetadataMap = new Map<DocId, { description: string; authorIds: DocId[] }>()
  const authorsMap = new Map<DocId, string>()
  const idsByLicence: IdsGroupedByLicences = new Map()
  items.forEach((item) => {
    const licence = readUnder ? readUnder.licence : item.licence
    const group = idsByLicence.get(licence)
    if (group) {
      group.push(item.id)
    } else {
      idsByLicence.set(licence, [item.id])
    }
  })
  // A licence that fails to read does not stop the others.
  const failures: unknown[] = []
  for (const [licence, ids] of idsByLicence) {
    try {
      const assetDetails = await fetchAssetListByIds(damClient, endPointAsset, ids, licence)
      if (customAssetSelectMetadataToImageMap) {
        assetDetails.forEach((assetDetail) => {
          const mapped = customAssetSelectMetadataToImageMap(assetDetail)
          assetMetadataMap.set(assetDetail.id, {
            description: mapped.description,
            authorIds: [],
          })
          authorsMap.set(assetDetail.id, mapped.source)
        })
        continue
      }
      const authorIdsToFetch = new Set<DocId>()
      assetDetails.forEach((assetDetail) => {
        assetMetadataMap.set(assetDetail.id, {
          description: isString(assetDetail.metadata.customData?.description)
            ? assetDetail.metadata.customData.description.trim()
            : '',
          authorIds: assetDetail.authors,
        })
        assetDetail.authors.forEach((authorId) => {
          authorIdsToFetch.add(authorId)
        })
      })
      if (authorIdsToFetch.size > 0) {
        const licenceConfig = assetSelectStore.selectConfig.find((config) => config.licence === licence)
        // Uses the licence's ext system, as for every DAM author name the widgets
        // write. Falls back to the picker's when the licence does not tell.
        const authorsRes = await fetchAuthorListByIds(
          damClient,
          endPointAuthor,
          readUnder
            ? readUnder.extSystem
            : ((await getExtSystemByLicence(licence)) ??
                (licenceConfig ?? assetSelectStore.requireSelectedSelectConfig()).extSystem),
          [...authorIdsToFetch]
        )
        authorsRes.forEach((author) => {
          authorsMap.set(author.id, author.name)
        })
      }
    } catch (e) {
      failures.push(e)
    }
  }
  // Reported once for all failures. A DAM refusal arrives as a bare axios error that the default handler ignores.
  if (failures.length > 0 && !showErrorsDefault(failures[0])) showUnknownError()

  return items.map((asset) => {
    const authorIds = assetMetadataMap.get(asset.id)?.authorIds || []
    const description = assetMetadataMap.get(asset.id)?.description ?? ''

    if (customAssetSelectMetadataToImageMap) {
      return {
        key: generateUUIDv1(),
        ...createDamImage(
          { fileId: asset.mainFile!.id, licenceId: asset.licence, internal: asset.mainFileInternal },
          { description, source: authorsMap.get(asset.id) ?? '' },
          { position: 0 }
        ),
        damAuthors: [],
        showDamAuthors: false,
        assetId: asset.id,
      }
    }

    const authorNames: string[] = []
    assetMetadataMap.get(asset.id)?.authorIds.forEach((authorId) => {
      const name = authorsMap.get(authorId)
      if (!isUndefined(name) && name.trim().length > 0) {
        authorNames.push(name)
      }
    })

    return {
      key: generateUUIDv1(),
      ...createDamImage(
        { fileId: asset.mainFile!.id, licenceId: asset.licence, internal: asset.mainFileInternal },
        { description, source: authorNames.join(', ') },
        { position: 0 }
      ),
      damAuthors: authorIds,
      // Only for assets that were read. For an unread asset its authors are unknown, and authors
      // picked in the row would replace them in the DAM. Its row shows the source instead.
      showDamAuthors: assetMetadataMap.has(asset.id) && authorIds.length === 0,
      assetId: asset.id,
    }
  })
}

const positioned = (items: ImageStoreItem[]) =>
  items.map((item) => {
    maxPosition.value++
    return { ...item, position: maxPosition.value }
  })

const onAssetSelectConfirm = async (data: AssetSelectReturnData) => {
  if (props.readonly) return
  if (data.type !== 'asset' || data.value.length === 0) return
  const picked = data.value.filter((asset) => !isNull(asset.mainFile))
  // Picked assets from a licence other than the upload licence are copied. Assets
  // already in it are used at once. Copies are added when the queue dialog is used.
  const toCopy =
    copyToLicenceEnabled !== false && !isUndefined(data.copyToLicence)
      ? picked.filter((asset) => asset.licence !== data.copyToLicence)
      : []
  // A widget that unmounted or became read-only adds nothing. The image store belongs to the next widget by then.
  const addingIsOver = () => unmounted || props.readonly
  if (toCopy.length === 0) {
    const images = await assetSelectConfirmMap(picked)
    await imagesLoaded
    if (!addingIsOver()) imageStore.addImages(positioned(images))
    return
  }
  const copying = copyToLicence(
    damClient,
    endPointImage,
    toCopy.map((asset) => ({ asset: asset.id, targetAssetLicence: data.copyToLicence! }))
  )
  // Read during the copy under their own licence (the upload's) and its ext system, not the browsed one.
  // Added before the queue dialog opens. Otherwise using the dialog first put the copies before them.
  const asTheyAre = picked.filter((asset) => !toCopy.includes(asset))
  const config = imageWidgetUploadConfig.value
  const imagesAsTheyAre =
    asTheyAre.length === 0
      ? Promise.resolve([])
      : assetSelectConfirmMap(
          asTheyAre,
          config ? { licence: data.copyToLicence!, extSystem: config.extSystem } : undefined
        )
  let copyRes: DamImageCopyToLicenceResponse | null = null
  try {
    copyRes = await copying
  } catch (e) {
    showErrorsDefault(e)
  }
  const images = await imagesAsTheyAre
  await imagesLoaded
  if (addingIsOver()) return
  imageStore.addImages(positioned(images))
  if (copyRes) onCopyToLicence(copyRes)
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
  customAssetSelectMetadataToImageMap,
} = useCommonAdminCoreDamOptions(damConfigName)

// True while the detail was opened by "edit asset" of a row. Not for the detail
// opened from the queue dialog, which is drawn here too and reads nothing on close.
let detailOfRow = false
// Reads of assets whose detail closed, keyed by asset. The widget save waits for them.
// Reads of other assets do not wait on these. Otherwise closing one detail waited for another asset's save and read.
const detailAssetReads = new Map<DocId, Promise<void>>()
// Such a read may finish after unmount, when the store belongs to the next widget.
let unmounted = false
onBeforeUnmount(() => {
  unmounted = true
  holdImages(damConfigName, thisWidget, [])
  cancelSaveWaits?.()
})

const onEditAsset = async (assetFileId: DocId) => {
  detailOfRow = true
  let extSystem: IntegerId | null = null
  try {
    await assetDetailStore.open(
      props.queueKey,
      async () => {
        const asset = await fetchAssetByFileId(damClient, endPointAsset, assetFileId)
        // Falls back to the ext system of the widget's upload licence,
        // loaded by its root, when the licence cannot be resolved.
        const shownUnder = (await getExtSystemByLicence(asset.licence)) ?? imageWidgetUploadConfig.value!.extSystem
        // Must load before the detail shows the asset: it reads the ext
        // system configuration while rendering and threw without it.
        await loadAssetDetailExtSystem(damClient, shownUnder, asset.attributes.assetType, damConfigName)
        extSystem = shownUnder
        return asset
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

// An upload applied during the entity image load waits with its dialog and
// queue intact. Its rows come after the loaded images, then the dialog closes.
// If the widget is read-only or gone by then, the dialog and queue stay as for
// read-only, so nothing is lost. Before, the dialog and rows were dropped.
// Applying again while waiting is ignored, or rows would be added twice.
let uploadWaitsForLoad = false
const onAssetUploadConfirm = async (items: ImageStoreItem[]) => {
  if (props.readonly) return
  if (items.length === 0) return
  if (imagesLoading.value) {
    if (uploadWaitsForLoad) return
    uploadWaitsForLoad = true
    await imagesLoaded
    uploadWaitsForLoad = false
    if (unmounted || props.readonly) return
  }
  addUploadedRows(items)
  uploadQueueDialog.value = null
  uploadQueuesStore.stopUpload(props.queueKey)
}

const addUploadedRows = (items: ImageStoreItem[]) => {
  // A duplicate file becomes the asset of the existing image, and the dialog has just saved its authors. Rows of that
  // asset offering the pick take them, as after closing the detail. Otherwise their pick would overwrite those authors.
  // Names go into a row's source only if it has none. Before, they always overwrote it.
  if (authorEnabled.value) {
    items.forEach((item) => {
      if (isUndefined(item.assetId) || item.damAuthors.length === 0) return
      images.value.forEach((image) => {
        if (image.assetId !== item.assetId || !image.showDamAuthors) return
        takeAuthorsGiven(image, item.damAuthors, item.texts.source)
      })
    })
  }
  imageStore.addImages(positioned(items))
}

const actionLibrary = () => {
  assetSelectDialog.value = true
}

const v$ = useVuelidate({ $scope: AImageMetadataValidationScopeSymbol })

const { getDamConfigExtSystem, getExtSystemByLicence } = useDamConfigState(damClient, damConfigName)
const damConfigStore = useDamConfigStoreOf(damConfigName)

const authorEnabled = computed(() => {
  return !!getDamConfigExtSystem(cachedExtSystemId.value)?.[DamAssetType.Image]?.authors?.enabled
})

/**
 * Author names of an asset, in order, under its licence's ext system.
 * Falls back to `pageExtSystem` when the licence does not tell.
 */
const authorNamesOf = async (asset: AssetDetailItemDto, pageExtSystem: IntegerId) => {
  const extSystem = (await getExtSystemByLicence(asset.licence)) ?? pageExtSystem
  const authorsRes = await fetchAuthorListByIds(damClient, endPointAuthor, extSystem, asset.authors)
  const authorNames: string[] = []
  asset.authors.forEach((authorId) => {
    const name = authorsRes.find((author) => author.id === authorId)?.name
    if (!isUndefined(name) && name.trim().length > 0) {
      authorNames.push(name)
    }
  })
  return authorNames.join(', ')
}

/**
 * Once the asset turns out to have authors, a row offering the
 * author pick takes them, drops the pick and shows its source.
 * The source takes their names if empty or if it holds a hidden "fill empty"
 * pick from mass operations. An image's own source stays for the user to check.
 */
const takeAuthorsGiven = (row: ImageStoreItem, authors: DocId[], names: string) => {
  row.damAuthors = [...authors]
  if (row.texts.source.trim().length === 0 || imageStore.hasSourceOfPick(row)) row.texts.source = names
  imageStore.forgetSourceOfPick(row)
  row.showDamAuthors = false
}

/**
 * The detail may have given authors to an asset whose row offers the pick.
 * Otherwise the widget save overwrote them, or saved the image without a source.
 * So the asset is read again, and its offering rows take its authors with names under the asset
 * licence's ext system (see `takeAuthorsGiven`). Rows showing their source are left alone.
 * `detailSave`: the detail save pending at close. `pageExtSystem`: the ext system configured at that time.
 */
const takeAuthorsOfDetailAsset = async (assetId: DocId, detailSave: Promise<void> | null, pageExtSystem: IntegerId) => {
  try {
    // Read before the DAM answers that save, the asset would be stale.
    await detailSave
    const asset = await fetchAsset(damClient, endPointAsset, assetId)
    if (asset.authors.length === 0) return
    const source = await authorNamesOf(asset, pageExtSystem)
    if (unmounted || props.readonly) return
    images.value.forEach((image) => {
      // Uses the row's own flag. Whether the page shows the pick depends
      // on an ext system that another asset's detail may have changed.
      if (image.assetId !== asset.id || !image.showDamAuthors) return
      takeAuthorsGiven(image, asset.authors, source)
    })
  } catch (e) {
    if (!unmounted && !showErrorsDefault(e)) showUnknownError()
  }
}

/**
 * `shown`: the asset the detail showed. None if it closed from its loader or after a failed read.
 * Captured before any await: whether a row of that asset offers the
 * pick, the pending detail save, and the configured ext system.
 */
const onAssetDetailClose = (shown: AssetDetailItemDto | null) => {
  const ofRow = detailOfRow
  detailOfRow = false
  if (!ofRow || isNull(shown) || props.readonly || !authorEnabled.value) return
  const assetId = shown.id
  if (!images.value.some((image) => image.assetId === assetId && image.showDamAuthors)) return
  const detailSave = assetDetailStore.savingOf(assetId, damConfigName)
  const pageExtSystem = cachedExtSystemId.value
  const read = (detailAssetReads.get(assetId) ?? Promise.resolve()).then(() =>
    takeAuthorsOfDetailAsset(assetId, detailSave, pageExtSystem)
  )
  detailAssetReads.set(assetId, read)
  void read.then(() => {
    if (detailAssetReads.get(assetId) === read) detailAssetReads.delete(assetId)
  })
}

const saveImages = async () => {
  // Nothing of the user's to write. The images stay as loaded.
  if (props.readonly) return true
  // An empty store here means the fetch is pending or failed, not a
  // user deletion. The empty path below would detach every image.
  if (imagesLoading.value || imagesLoadFailed.value) {
    showUnknownError()
    return false
  }
  // A closed detail's asset is still being read. Its rows are not written until they have its authors.
  await Promise.all(detailAssetReads.values())
  if (unmounted) return false
  v$.value.$touch()
  if (v$.value.$invalid) {
    showValidationError()
    return false
  }
  try {
    const assetUpdateItems: AssetAuthorsItems = []
    const imagesRaw = toRaw(images.value)
    // Rows offering the author pick, grouped by asset. An entity may have
    // an image twice, and a queue duplicate is a second row of its asset.
    // Per row, authors went out once per row and the last won, and a row with no pick was saved without a source.
    // The asset gets the union of picks in its rows, each author once,
    // and each row gets the authors and names after the DAM accepts them.
    const offering = new Map<DocId, { assetId: DocId | undefined; rows: ImageStoreItem[]; authors: DocId[] }>()
    if (authorEnabled.value) {
      images.value.forEach((image) => {
        if (!image.showDamAuthors) return
        // A row offering the pick has an asset. One without would be grouped alone.
        const of = image.assetId ?? image.key
        const asset = offering.get(of) ?? { assetId: image.assetId, rows: [], authors: [] }
        offering.set(of, asset)
        asset.rows.push(image)
        image.damAuthors.forEach((author) => {
          if (!asset.authors.includes(author)) asset.authors.push(author)
        })
      })
    }
    const named: Array<{ assetId: DocId | undefined; rows: ImageStoreItem[]; authors: DocId[]; source: string }> = []
    for (const { assetId, rows, authors } of offering.values()) {
      if (authors.length === 0) continue
      if (assetId) assetUpdateItems.push({ id: assetId, authors })
      // Uses the ext system of the rows' asset licence, as the pre-write read does. Falls back to the configured
      // one when the page does not know the licence. It is not fetched, since entity rows can be of any licence.
      const extSystem =
        damConfigStore.damConfigLicenceExtSystem.get(rows[0]!.dam.licenceId)?.extSystem ?? cachedExtSystemId.value
      const authorsRes = await fetchAuthorListByIds(damClient, endPointAuthor, extSystem, authors)
      named.push({ assetId, rows, authors, source: authorsRes.map((author) => author.name).join(', ') })
    }
    // Unmounted while authors loaded: write nothing. Turned read-only: nothing of the user's is written.
    if (unmounted) return false
    if (props.readonly) return true
    // Assets may have received authors elsewhere since their rows loaded, and the write would
    // replace them. So each asset with picked authors is re-read right before the write.
    // If any asset already has authors, nothing is written. Its offering rows take those
    // authors (`takeAuthorsGiven`), a message stays until closed, and the user saves again.
    const picked = [...offering.values()].filter(({ assetId, authors }) => !isUndefined(assetId) && authors.length > 0)
    if (picked.length > 0) {
      const readAgain = await Promise.all(picked.map(({ assetId }) => fetchAsset(damClient, endPointAsset, assetId!)))
      // Unmounted or made read-only while the assets were read: write nothing.
      if (unmounted || props.readonly) return false
      const givenMeanwhile = picked
        .map(({ rows }, index) => ({ rows, asset: readAgain[index]! }))
        .filter(({ asset }) => asset.authors.length > 0)
      if (givenMeanwhile.length > 0) {
        const pageExtSystem = cachedExtSystemId.value
        const names = await Promise.all(givenMeanwhile.map(({ asset }) => authorNamesOf(asset, pageExtSystem)))
        if (unmounted || props.readonly) return false
        givenMeanwhile.forEach(({ rows, asset }, index) => {
          rows.forEach((row) => {
            if (row.showDamAuthors) takeAuthorsGiven(row, asset.authors, names[index]!)
          })
        })
        showWarningT('common.damImage.image.meta.galleryAuthorsGivenMeanwhile', -1)
        return false
      }
    }
    if (assetUpdateItems.length) {
      await bulkUpdateAssetsAuthors(damClient, endPointAsset, assetUpdateItems)
      // Unmounted while the authors were written: save no image. A widget mounted meanwhile
      // for the same images read them before this save, which is noted only once sent.
      if (unmounted) return false
    }
    // The DAM now has these authors even if the images are not saved, so the rows show the source as after a save.
    // If the rows kept offering the pick, the next save would send them as picks,
    // the pre-write read would find these authors, and nothing would be written.
    named.forEach(({ assetId, rows, authors, source }) => {
      rows.forEach((row) => {
        row.damAuthors = [...authors]
        row.texts.source = source
        if (isUndefined(assetId)) return
        row.showDamAuthors = false
        imageStore.forgetSourceOfPick(row)
      })
    })
    const sentRows = [...imagesRaw]
    // Note the saved images for the page's other widgets, one by one.
    // This runs even if this widget unmounted before the response.
    const resItems = await noteImagesSave(
      damConfigName,
      sentRows.map((row) => row.id).filter((id) => !isUndefined(id)),
      ownImageSaves,
      imageApi.bulkUpdateImages(imageClient, sentRows.map(imageFieldsOf))
    )
    // If unmounted before the response, write nothing to the image store. By then it belongs to the next widget.
    if (unmounted) return true
    holdImages(
      damConfigName,
      thisWidget,
      resItems.map((resItem) => resItem.id)
    )
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
    if (imageStore.images.length === 0) {
      listEditor.value?.commit([])
      // Emptying is a change too. Without this emit the parent keeps its old ids.
      emit('update:modelValue', ids)
      return true
    }

    // Match each returned image to its own sent row. Rows of the same file are matched one by one in send order.
    // Matching by file alone gave every row of a file the values of the first one.
    const getUpdatedItem = (item: ImageStoreItem): ImageStoreItem => {
      const index = sentRows.findIndex((row) => row.dam.damId === item.dam.damId)
      const matchedImage = index < 0 ? undefined : sentRows.splice(index, 1)[0]

      return {
        ...item,
        damAuthors: matchedImage ? matchedImage.damAuthors : item.damAuthors,
        // Only a row that offered DAM authors keeps offering them.
        // A row whose asset the DAM did not return has no asset to save them into, so it keeps its source.
        showDamAuthors: matchedImage ? matchedImage.showDamAuthors && matchedImage.damAuthors.length === 0 : false,
        assetId: matchedImage ? matchedImage.assetId : item.assetId,
      }
    }

    const updatedItems = items.map(getUpdatedItem)
    imageStore.setImages(updatedItems)
    // Pass the rows explicitly. `setImages` just replaced their keys,
    // so a bare `commit()` would read the not-yet-rerendered prop.
    listEditor.value?.commit(updatedItems)
    emit('update:modelValue', ids)
    return true
  } catch (e) {
    // Authors refused by validation are named as the forms name them. Other errors are shown as before.
    showMetadataSaveError(e, cachedExtSystemId.value, damConfigName)
    return false
  }
}

// Renumber the remaining images as after a move. Otherwise the backend gets positions with a gap.
const removeImage = (index: number) => {
  imageStore.removeImageByIndex(index)
  updateAllPositions()
}

const removeItem = async (index: number) => {
  const image = images.value[index]
  if (!image) return
  if (isUndefined(image.id)) {
    removeImage(index)
    return
  }
  if (props.callDeleteApiOnRemove) {
    try {
      await imageApi.deleteImage(imageClient, image.id)
      removeImage(index)
    } catch (e) {
      showErrorsDefault(e)
    }
    return
  }
  removeImage(index)
}

const limitDialogComponent = ref<InstanceType<typeof ImageWidgetMultipleLimitDialog> | null>(null)

const editorMode = ref<'view' | 'reorder'>('view')
// A reorder under way would keep moving rows a read-only widget does not save.
watch(
  () => props.readonly,
  (value) => {
    if (value && editorMode.value === 'reorder') listEditor.value?.cancelReorderMode()
  }
)

// Required by the editor but never called. Adds go through the
// upload and asset-select flow; the editor's add button is hidden.
const createImageStoreItem = (): ImageStoreItem => ({
  key: generateUUIDv1(),
  ...createDamImage({ fileId: '', licenceId: 0 }, {}, { position: 0 }),
  damAuthors: [],
  showDamAuthors: false,
  assetId: undefined,
})

const updateAllPositions = () => {
  let pos = 0
  images.value.forEach((image) => {
    pos++
    image.position = pos
  })
  imageStore.maxPosition = pos
}

const onReorderApplied = () => {
  updateAllPositions()
}

defineExpose({
  saveImages,
})

onMounted(() => {
  imagesLoaded = fetchImagesOnLoad()
})
</script>

<template>
  <div>
    <h4
      v-if="label"
      class="font-weight-bold text-label-large"
    >
      {{ label }}
    </h4>
    <div
      v-if="!readonly"
      class="pb-2"
    >
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
        {{ addFromDamLabel }}
      </VBtn>
    </div>
    <AAssetSelect
      v-model="assetSelectDialog"
      :select-licences="selectLicences"
      :upload-licence="uploadLicence"
      :min-count="1"
      :max-count="50"
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
      <ASortableListEditor
        v-if="imagesReady"
        ref="listEditor"
        v-model="images"
        v-model:mode="editorMode"
        :factory="createImageStoreItem"
        get-key="key"
        position="position"
        :show-add-button="false"
        :show-delete-button="false"
        :show-edit-button="false"
        :disable-drag="disableDraggable || readonly"
        :readonly="readonly"
        @reorder-applied="onReorderApplied"
      >
        <template #view-body>
          <div class="asset-list-tiles asset-list-tiles--thumbnail a-sortable-widget__group">
            <ImageWidgetMultipleItem
              v-for="(image, index) in images"
              :key="image.key"
              :index="index"
              :show-source-enabled="showSourceEnabled"
              :source-label="sourceLabel"
              :edit-asset-label="editAssetLabel"
              :author-enabled="authorEnabled"
              :readonly="readonly"
              :config-name="damConfigName"
              @edit-asset="onEditAsset"
              @remove-item="removeItem"
            />
          </div>
        </template>
        <template #item-compact="{ raw }">
          <div class="image-widget-multiple-reorder">
            <div class="image-widget-multiple-reorder__thumb">
              <AImageWidgetSimple
                :model-value="raw.id"
                :image="raw"
                :config-name="damConfigName"
              />
            </div>
            <div class="image-widget-multiple-reorder__meta">
              <div class="image-widget-multiple-reorder__title">
                {{ raw.texts?.description?.trim() || '—' }}
              </div>
              <div
                v-if="raw.texts?.source"
                class="image-widget-multiple-reorder__source"
              >
                {{ raw.texts.source }}
              </div>
            </div>
          </div>
        </template>
      </ASortableListEditor>
      <AImageDropzone
        v-if="editorMode === 'view' && !readonly"
        variant="fill"
        :hover-only="modelValue.length > 0 || images.length > 0"
        :accept="uploadAccept"
        :max-sizes="uploadSizes"
        @drop="onDrop"
        @click="uploadButtonComponent?.$el.click()"
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
      @apply="onAssetUploadConfirm"
      @files-input="onFileInput"
      @drop="onFileInput"
    />
    <AssetDetailDialog
      v-if="assetDialog === queueKey"
      :queue-key="queueKey"
      :config-name="damConfigName"
      :ext-system="cachedExtSystemId"
      @close="onAssetDetailClose"
    />
    <ImageWidgetMultipleLimitDialog
      ref="limitDialogComponent"
      :queue-key="queueKey"
      @after-add="afterLimitDialogAdd"
    />
  </div>
</template>

<style lang="scss">
.image-widget-multiple-reorder {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  min-height: 100px;
  padding: 4px 0;

  &__thumb {
    flex: 0 0 auto;
    width: 200px;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;

    img {
      width: 100%;
      height: auto;
      display: block;
    }
  }

  &__meta {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__title {
    font-size: 0.95rem;
    font-weight: 500;
    color: rgb(var(--v-theme-on-surface));
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__source {
    font-size: 0.82rem;
    color: rgb(var(--v-theme-on-surface) / 70%);
    margin-top: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (width <= 600px) {
    gap: 8px;
    min-height: 72px;

    &__thumb {
      width: 80px;
    }

    &__source {
      display: none;
    }
  }
}
</style>
