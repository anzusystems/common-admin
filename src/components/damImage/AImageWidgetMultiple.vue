<script lang="ts" setup>
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import { onMounted, provide, ref } from 'vue'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import { ImageWidgetExtSystemConfig } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import ImageWidgetMultipleInner from '@/components/damImage/uploadQueue/components/ImageWidgetMultipleInner.vue'

/**
 * For accept and maxSizes check docs {@see useFormatAndSizeCheck}
 */
const props = withDefaults(
  defineProps<{
    modelValue: IntegerId[]
    queueKey: UploadQueueKey
    licenceId: IntegerId
    extSystem: IntegerId
    configName?: string
    label?: string | undefined
    readonly?: boolean
    dataCy?: string | undefined
    width?: number | undefined
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
} = useDamConfigState(damClient)

onMounted(async () => {
  const promises: Promise<any>[] = []
  if (!initialized.damPrvConfig) {
    promises.push(loadDamPrvConfig())
  }
  if (initialized.damConfigExtSystem !== props.extSystem) {
    promises.push(loadDamConfigExtSystem(props.extSystem))
    promises.push(loadDamConfigAssetCustomFormElements(props.extSystem))
  }
  try {
    await Promise.all(promises)
  } catch (e) {
    status.value = 'error'
  }
  if (status.value !== 'error') status.value = 'ready'
})

provide(ImageWidgetExtSystemConfig, damConfigExtSystem)
</script>

<template>
  <ImageWidgetMultipleInner
    v-if="status === 'ready'"
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
