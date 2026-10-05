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
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import AImageWidgetSimple from '@/domains/dam/imageWidget/components/AImageWidgetSimple.vue'
import AMediaWidgetSimple from '@/domains/dam/imageWidget/components/AMediaWidgetSimple.vue'
import type { MediaAware } from '@/domains/dam/types/MediaAware'
import { useI18n } from 'vue-i18n'

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
    configName: 'default',
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
// Declared: the read-only fallback renders the slots too, and inferred they would take its looser types.
defineSlots<{
  append?: (props: { imageMedia: ImageCreateUpdateAware | MediaAware | null }) => unknown
  preview?: (props: { imageMedia: MediaAware }) => unknown
}>()
const imageModel = defineModel<IntegerIdNullable>('image', { required: true })
const status = ref<'loading' | 'ready' | 'error'>('loading')
// Not being allowed to upload is no reason to hide the image that is already there: it is shown read-only.
const uploadAllowed = ref(true)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { damClient } = useCommonAdminCoreDamOptions(props.configName)
const {
  loadDamPrvConfig,
  loadDamConfigAssetCustomFormElements,
  getDamConfigAssetCustomFormElements,
  getOrLoadDamConfigExtSystemByLicence,
  getOrLoadDamConfigExtSystemByLicences,
} = useDamConfigState(damClient)

const uploadConfig = shallowRef<DamConfigLicenceExtSystemReturnType | undefined>(undefined)

onMounted(async () => {
  const damConfigStore = useDamConfigStore()
  uploadConfig.value = await getOrLoadDamConfigExtSystemByLicence(props.uploadLicence)
  if (isUndefined(uploadConfig.value)) {
    status.value = 'error'
    return
  }
  if (!isImageWidgetUploadConfigAllowed(uploadConfig.value)) {
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
  const configAssetCustomFormElements = getDamConfigAssetCustomFormElements(uploadConfig.value.extSystem)
  if (isUndefined(configAssetCustomFormElements)) {
    promises.push(loadDamConfigAssetCustomFormElements(uploadConfig.value.extSystem))
  }
  try {
    await Promise.all(promises)
  } catch (e) {
    status.value = 'error'
  }
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
  <!-- The config fails also for a user without access to the licence: the media or image already there is still shown. -->
  <div v-else-if="status === 'error'">
    <AMediaWidgetSimple
      v-if="mediaModel"
      :media="mediaModel"
      :config-name="configName"
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
      :config-name="configName"
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
