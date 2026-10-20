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
// One store for every widget: whatever the previous one left is not this entity's.
imageStore.reset()
watch(
  () => props.readonly,
  (value) => {
    imageStore.readonly = value
  },
  { immediate: true }
)
const { images, maxPosition } = storeToRefs(imageStore)

// The widget among the widgets of the page that save images (`imageSaves.ts`), and the marks of its own saves on
// their way.
const thisWidget = Symbol('image widget multiple')
const ownImageSaves = new Set<symbol>()
// The wait of the rows for saves of their images by other widgets: let go once the widget goes.
let cancelSaveWaits: (() => void) | null = null

/**
 * Once no other widget of the page has a save of any of the images `ids` on its way (the widget this one was drawn in
 * place of, its save still on its way), or once the wait has run out: then the user is told the request timed out.
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

// The load of the images of the entity: rows added while it is on its way (a pick, an upload) wait for it, and come
// after the images it loads. Added before, the load put its images in their place, and they were gone without a word.
let imagesLoaded: Promise<void> = Promise.resolve()

const fetchImagesOnLoad = async () => {
  if (props.modelValue.length === 0) {
    return
  }
  try {
    imagesLoading.value = true
    // Counted as the read is sent: a save answered after that may have taken effect only after the read.
    const readAt = holdImages(damConfigName, thisWidget, props.modelValue)
    const read = await imageApi.fetchImageListByIds(imageClient, props.modelValue)
    // The rows come once the saves of these images by other widgets are over, each image as the save answered last
    // left it when one has answered since the read was sent. Read before such a save took effect, a row had the old
    // texts, and the save of this widget wrote them back over the saved ones.
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
      // Read-only shows the images without their DAM authors: a user refused the upload is often refused the assets.
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
          // Each row its own copy: the rows of one asset (an image twice in the entity) shared the array.
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
  // The input has turned every file away, and said so: the queue dialog would open over nothing new.
  if (files.length === 0) return
  const config = imageWidgetUploadConfig.value
  if (isUndefined(config)) return
  cachedExtSystemId.value = config.extSystem
  // The queue dialog is opened by `afterLimitDialogAdd`, once files are queued: over the limit none is, until the
  // user agrees to the first of them. The rows a queue no dialog names holds are not counted: they go first.
  stopQueueLeftBehind(props.queueKey)
  limitDialogComponent.value?.check(files)
}

const onDrop = (files: File[]) => {
  if (props.readonly) return
  // As the input: the dropzone has turned every file away, and said so.
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
 * The images of picked assets, without their position. Each asset is read under the licence it is in, and its authors
 * under the ext system of that licence: what was picked outlives a change of the licence browsed, and under another
 * licence the DAM leaves an asset out of its answer without a word. `readUnder`: the licence all of the assets are in
 * and its ext system, where the caller knows them.
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
  // A licence that cannot be read does not keep the others from being read.
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
        // Under the ext system of the licence, as every name of the authors of the DAM the widgets write; that of
        // the picker where the licence does not tell.
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
  // Said once, however many of them failed. A read the DAM refuses comes as the bare error of axios, which the
  // default says nothing of.
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
      // Only for an asset that was read: of one that was not, nobody knows whether it has authors, and those picked
      // in its row would replace them in the DAM. Its row has the source, as one whose asset was not returned at load.
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
  // Copied: the picked assets of another licence than the one of the upload. One already in it is taken as it is, at
  // once; the copies come in once the dialog of the queue is used.
  const toCopy =
    copyToLicenceEnabled !== false && !isUndefined(data.copyToLicence)
      ? picked.filter((asset) => asset.licence !== data.copyToLicence)
      : []
  // A widget that is gone by the answer adds nothing: the store of the images is the next widget's by then. Nor one
  // that has turned read-only meanwhile.
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
  // Read while the copy runs, under the licence they are in, the one of the upload, and its ext system: not the one
  // browsed. They are added before the dialog of the queue opens: used before they were read, it put the copies
  // before them.
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

// Whether the detail was opened by "edit asset" of a row, until it closes. Not so the detail a row of the queue
// dialog opens, which is drawn here as well: nothing is read when that one closes.
let detailOfRow = false
// The reads of assets whose detail has closed, those of one asset in a row, by that asset: the save of the widget waits
// for them. The reads of another asset do not wait for these: closing the detail of one asset waited for the save of
// the detail of another one, and the read after it.
const detailAssetReads = new Map<DocId, Promise<void>>()
// Such a read may end once the widget is gone, and the images in the store are the next widget's by then.
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
        // A licence the client cannot resolve: the ext system of the widget's upload licence, which its root loaded.
        const shownUnder = (await getExtSystemByLicence(asset.licence)) ?? imageWidgetUploadConfig.value!.extSystem
        // Before the detail shows the asset: it reads the configuration of its ext system as it draws, and threw
        // without it.
        await loadAssetDetailExtSystem(damClient, shownUnder, asset.attributes.assetType, damConfigName)
        extSystem = shownUnder
        return asset
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

// An upload applied while the images of the entity load waits for them, its dialog and its queue as they are: once
// those images are there, its rows come after them and the dialog goes. A widget that is read-only or gone by then
// leaves the dialog and its queue as a read-only widget does, and nothing of the upload is lost; the dialog went at
// once, and the rows with it. Applied again while it waits, it is not taken: the rows would come twice.
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
  // A file that is a duplicate of one the widget has becomes the asset of that image in the queue, and the dialog has
  // just saved its authors. The rows of that asset that offer the pick take them with their names (the source of the
  // upload), as after its detail has closed: left as they were, what is picked in them would be written over those
  // authors. Their names go into the source of a row only where it has none of its own, as there; it took them always.
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
 * The names of the authors of an asset, in its order, under the ext system of its licence; `pageExtSystem` where its
 * licence does not tell.
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
 * A row that offers the pick of the authors of the DAM, once its asset turns out to have authors: it takes them, the
 * pick goes, and the row shows its source from then on. That source takes their names where it is empty, or is what a
 * pick of authors wrote there ("fill empty" of the mass operations), which the row did not show. A source of the
 * image's own (stored, given by an upload, typed while the row showed it) stays, to be checked by the user.
 */
