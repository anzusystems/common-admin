<script lang="ts" setup>
import AImageDropzone from '@/components/file/AFileDropzone.vue'
import type { DocId, IntegerId, IntegerIdNullable } from '@/types/common'
import type { ImageAware, ImageCreateUpdateAware } from '@/types/ImageAware'
import imagePlaceholderPath from '@/assets/image/placeholder16x9.jpg'
import { useCommonAdminImageOptions } from '@/components/damImage/composables/commonAdminImageOptions'
import { useImageActions } from '@/components/damImage/composables/imageActions'
import { cloneDeep, isDefined, isNull, isNumber, isString, isUndefined } from '@/utils/common'
import { useAlerts } from '@/composables/system/alerts'
import { DamAssetType } from '@/types/coreDam/Asset'
import { useDamAcceptTypeAndSizeHelper } from '@/components/damImage/uploadQueue/composables/acceptTypeAndSizeHelper'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import AAssetSelect from '@/components/dam/assetSelect/AAssetSelect.vue'
import type { AssetSelectReturnData } from '@/types/coreDam/AssetSelect'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import { createImage, deleteImage, fetchImage, updateImage } from '@/components/damImage/uploadQueue/api/imageApi'
import ImageDetailDialogMetadata from '@/components/damImage/uploadQueue/components/ImageDetailDialogMetadata.vue'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import { computed, inject, ref, type ShallowRef, toRaw, watch } from 'vue'
import AssetDetailDialog from '@/components/damImage/uploadQueue/components/AssetDetailDialog.vue'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { storeToRefs } from 'pinia'
import { fetchAsset, fetchAssetByFileId } from '@/components/damImage/uploadQueue/api/damAssetApi'
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
  }>(),
  {
    configName: 'default',
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
  }
)

const emit = defineEmits<{
  (e: 'afterMetadataSaveSuccess'): void
}>()

const modelValue = defineModel<IntegerIdNullable>({ required: true })

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
  // addCollabFieldDataChangeListener((data: CollabFieldDataEnvelope) => {
  //   modelValue.value = data.value as IntegerIdNullable
  //   reload(undefined, modelValue.value)
  // })
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

const { showErrorsDefault, showError } = useAlerts()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imageOptions = useCommonAdminImageOptions(props.configName)
const { imageClient } = imageOptions
const { widgetImageToDamImageUrl } = useImageActions(imageOptions)
const uploadQueuesStore = useUploadQueuesStore()
const imageStore = useImageStore()
const { uploadQueueDialog } = useUploadQueueDialog()

const resImage = ref<null | ImageCreateUpdateAware>(null)
const clickMenuOpened = ref(false)
const assetSelectDialog = ref(false)
const metadataDialog = ref(false)
const metadataDialogSaving = ref(false)
const metadataDialogLoading = ref(false)
const fileInputDialog = ref(false)

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

