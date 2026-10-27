<script lang="ts" setup>
import type { IntegerId, IntegerIdNullable } from '@/shared/types/common'
import { onMounted, provide, ref, shallowRef } from 'vue'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import type { ImageAware, ImageCreateUpdateAware } from '@/domains/dam/types/ImageAware'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { isUndefined } from '@/shared/utils/common'
import { isImageWidgetUploadConfigAllowed } from '@/domains/dam/config/utils/damFilterUserAllowedUploadConfigs'
import { type CollabComponentConfig, CollabStatus, type CollabStatusType } from '@/domains/collab/types/Collab'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'
import { useDamConfigStoreOf } from '@/domains/dam/config/store/damConfigStore'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import AImageWidgetSimple from '@/domains/dam/imageWidget/components/AImageWidgetSimple.vue'
import AMediaWidgetSimple from '@/domains/dam/imageWidget/components/AMediaWidgetSimple.vue'
import type { MediaAware } from '@/domains/dam/types/MediaAware'
import { useI18n } from 'vue-i18n'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { DamAssetType } from '@/domains/dam/types/Asset'

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
    readonly?: boolean
    required?: boolean
    dataCy?: string | undefined
    expandOptions?: boolean
    expandMetadata?: boolean
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
    initialImage: undefined,
    initialMedia: undefined,
    readonly: false,
    required: false,
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

const mediaModel = defineModel<MediaAware | null>('media', { required: true })
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)
// Declared explicitly: the read-only fallback renders the slots too, and inferred types would be looser.
defineSlots<{
  append?: (props: { imageMedia: ImageCreateUpdateAware | MediaAware | null }) => unknown
  preview?: (props: { imageMedia: MediaAware }) => unknown
}>()
const imageModel = defineModel<IntegerIdNullable>('image', { required: true })
const status = ref<'loading' | 'ready' | 'error'>('loading')
// Without upload permission the existing image is still shown, read-only.
const uploadAllowed = ref(true)

const { damClient } = useCommonAdminCoreDamOptions(damConfigName)
const {
  loadDamPrvConfig,
  loadDamConfigAssetCustomFormElements,
  getDamConfigAssetCustomFormElements,
  getOrLoadDamConfigExtSystemByLicence,
  getOrLoadDamConfigExtSystemByLicences,
} = useDamConfigState(damClient, damConfigName)

const uploadConfig = shallowRef<DamConfigLicenceExtSystemReturnType | undefined>(undefined)

const { cachedExtSystemId } = useExtSystemIdForCached(damConfigName)

onMounted(async () => {
  const damConfigStore = useDamConfigStoreOf(damConfigName)
  uploadConfig.value = await getOrLoadDamConfigExtSystemByLicence(props.uploadLicence)
  if (isUndefined(uploadConfig.value)) {
    status.value = 'error'
    return
  }
  // Starts as the ext system of the upload licence, until a pick, a drop or "edit asset" sets another.
  cachedExtSystemId.value = uploadConfig.value.extSystem
  if (!isImageWidgetUploadConfigAllowed(uploadConfig.value, damConfigName)) {
    uploadAllowed.value = false
    try {
      if (!damConfigStore.initialized.damPrvConfig) await loadDamPrvConfig()
      status.value = 'ready'
    } catch (e) {
      status.value = 'error'
    }
    return
  }
  const promises: Promise<any>[] = []
  if (!damConfigStore.initialized.damPrvConfig) {
    promises.push(loadDamPrvConfig())
  }
  promises.push(getOrLoadDamConfigExtSystemByLicences(props.selectLicences))
  const { extSystem } = uploadConfig.value
  // Loads custom fields for every type of the ext system if none are loaded yet.
  // Otherwise loads only the image type if its earlier read failed. Loaded types are not read again.
  if (isUndefined(getDamConfigAssetCustomFormElements(extSystem, DamAssetType.Image))) {
    promises.push(
      loadDamConfigAssetCustomFormElements(
        extSystem,
        getDamConfigAssetCustomFormElements(extSystem) ? [DamAssetType.Image] : undefined
      )
    )
  }
  try {
    await Promise.all(promises)
  } catch (e) {
    status.value = 'error'
  }
  // If the image type failed while other types loaded, the form would have no fields, so this is an error.
  if (isUndefined(getDamConfigAssetCustomFormElements(extSystem, DamAssetType.Image))) status.value = 'error'
  if (status.value !== 'error') status.value = 'ready'
})

provide(ImageWidgetUploadConfigKey, uploadConfig)

const innerComponent = ref<InstanceType<typeof ImageWidgetInner> | null>(null)

const metadataConfirm = () => {
  innerComponent.value?.metadataConfirm()
}

defineExpose({
  metadataConfirm,
})

const { t } = useI18n()
</script>

<template>
  <ImageMediaWidgetInner
    v-if="status === 'ready'"
    ref="innerComponent"
    v-model:media="mediaModel"
    v-model:image="imageModel"
    v-bind="props"
    :readonly="readonly || !uploadAllowed"
    @after-metadata-save-success="emit('afterMetadataSaveSuccess')"
  >
    <template #append="{ imageMedia: appendImage }">
      <slot
        name="append"
        :image-media="appendImage"
      />
    </template>
    <template #preview="{ imageMedia: appendImage }">
      <slot
        name="preview"
        :image-media="appendImage"
      />
    </template>
  </ImageMediaWidgetInner>
  <!-- The config also fails for a user without access to the licence. The existing media or image is still shown. -->
  <div v-else-if="status === 'error'">
    <AMediaWidgetSimple
      v-if="mediaModel"
      :media="mediaModel"
      :config-name="damConfigName"
      :label="label"
      :width="width"
      :height="height"
      :dam-width="damWidth"
      :dam-height="damHeight"
    >
      <template #append="{ media: appendMedia }">
        <slot
          name="append"
          :image-media="appendMedia"
        />
      </template>
      <template #preview="{ media: previewMedia }">
        <slot
          v-if="previewMedia"
          name="preview"
          :image-media="previewMedia"
        />
      </template>
    </AMediaWidgetSimple>
    <AImageWidgetSimple
      v-else-if="imageModel || initialImage"
      :model-value="imageModel"
      :image="initialImage"
      :config-name="damConfigName"
      :label="label"
      :width="width"
      :height="height"
      :dam-width="damWidth"
      :dam-height="damHeight"
    >
      <template #append="{ image: appendImage }">
        <slot
          name="append"
          :image-media="appendImage"
        />
      </template>
    </AImageWidgetSimple>
    <div class="text-error">
      {{ t('common.damImage.error.loadingConfig') }}
    </div>
  </div>
  <VProgressCircular
    v-else
    :size="12"
    :width="2"
    indeterminate
  />
</template>
