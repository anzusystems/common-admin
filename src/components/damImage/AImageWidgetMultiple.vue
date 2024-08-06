<script lang="ts" setup>
import type { IntegerId } from '@/types/common'
import { onMounted, provide, ref, shallowRef } from 'vue'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import { ImageWidgetUploadConfig } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import ImageWidgetMultipleInner from '@/components/damImage/uploadQueue/components/ImageWidgetMultipleInner.vue'
import { isUndefined } from '@/utils/common'
import { isImageWidgetUploadConfigAllowed } from '@/components/damImage/composables/damFilterUserAllowedUploadConfigs'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import { useDamConfigStore } from '@/components/damImage/uploadQueue/composables/damConfigStore'

const props = withDefaults(
  defineProps<{
    modelValue: IntegerId[] // initial ids, updated only when save is called
    queueKey: UploadQueueKey
    uploadLicence: IntegerId
    selectLicences: IntegerId[]
    configName?: string
    label?: string | undefined
    readonly?: boolean
    dataCy?: string | undefined
    width?: number | undefined
    callDeleteApiOnRemove?: boolean
  }>(),
  {
    configName: 'default',
    label: undefined,
    image: undefined,
    readonly: false,
    lockable: false,
    lockedById: undefined,
    dataCy: undefined,
    expandOptions: false,
    width: undefined,
    callDeleteApiOnRemove: false,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', data: IntegerId[]): void
}>()

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
    await Promise.all(promises)
  } catch (e) {
    status.value = 'error'
  }
  if (status.value !== 'error') status.value = 'ready'
})

const innerComponent = ref<InstanceType<typeof ImageWidgetMultipleInner> | null>(null)

const saveImages = async () => {
  if (!innerComponent.value) return false
  return (await innerComponent.value.saveImages()) as boolean
}

provide(ImageWidgetUploadConfig, uploadConfig)

defineExpose({
  saveImages,
})
</script>

<template>
  <ImageWidgetMultipleInner
    v-if="status === 'ready'"
    ref="innerComponent"
    v-bind="props"
    @update:model-value="emit('update:modelValue', $event)"
  />
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
