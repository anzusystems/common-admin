<script lang="ts" setup>
import type { DocId, IntegerId } from '@/types/common'
import { computed, inject, onMounted, ref, type ShallowRef, toRaw } from 'vue'
import { isNull, isString, isUndefined } from '@/utils/common'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import ImageWidgetMultipleItem from '@/components/damImage/uploadQueue/components/ImageWidgetMultipleItem.vue'
import { storeToRefs } from 'pinia'
import { useCommonAdminImageOptions } from '@/components/damImage/composables/commonAdminImageOptions'
import { useAlerts } from '@/composables/system/alerts'
import {
  type AssetSearchListItemDto,
  DamAssetType,
  type DamImageCopyToLicenceResponse,
} from '@/types/coreDam/Asset'
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
import { copyToLicence } from '@/components/damImage/uploadQueue/api/damImageApi'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'

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
const { showErrorsDefault, showValidationError, showErrorT } = useAlerts()
const uploadButtonComponent = ref<InstanceType<any> | null>(null)

const { uploadSizes, uploadAccept } = useDamAcceptTypeAndSizeHelper(
  DamAssetType.Image,
  imageWidgetUploadConfig.value.extSystemConfig,
)

const { t } = useI18n()

const imagesLoading = ref(false)

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

const onCopyToLicence = (data: DamImageCopyToLicenceResponse) => {
  if (data.length === 0) return
  const config = imageWidgetUploadConfig.value
  if (isUndefined(config)) return
  cachedExtSystemId.value = config.extSystem
  data.forEach((item) => {
    if (item.result === 'copy') {
      uploadQueuesStore.addByCopyToLicence(props.queueKey, config.extSystem, config.licence, [
        item.targetAsset,
      ])
    } else if (item.result === 'exists') {
      uploadQueuesStore.addByCopyToLicence(props.queueKey, config.extSystem, config.licence, [
        item.targetAsset,
      ])
      uploadQueuesStore.queueItemDuplicate(
        item.targetAsset,
        item.targetMainFile,
        DamAssetType.Image,
      )
    } else {
      showErrorT('damImage.queueItem.errorUnableToCopyToLicence')
      return
    }
  })
  uploadQueueDialog.value = props.queueKey
}

const afterLimitDialogAdd = () => {
  uploadQueueDialog.value = props.queueKey
}

const assetSelectConfirmMap = async (
  items: AssetSearchListItemDto[],
): Promise<ImageStoreItem[]> => {
  const assetSelectStore = useAssetSelectStore()
  const ids = items.map((item) => item.id)
  const assetMetadataMap = new Map<DocId, { description: string; authorIds: DocId[] }>()
  const authorIdsToFetch = new Set<DocId>()
  const authorsMap = new Map<DocId, string>()
  try {
    const assetDetails = await fetchAssetListByIds(
      damClient,
      endPointAsset,
      ids,
      assetSelectStore.selectedLicenceId,
    )
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
  if (!isUndefined(data.copyToLicence)) {
    try {
      const copyRes = await copyToLicence(
        damClient,
        endPointAsset,
        data.value
          .filter((asset) => !isNull(asset.mainFile))
          .map((asset) => ({ asset: asset.id, targetAssetLicence: data.copyToLicence! })),
      )
      onCopyToLicence(copyRes)
    } catch (e) {
      showErrorsDefault(e)
    }
    return
  }
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
    const resItems = await imageApi.bulkUpdateImages(imageClient, imagesRaw)
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
    if (imageStore.images.length === 0) return true

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
  }
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
    <div
      class="position-relative w-100"
      style="min-height: 140px"
    >
      <ASortableListEditor
        v-model="images"
        v-model:mode="editorMode"
        key-field="key"
        position-field="position"
        update-position
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
              :total-count="images.length"
              :disable-draggable="disableDraggable"
              :show-source-enabled="showSourceEnabled"
              :source-label="sourceLabel"
              :edit-asset-label="editAssetLabel"
              :author-enabled="authorEnabled"
              @edit-asset="onEditAsset"
              @remove-item="removeItem"
              @move-up="(i) => moveImagePositions(i, i - 1)"
              @move-down="(i) => moveImagePositions(i, i + 1)"
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