const actionEditMeta = () => {
  imageStore.setImageDetail(toRaw(resImage.value))
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

const reload = async (newImage: ImageCreateUpdateAware | undefined, newImageId: IntegerIdNullable, force = false) => {
  resolvedSrc.value = imagePlaceholderPath
  if ((newImage && isNull(resImage.value)) || (newImage && force)) {
    resImage.value = cloneDeep(newImage)
    if (resImage.value) {
      if (isNumber(props.damWidth) && isNumber(props.damHeight)) {
        resolvedSrc.value = widgetImageToDamImageUrl(toRaw(resImage.value), props.damWidth, props.damHeight)
      } else {
        resolvedSrc.value = widgetImageToDamImageUrl(toRaw(resImage.value))
      }
      if (props.expandMetadata) {
        imageStore.setImageDetail(toRaw(resImage.value))
      }
    }
    return
  }
  if (newImageId) {
    try {
      resImage.value = await fetchImage(imageClient, newImageId)
    } catch (error) {
      showErrorsDefault(error)
    }
    if (!isNull(resImage.value)) {
      if (isNumber(props.damWidth) && isNumber(props.damHeight)) {
        resolvedSrc.value = widgetImageToDamImageUrl(toRaw(resImage.value), props.damWidth, props.damHeight)
      } else {
        resolvedSrc.value = widgetImageToDamImageUrl(toRaw(resImage.value))
      }
      if (props.expandMetadata) {
        imageStore.setImageDetail(toRaw(resImage.value))
      }
    }
    return
  }
  resImage.value = null
}

const reset = () => {
  resolvedSrc.value = imagePlaceholderPath
  resImage.value = null
  modelValue.value = null
  releaseFieldLock.value(null)
}

watch(
  [() => props.image, modelValue],
  async ([newImage, newImageId]) => {
    await reload(newImage, newImageId)
  },
  { immediate: true }
)

const onAssetSelectConfirm = async (data: AssetSelectReturnData) => {
  const assetSelectStore = useAssetSelectStore()
  metadataDialogLoading.value = true
  imageStore.setImageDetail(null)
  metadataDialog.value = true
  let description = ''
  let source = ''
  if (data.type === 'asset') {
    if (!data.value[0] || !data.value[0].mainFile) return
    try {
      const assetRes = await fetchAsset(damClient, data.value[0].id)
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
      }
    } catch (e) {
      showErrorsDefault(e)
    }
    const image: ImageCreateUpdateAware = {
      texts: {
        description: description,
        source: source,
      },
      dam: {
        damId: data.value[0].mainFile.id,
        regionPosition: 0,
        licenceId: data.value[0].licence,
      },
      position: 1,
    }
    if (!isNull(modelValue.value)) {
      image.id = modelValue.value
    }
    imageStore.setImageDetail(image)
    metadataDialogLoading.value = false
    forceReloadViewWithExpandMetadata()
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

const onMetadataDialogClose = () => {
  imageStore.setImageDetail(null)
  metadataDialog.value = false
}

const onMetadataDialogConfirm = async () => {
  if (isNull(imageStore.imageDetail)) return
  metadataDialogSaving.value = true
  try {
    const res = imageStore.imageDetail.id
      ? await updateImage(imageClient, imageStore.imageDetail.id, imageStore.imageDetail)
      : await createImage(imageClient, imageStore.imageDetail)
    metadataDialog.value = false
    modelValue.value = res.id
    imageStore.setImageDetail(null)
    await reload(res, res.id, true)
    emit('afterMetadataSaveSuccess')
    releaseFieldLock.value(res.id)
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    metadataDialogSaving.value = false
  }
}

const onImageDelete = async () => {
  if (isNull(modelValue.value)) return
  if (props.callDeleteApiOnRemove) {
    try {
      await deleteImage(imageClient, modelValue.value)
      reset()
    } catch (e) {
      showErrorsDefault(e)
    }
    return
  }
  reset()
}

const forceReloadViewWithExpandMetadata = () => {
  const detail = imageStore.imageDetail
  if (!isNull(detail)) {
    reload(detail, null, true)
  }
}

const onAssetUploadConfirm = (items: ImageCreateUpdateAware[]) => {
  if (!items[0]) return

  if (!isNull(modelValue.value)) {
    items[0].id = modelValue.value
  }
  imageStore.setImageDetail(items[0])
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

watch(
  clickMenuOpened,
  (newValue, oldValue) => {
    if (newValue === oldValue || newValue || anyWidgetDialogOpened.value) return
    releaseFieldLockLocal(modelValue.value)
  },
  { immediate: false }
)

watch(
  anyWidgetDialogOpened,
  (newValue, oldValue) => {
    if (newValue === oldValue || newValue) return
    releaseFieldLockLocal(modelValue.value)
  },
  { immediate: false }
)

defineExpose({
  metadataConfirm,
})
</script>

<template>
  <div
    class="a-image-widget"
    :class="{ 'a-image-widget--locked': isLocked }"
    :style="{ width : width ? width + 'px' : undefined, maxWidth : maxWidth ? maxWidth + 'px' : undefined }"
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
              v-if="imageLoaded && !expandMetadata"
              class="mr-2 mb-2"
              @click="actionEditMeta"
            >
              {{ t('common.damImage.image.meta.edit') }}
            </VBtn>
            <VBtn
              class="mr-2 mb-2"
              @click="actionLibrary"
            >
              <span v-if="imageLoaded">{{ t('common.damImage.image.button.replaceFromDam') }}</span>
              <span v-else>{{ t('common.damImage.image.button.addFromDam') }}</span>
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
                    v-if="imageLoaded && !expandMetadata"
                    @click="actionEditMeta"
                  >
                    <VListItemTitle>{{ t('common.damImage.image.meta.edit') }}</VListItemTitle>
                  </VListItem>
                  <VListItem @click="actionLibrary">
                    <VListItemTitle>
                      <span v-if="imageLoaded">{{ t('common.damImage.image.button.replaceFromDam') }}</span>
                      <span v-else>{{ t('common.damImage.image.button.addFromDam') }}</span>
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
                    <VListItemTitle>{{ t('common.damImage.image.button.removeImage') }}</VListItemTitle>
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
      <AImageDropzone
        variant="fill"
        transparent
        :accept="uploadAccept"
        :max-sizes="uploadSizes"
        :hide-text="!withoutImage || isLocked"
        @on-click="onDropzoneClick"
        @on-drop="onDrop"
      />
    </div>
    <slot
      name="append"
      :image="resImage"
    />
    <ImageDetailDialogMetadata
      ref="detailDialogMetadataComponent"
      v-model="metadataDialog"
      :expand="expandMetadata"
      :saving="metadataDialogSaving"
      :loading="metadataDialogLoading"
      @edit-asset="onEditAsset"
      @on-confirm="onMetadataDialogConfirm"
      @on-close="onMetadataDialogClose"
    />
  </div>
  <AAssetSelect
    v-model="assetSelectDialog"
    :select-licences="selectLicences"
    :min-count="1"
    :max-count="1"
    :asset-type="DamAssetType.Image"
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
