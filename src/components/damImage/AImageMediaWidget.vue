<script lang="ts" setup>
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import { onMounted, provide, ref, shallowRef } from 'vue'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import type { ImageAware } from '@/types/ImageAware'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import ImageWidgetInner from '@/components/damImage/uploadQueue/components/ImageWidgetInner.vue'
import { ImageWidgetUploadConfig } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import { isUndefined } from '@/utils/common'
import { isImageWidgetUploadConfigAllowed } from '@/components/damImage/composables/damFilterUserAllowedUploadConfigs'
import { type CollabComponentConfig, CollabStatus, type CollabStatusType } from '@/components/collab/types/Collab'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import { useDamConfigStore } from '@/components/damImage/uploadQueue/composables/damConfigStore'
import ImageMediaWidgetInner from '@/components/damImage/uploadQueue/components/ImageMediaWidgetInner.vue'
import type { MediaAware } from '@/types/MediaAware.ts'

const props = withDefaults(
  defineProps<{
    queueKey: UploadQueueKey
    uploadLicence: IntegerId
    selectLicences: IntegerId[]
    initialImage?: ImageAware | undefined // optional, if available, no need to fetch image data
    initialMedia?: MediaAware | undefined // optional, if available, no need to fetch media data
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

const mediaModel = defineModel<IntegerIdNullable>('media', { required: true })
const imageModel = defineModel<IntegerIdNullable>('image', { required: true })
const status = ref<'loading' | 'ready' | 'error' | 'uploadNotAllowed'>('loading')

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
    status.value = 'uploadNotAllowed'
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
    await Promise.allSettled(promises)
  } catch (e) {
    status.value = 'error'
  }
  if (status.value !== 'error') status.value = 'ready'
})

provide(ImageWidgetUploadConfig, uploadConfig)

const innerComponent = ref<InstanceType<typeof ImageWidgetInner> | null>(null)

const metadataConfirm = () => {
  innerComponent.value?.metadataConfirm()
}

defineExpose({
  metadataConfirm,
})
</script>

<template>
  <ImageMediaWidgetInner
    v-if="status === 'ready'"
    ref="innerComponent"
    v-model:media="mediaModel"
    v-model:image="imageModel"
    v-bind="props"
    @after-metadata-save-success="emit('afterMetadataSaveSuccess')"
  >
    <template #append="{ imageMedia: appendImage }">
      <slot
        name="append"
        :image-media="appendImage"
      />
    </template>
  </ImageMediaWidgetInner>
  <div
    v-else-if="status === 'error'"
    class="text-error"
  >
    Loading DAM config error
  </div>
  <div
    v-else-if="status === 'uploadNotAllowed'"
    class="text-error"
  >
    DAM access rights error
  </div>
  <VProgressCircular
    v-else
    :size="12"
    :width="2"
    indeterminate
  />
</template>
