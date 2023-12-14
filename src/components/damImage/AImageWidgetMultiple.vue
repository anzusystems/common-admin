<script lang="ts" setup>
import type { IntegerId } from '@/types/common'
import { onMounted, provide, ref } from 'vue'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import { ImageWidgetExtSystemConfigs } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import ImageWidgetMultipleInner from '@/components/damImage/uploadQueue/components/ImageWidgetMultipleInner.vue'
import { isUndefined } from '@/utils/common'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'

const props = withDefaults(
  defineProps<{
    modelValue: IntegerId[] // initial ids, updated only when save is called
    queueKey: UploadQueueKey
    licenceId: IntegerId
    extSystem: IntegerId
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

const status = ref<'loading' | 'ready' | 'error'>('loading')

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { damClient } = useCommonAdminCoreDamOptions(props.configName)
const {
  initialized,
  loadDamConfigExtSystem,
  damConfigExtSystem,
  loadDamPrvConfig,
  loadDamConfigAssetCustomFormElements,
  getDamConfigExtSystem,
  getDamConfigAssetCustomFormElements,
} = useDamConfigState(damClient)

onMounted(async () => {
  const { cachedExtSystemId } = useExtSystemIdForCached()
  cachedExtSystemId.value = props.extSystem
  const promises: Promise<any>[] = []
  if (!initialized.damPrvConfig) {
    promises.push(loadDamPrvConfig())
  }
  const configExtSystem = getDamConfigExtSystem(props.extSystem)
  if (isUndefined(configExtSystem)) {
    promises.push(loadDamConfigExtSystem(props.extSystem))
  }
  const configAssetCustomFormElements = getDamConfigAssetCustomFormElements(props.extSystem)
  if (isUndefined(configAssetCustomFormElements)) {
    promises.push(loadDamConfigAssetCustomFormElements(props.extSystem))
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

provide(ImageWidgetExtSystemConfigs, damConfigExtSystem)

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
  <VProgressCircular
    v-else
    :size="12"
    :width="2"
    indeterminate
  />
</template>
