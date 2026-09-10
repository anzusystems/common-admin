<script lang="ts" setup>
import type { DocId, IntegerId } from '@/types/common'
import { computed, inject, onMounted, ref, type ShallowRef, toRaw } from 'vue'
import { isDefined, isNull, isString, isUndefined } from '@/utils/common'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import ImageWidgetMultipleItem from '@/components/damImage/uploadQueue/components/ImageWidgetMultipleItem.vue'
import { storeToRefs } from 'pinia'
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
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import AImageWidgetSimple from '@/components/damImage/AImageWidgetSimple.vue'
import { fetchAuthorListByIds } from '@/components/damImage/uploadQueue/api/authorApi'
import { useI18n } from 'vue-i18n'
import useVuelidate from '@vuelidate/core'
import { AImageMetadataValidationScopeSymbol } from '@/components/damImage/uploadQueue/composables/uploadValidations'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import ImageWidgetMultipleLimitDialog from '@/components/damImage/uploadQueue/components/ImageWidgetMultipleLimitDialog.vue'
import { ImageWidgetUploadConfig } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import { fetchAssetListByFileIdsMultipleLicences } from '@/components/damImage/uploadQueue/api/damfetchAssetListByFileIdsMultipleLicences'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import type { BulkUpdateImageFailure } from '@/components/damImage/uploadQueue/api/imageApiCms'