const takeAuthorsGiven = (row: ImageStoreItem, authors: DocId[], names: string) => {
  row.damAuthors = [...authors]
  if (row.texts.source.trim().length === 0 || imageStore.hasSourceOfPick(row)) row.texts.source = names
  imageStore.forgetSourceOfPick(row)
  row.showDamAuthors = false
}

/**
 * The detail may have given authors to an asset whose row offers the pick of them. Left as it was, the row would write
 * what is picked in it over those authors with the save of the widget, and with nothing picked its image would be
 * saved without a source. So the asset is read again, and once it has authors its rows that offer the pick take them
 * over what was picked there, as a row of an asset picked with its authors has them: named in its source, under the
 * ext system of the licence of the asset, but for a source of the image's own (`takeAuthorsGiven`). A row that shows
 * its source is left alone: that text is the user's. `detailSave`: the save of the detail that was on its way when it
 * closed. `pageExtSystem`: the ext system its configuration asked for names under by then.
 */
const takeAuthorsOfDetailAsset = async (assetId: DocId, detailSave: Promise<void> | null, pageExtSystem: IntegerId) => {
  try {
    // Read before the DAM has answered that save, the asset would be as it was before it.
    await detailSave
    const asset = await fetchAsset(damClient, endPointAsset, assetId)
    if (asset.authors.length === 0) return
    const source = await authorNamesOf(asset, pageExtSystem)
    // The widget is gone, or has turned read-only meanwhile: nothing is written.
    if (unmounted || props.readonly) return
    images.value.forEach((image) => {
      // By the row's own flag. Whether the page draws the pick goes by an ext system that the detail of another asset,
      // opened meanwhile, may have changed.
      if (image.assetId !== asset.id || !image.showDamAuthors) return
      takeAuthorsGiven(image, asset.authors, source)
    })
  } catch (e) {
    if (!unmounted && !showErrorsDefault(e)) showUnknownError()
  }
}

