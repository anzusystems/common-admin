<script lang="ts" setup>
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import { onMounted, provide, ref, shallowRef } from 'vue'
import type { ImageAware } from '@/types/ImageAware'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import ImageWidgetInner from '@/components/damImage/uploadQueue/components/ImageWidgetInner.vue'
import { ImageWidgetUploadConfig } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import { type CollabComponentConfig, CollabStatus, type CollabStatusType } from '@/components/collab/types/Collab'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import { useDamConfigStore } from '@/components/damImage/uploadQueue/composables/damConfigStore'

const props = withDefaults(
  defineProps<{
    modelValue: IntegerIdNullable
    queueKey: UploadQueueKey
    uploadLicence: IntegerId
    selectLicences: IntegerId[]
    image?: ImageAware | undefined // optional, if available, no need to fetch image data
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
    image: undefined,
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
  (e: 'update:modelValue', data: IntegerIdNullable): void
  (e: 'afterMetadataSaveSuccess'): void
}>()

const status = ref<'loading' | 'ready' | 'error' | 'uploadNotAllowed'>('loading')
const EXT_SYSTEM_ID = 4

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfig = {
  licence: props.uploadLicence,
  extSystem: EXT_SYSTEM_ID,
  licenceName: '',
  extSystemConfig: {
    image: {
      enabled: true,
      roiWidth: 16,
      roiHeight: 9,
      defaultSlotName: 'default',
      sizeLimit: 20971520,
      customMetadataPinnedAmount: 2,
      slots: ['default'],
      mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
    },
  },
}

const damConfigStore = useDamConfigStore()

const uploadConfig = shallowRef<DamConfigLicenceExtSystemReturnType | undefined>(undefined)

onMounted(async () => {
  uploadConfig.value = damConfig

  if (!damConfigStore.initialized.damPrvConfig) {
    damConfigStore.damPrvConfig.settings.imageChunkConfig = {
      minSize: 1048576,
      maxSize: 52428800,
    }
    damConfigStore.initialized.damPrvConfig = true
  }

  damConfigStore.damConfigLicenceExtSystem.set(props.uploadLicence, {
    name: '',
    extSystem: EXT_SYSTEM_ID,
  })

  damConfigStore.damConfigAssetCustomFormElements.set(EXT_SYSTEM_ID, {
    image: [
      {
        id: '70b51e6c-006d-49bb-b665-23f01994f49d',
        property: 'description',
        name: 'Description',
        position: 2,
        attributes: {
          type: 'string',
          minValue: null,
          maxValue: 2000,
          minCount: null,
          maxCount: null,
          required: false,
          searchable: true,
          readonly: false,
        },
      },
      {
        id: '08d74009-3782-4852-b4e8-83b37fb3ee2e',
        property: 'author',
        name: 'Author',
        position: 3,
        attributes: {
          type: 'string',
          minValue: null,
          maxValue: 255,
          minCount: null,
          maxCount: null,
          required: false,
          searchable: true,
          readonly: false,
        },
      },
    ],
    audio: [],
    video: [],
    document: [],
  })

  // damConfigStore.damConfigExtSystem.set(EXT_SYSTEM_ID, damConfig.extSystemConfig)
  status.value = 'ready'
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
  <ImageWidgetInner
    v-if="status === 'ready'"
    ref="innerComponent"
    v-bind="props"
    @update:model-value="emit('update:modelValue', $event)"
    @after-metadata-save-success="emit('afterMetadataSaveSuccess')"
  >
    <template #append="{ image: appendImage }">
      <slot
        name="append"
        :image="appendImage"
      />
    </template>
  </ImageWidgetInner>
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