const props = withDefaults(
  defineProps<{
    modelValue: IntegerId[]
    queueKey: UploadQueueKey
    uploadLicence: IntegerId
    selectLicences: IntegerId[]
    listViews?: IntegerId[]
    singleUseAllowed?: boolean
    ownerDocId?: DocId | null
    ownerGalleryId?: IntegerId | null
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
    listViews: () => [],
    singleUseAllowed: false,
    ownerDocId: null,
    ownerGalleryId: null,
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
    skipCurrentUserCheck: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', data: IntegerId[]): void
}>()

const assetSelectDialog = ref(false)

const imageWidgetUploadConfig = inject<
  ShallowRef<DamConfigLicenceExtSystemReturnType | undefined> | undefined
>(ImageWidgetUploadConfig, undefined)

if (isUndefined(imageWidgetUploadConfig) || isUndefined(imageWidgetUploadConfig.value)) {
  throw new Error(
    "Fatal error, parent component doesn't provide necessary config ext system config.",
  )
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imageOptions = useCommonAdminImageOptions(props.configName)
const { imageClient, imageApi } = imageOptions
const { showErrorsDefault, showValidationError, showErrorT, showUnknownError, showRecordWas } =
  useAlerts()
const uploadButtonComponent = ref<InstanceType<any> | null>(null)

const { uploadSizes, uploadAccept } = useDamAcceptTypeAndSizeHelper(
  DamAssetType.Image,
  imageWidgetUploadConfig.value.extSystemConfig,
)

const { t } = useI18n()

const imagesLoading = ref(false)
const imagesLoadFailed = ref(false)

// Editor must not mount before the fetch lands: its dirty baseline is captured once, so rows
// arriving later would read as "added". One-shot, like the fetch.
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imagesReady = ref(props.modelValue.length === 0)

const listEditor = ref<{ commit: (rows?: ImageStoreItem[]) => void } | null>(null)

const imageStore = useImageStore()
const { images, maxPosition } = storeToRefs(imageStore)

const fetchImagesOnLoad = async () => {
  if (props.modelValue.length === 0) {
    return
  }
  try {
    imagesLoading.value = true
    const imagesRes = (await imageApi.fetchImageListByIds(imageClient, props.modelValue)).sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    )
    const groupedIds: IdsGroupedByLicences = new Map()
    imagesRes.forEach((image) => {
      const group = groupedIds.get(image.dam.licenceId)
      if (group) {
        group.push(image.dam.damId)
      } else {
        groupedIds.set(image.dam.licenceId, [image.dam.damId])
      }
    })

    const assetsRes = await fetchAssetListByFileIdsMultipleLicences(
      damClient,
      endPointAsset,
      groupedIds,
    )

    imageStore.setImages(
      imagesRes.map((imageRes) => {
        if (isUndefined(imageRes.position)) throw new Error('Image object needs position field!')
        imageStore.updateMaxPositionIfGreater(imageRes.position)
        const found = assetsRes.find((asset) => asset.mainFile?.id === imageRes.dam.damId)
        return {
          key: generateUUIDv1(),
          ...imageRes,
          damAuthors: found ? found.authors : [],
          showDamAuthors: found ? found.authors.length === 0 : false,
          assetId: found ? found.id : undefined,
        }
      }),
    )
    emit(
      'update:modelValue',
      images.value.map((image) => image.id).filter((id) => id !== undefined) as IntegerId[],
    )
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

const { cachedExtSystemId } = useExtSystemIdForCached()

const { uploadQueueDialog } = useUploadQueueDialog()

const onFileInput = (files: File[]) => {
  const config = imageWidgetUploadConfig.value
  if (isUndefined(config)) return
  cachedExtSystemId.value = config.extSystem
  limitDialogComponent.value?.check(files)
  uploadQueueDialog.value = props.queueKey
}

const onDrop = (files: File[]) => {
  const config = imageWidgetUploadConfig.value
  if (isUndefined(config)) return
  cachedExtSystemId.value = config.extSystem
  limitDialogComponent.value?.check(files)
  uploadQueueDialog.value = props.queueKey
}

const afterLimitDialogAdd = () => {
  uploadQueueDialog.value = props.queueKey
}

const assetSelectConfirmMap = async (
  items: AssetSearchListItemDto[],
): Promise<ImageStoreItem[]> => {
  const assetSelectStore = useAssetSelectStore()
  const assetMetadataMap = new Map<DocId, { description: string; authorIds: DocId[] }>()
  const authorIdsToFetch = new Set<DocId>()
  const authorsMap = new Map<DocId, string>()
  try {
    // A selection may span several licences while the endpoint scopes by exactly one, so details are
    // fetched per licence of the picked item rather than for one licence of the whole selection.
    const idsByLicence = new Map<IntegerId, DocId[]>()
    items.forEach((item) => {
      const licenceIds = idsByLicence.get(item.licence) ?? []
      licenceIds.push(item.id)
      idsByLicence.set(item.licence, licenceIds)
    })

    const assetDetails = (
      await Promise.all(
        [...idsByLicence].map(([licenceId, licenceIds]) =>
          fetchAssetListByIds(damClient, endPointAsset, licenceIds, licenceId),
        ),
      )
    ).flat()
    if (customAssetSelectMetadataToImageMap) {
      assetDetails.forEach((assetDetail) => {
        const mapped = customAssetSelectMetadataToImageMap(assetDetail)
        assetMetadataMap.set(assetDetail.id, {
          description: mapped.description,
          authorIds: [],
        })
        authorsMap.set(assetDetail.id, mapped.source)
      })
    } else {
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
        // One ext system for the whole selection is a picker invariant (licences of a mixed listing must
        // share it), so any selected licence resolves the same author namespace.
        const authorsRes = await fetchAuthorListByIds(
          damClient,
          assetSelectStore.selectedSelectConfig.extSystem,
          [...authorIdsToFetch],
        )
        authorsRes.forEach((author) => {
          authorsMap.set(author.id, author.name)
        })
      }
    }
  } catch (e) {
    showErrorsDefault(e)
  }

  return items.map((asset) => {
    maxPosition.value++
    const authorIds = assetMetadataMap.get(asset.id)?.authorIds || []
    const description = assetMetadataMap.get(asset.id)?.description ?? ''

    if (customAssetSelectMetadataToImageMap) {
      return {
        key: generateUUIDv1(),
        texts: {
          description: description,
          source: authorsMap.get(asset.id) ?? '',
        },
        flags: {
          showSource: true,
          internal: false,
          overrideInternal: false,
        },
        dam: {
          damId: asset.mainFile!.id,
          regionPosition: 0,
          licenceId: asset.licence,
          internal: asset.mainFileInternal ?? false,
          uploadLicenceId: props.uploadLicence,
        },
        position: maxPosition.value,
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
      texts: {
        description: description,
        source: authorNames.join(', '),
      },
      flags: {
        showSource: true,
        internal: false,
        overrideInternal: false,
      },
      dam: {
        damId: asset.mainFile!.id,
        regionPosition: 0,
        licenceId: asset.licence,
        internal: asset.mainFileInternal ?? false,
        uploadLicenceId: props.uploadLicence,
      },
      position: maxPosition.value,
      damAuthors: authorIds,
      showDamAuthors: authorIds.length === 0,
      assetId: asset.id,
    }
  })
}

const onAssetSelectConfirm = async (data: AssetSelectReturnData) => {
  if (data.type !== 'asset' || data.value.length === 0) return
  const items = await assetSelectConfirmMap(data.value.filter((asset) => !isNull(asset.mainFile)))
  imageStore.addImages(items)
}

const assetDetailStore = useAssetDetailStore()
const { loading: assetLoading, dialog: assetDialog } = storeToRefs(assetDetailStore)
const {
  damClient,
  endPointAsset,
  showSourceEnabled,
  sourceLabel,
  editAssetLabel,
  addFromDamLabel,
  customAssetSelectMetadataToImageMap,
} = useCommonAdminCoreDamOptions()

const onEditAsset = async (assetFileId: DocId) => {
  assetLoading.value = true
  assetDialog.value = props.queueKey
  try {
    const asset = await fetchAssetByFileId(damClient, endPointAsset, assetFileId)
    const extSystem = await getExtSystemByLicence(asset.licence)
    if (extSystem) {
      cachedExtSystemId.value = extSystem
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
    }),
  )
  uploadQueueDialog.value = null
  uploadQueuesStore.stopUpload(props.queueKey)
}

const actionLibrary = () => {
  assetSelectDialog.value = true
}

const v$ = useVuelidate({ $scope: AImageMetadataValidationScopeSymbol })

const { getDamConfigExtSystem, getExtSystemByLicence } = useDamConfigState(damClient)

const authorEnabled = computed(() => {
  return !!getDamConfigExtSystem(cachedExtSystemId.value)?.[DamAssetType.Image]?.authors?.enabled
})

const failedImages = ref<BulkUpdateImageFailure[]>([])

// A failed PUT chunk is atomic, so it reports every image in it — but only the one the error body
// names is to blame. Dropping the whole chunk would detach up to 19 saveable images, so removal is
// offered for the named ones only; the rest is simply re-sent by the next save.
const failedCulprits = computed(() =>
  failedImages.value.filter((failure) => isDefined(failure.errorInfo)),
)

const failedUnidentified = computed(() =>
  failedImages.value.filter((failure) => isUndefined(failure.errorInfo)),
)

const saveImages = async () => {
  // Empty store here means the fetch is pending or failed, not a user deletion — the empty
  // path below would detach every image.
  if (imagesLoading.value || imagesLoadFailed.value) {
    showUnknownError()
    return false
  }
  v$.value.$touch()
  if (v$.value.$invalid) {
    showValidationError()
    return false
  }
  failedImages.value = []
  try {
    const assetUpdateItems: AssetAuthorsItems = []
    const imagesRaw = toRaw(images.value)
    for (const image of imagesRaw) {
      if (authorEnabled.value && image.showDamAuthors && image.assetId) {
        assetUpdateItems.push({ id: image.assetId, authors: image.damAuthors })
      }
      if (authorEnabled.value && image.showDamAuthors && image.damAuthors.length > 0) {
        const authorsRes = await fetchAuthorListByIds(
          damClient,
          cachedExtSystemId.value,
          image.damAuthors,
        )
        image.texts.source = authorsRes.map((author) => author.name).join(', ')
      }
    }
    if (assetUpdateItems.length) {
      await bulkUpdateAssetsAuthors(damClient, endPointAsset, assetUpdateItems)
    }
    const { images: resItems, failed } = await imageApi.bulkUpdateImages(imageClient, imagesRaw)
    // Partial failures are surfaced, never applied silently (Q11) — the user either removes the
    // offending images or explicitly confirms "save without N", which retries with them dropped.
    if (failed.length > 0) {
      failedImages.value = failed
      showErrorT('common.damImage.image.bulkSave.partialFailure')
      return false
    }
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

    const getUpdatedItem = async (item: ImageStoreItem): Promise<ImageStoreItem> => {
      const matchedImage = imageStore.images.find(
        (storeItem) => storeItem.dam.damId === item.dam.damId,
      )

      return {
        ...item,
        damAuthors: matchedImage ? matchedImage.damAuthors : item.damAuthors,
        showDamAuthors: matchedImage
          ? matchedImage.damAuthors.length === 0
          : item.damAuthors.length === 0,
        assetId: item.assetId,
      }
    }

    const updatedItems = await Promise.all(items.map((item) => getUpdatedItem(item)))
    imageStore.setImages(updatedItems)
    // Rows passed explicitly: setImages just replaced their keys, bare commit() would read the
    // not-yet-rerendered prop.
    listEditor.value?.commit(updatedItems)
    emit('update:modelValue', ids)
    return true
  } catch (e) {
    // showErrorsDefault reports nothing for non-Anzu errors; its boolean return is for this fallback.
    if (!showErrorsDefault(e)) showUnknownError()
    return false
  }
}

const onSaveWithoutFailed = async () => {
  if (failedCulprits.value.length === 0) return
  const culpritDamIds = new Set(failedCulprits.value.map((failure) => failure.item.dam.damId))
  const remaining = imageStore.images.filter((image) => !culpritDamIds.has(image.dam.damId))
  imageStore.setImages(remaining)
  listEditor.value?.commit(remaining)
  failedImages.value = []
  const saved = await saveImages()
  if (saved) showRecordWas('updated')
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
      await imageApi.deleteImage(imageClient, image.id)
      imageStore.removeImageByIndex(index)
    } catch (e) {
      showErrorsDefault(e)
    }
    return
  }
  imageStore.removeImageByIndex(index)
}