/**
 * `shown`: the asset the detail showed; none when it closed from its loader, or by itself after a read that failed.
 * What the read goes by is noted here, before anything is awaited: whether a row of that asset offers the pick, the
 * save of the detail that is on its way, and the ext system its configuration asks for names under.
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
  // Nothing of the user's to write; the images stay as they were loaded.
  if (props.readonly) return true
  // Empty store here means the fetch is pending or failed, not a user deletion — the empty
  // path below would detach every image.
  if (imagesLoading.value || imagesLoadFailed.value) {
    showUnknownError()
    return false
  }
  // The asset of a detail that has just closed is still being read: its rows are not written before they have its
  // authors. Gone by then, the widget writes nothing.
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
    // The rows that offer the pick of the authors, those of one asset together: the entity may have an image twice,
    // and a duplicate from the queue is a second row of its asset. Each row on its own, the authors of an asset went
    // out once per row that had some, the last to stay, and a row with none picked was saved without a source and
    // went on offering the pick of authors the asset had by then. The asset gets what is picked in any of its rows,
    // each author once, and each of those rows the authors and their names, once the DAM has taken them.
    const offering = new Map<DocId, { assetId: DocId | undefined; rows: ImageStoreItem[]; authors: DocId[] }>()
    if (authorEnabled.value) {
      images.value.forEach((image) => {
        if (!image.showDamAuthors) return
        // A row that offers the pick has its asset; one that had none would be on its own.
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
      // Under the ext system of the licence of the asset of the rows, as the read before the write names authors
      // given since; that its configuration asks for names under where the page does not know the licence. Not read
      // for it: the rows come of the entity, of any licence.
      const extSystem =
        damConfigStore.damConfigLicenceExtSystem.get(rows[0]!.dam.licenceId)?.extSystem ?? cachedExtSystemId.value
      const authorsRes = await fetchAuthorListByIds(damClient, endPointAuthor, extSystem, authors)
      named.push({ assetId, rows, authors, source: authorsRes.map((author) => author.name).join(', ') })
    }
    // Gone while the authors loaded, the widget writes nothing. Turned read-only meanwhile: nothing of the user's is
    // written any more.
    if (unmounted) return false
    if (props.readonly) return true
    // An asset was read when its rows came, and may have been given authors elsewhere since: the write replaces them
    // with those picked in its rows. Each asset with something picked is read again, right before the write. Once one
    // has authors nothing is written, of any asset or image: the rows of that asset that offer the pick take them
    // (`takeAuthorsGiven`), the user is told till they close the message, and saves again.
    const picked = [...offering.values()].filter(({ assetId, authors }) => !isUndefined(assetId) && authors.length > 0)
    if (picked.length > 0) {
      const readAgain = await Promise.all(picked.map(({ assetId }) => fetchAsset(damClient, endPointAsset, assetId!)))
      // Gone, or turned read-only while the assets were read: nothing of the user's is written any more.
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
      // Gone while the authors were written, the widget saves no image: a widget drawn meanwhile, of the same images,
      // read them before this save, and it was noted only once sent.
      if (unmounted) return false
    }
    // The DAM has the authors of those rows by now, also when the images are not saved: the rows show the source from
    // here on, as after a save. Left offering the pick, the rows went into the next save as picks, the read before the
    // write found the authors written here, and that save wrote nothing.
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
    // Noted for the other widgets of the page, image by image, also when this one is gone by its answer.
    const resItems = await noteImagesSave(
      damConfigName,
      sentRows.map((row) => row.id).filter((id) => !isUndefined(id)),
      ownImageSaves,
      imageApi.bulkUpdateImages(imageClient, sentRows.map(imageFieldsOf))
    )
    // Gone by the answer, the widget writes nothing into the store of the images, which is the next widget's by then.
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
      // Emptying is a change too — without this the parent kept its old ids.
      emit('update:modelValue', ids)
      return true
    }

    // Each image of the answer takes what its own row had, the rows of one file one by one in the order they were
    // sent in: found by the file alone, every row of a file took what the first of them had.
    const getUpdatedItem = (item: ImageStoreItem): ImageStoreItem => {
      const index = sentRows.findIndex((row) => row.dam.damId === item.dam.damId)
      const matchedImage = index < 0 ? undefined : sentRows.splice(index, 1)[0]

      return {
        ...item,
        damAuthors: matchedImage ? matchedImage.damAuthors : item.damAuthors,
        // Only a row that offered the authors of the DAM goes on offering them: one whose asset the DAM did not
        // return has no asset to save them into, and keeps its source.
        showDamAuthors: matchedImage ? matchedImage.showDamAuthors && matchedImage.damAuthors.length === 0 : false,
        assetId: matchedImage ? matchedImage.assetId : item.assetId,
      }
    }

    const updatedItems = items.map(getUpdatedItem)
    imageStore.setImages(updatedItems)
    // Rows passed explicitly: setImages just replaced their keys, bare commit() would read the
    // not-yet-rerendered prop.
    listEditor.value?.commit(updatedItems)
    emit('update:modelValue', ids)
    return true
  } catch (e) {
    // The authors refused by validation are named as the forms name them; anything else as before.
    showMetadataSaveError(e, cachedExtSystemId.value, damConfigName)
    return false
  }
}

// The images that stay are numbered anew, as after a move: the backend got positions with a gap where one went.
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

// Required by the editor, but never invoked here — adds happen through the
// upload / asset-select flow, not the editor's add button (which is hidden).
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