const limitDialogComponent = ref<InstanceType<typeof ImageWidgetMultipleLimitDialog> | null>(null)

const editorMode = ref<'view' | 'reorder'>('view')

// Required by the editor, but never invoked here — adds happen through the
// upload / asset-select flow, not the editor's add button (which is hidden).
const createImageStoreItem = (): ImageStoreItem => ({
  key: generateUUIDv1(),
  texts: { description: '', source: '' },
  dam: { damId: '', licenceId: 0, regionPosition: 0, internal: false },
  flags: { showSource: true, internal: false, overrideInternal: false },
  position: 0,
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
  fetchImagesOnLoad()
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
        {{ addFromDamLabel }}
      </VBtn>
    </div>
    <AAssetSelect
      v-model="assetSelectDialog"
      :select-licences="selectLicences"
      :upload-licence="uploadLicence"
      :list-views="listViews"
      :single-use-allowed="singleUseAllowed"
      :owner-doc-id="ownerDocId"
      :owner-gallery-id="ownerGalleryId"
      :min-count="1"
      :max-count="50"
      :asset-type="DamAssetType.Image"
      :skip-current-user-check="skipCurrentUserCheck"
      :config-name="configName"
      return-type="asset"
      @on-confirm="onAssetSelectConfirm"
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
    <VAlert
      v-if="failedImages.length > 0"
      type="error"
      variant="tonal"
      class="mb-2"
    >
      <div class="mb-2">
        {{ t('common.damImage.image.bulkSave.partialFailure') }}
      </div>
      <ul
        v-if="failedCulprits.length > 0"
        class="mb-2"
      >
        <li
          v-for="failure in failedCulprits"
          :key="failure.item.dam.damId"
        >
          {{ failure.item.dam.damId }}
          <template v-if="failure.errorInfo?.code === 'image_take_over_failed'">
            — {{ t('common.damImage.image.error.takeOverFailed') }}
          </template>
          <template v-else-if="failure.errorInfo?.code === 'image_single_use_violation'">
            — {{ t('common.damImage.image.error.singleUseViolation') }}
          </template>
        </li>
      </ul>
      <div
        v-if="failedUnidentified.length > 0"
        class="mb-2"
      >
        {{
          t(
            'common.damImage.image.bulkSave.unidentifiedFailure',
            { count: failedUnidentified.length },
            failedUnidentified.length,
          )
        }}
      </div>
      <VBtn
        v-if="failedCulprits.length > 0"
        @click="onSaveWithoutFailed"
      >
        {{
          t(
            'common.damImage.image.bulkSave.saveWithoutFailed',
            { count: failedCulprits.length },
            failedCulprits.length,
          )
        }}
      </VBtn>
    </VAlert>
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
        :disable-drag="disableDraggable"
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
        v-if="editorMode === 'view'"
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
      :upload-licence="uploadLicence"
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
