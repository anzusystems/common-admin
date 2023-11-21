<script lang="ts" setup>
import type { IntegerId } from '@/types/common'
import { onMounted, provide, ref } from 'vue'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import { ImageWidgetExtSystemConfig } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import AImageWidgetMultipleInner from '@/components/damImage/AImageWidgetMultipleInner.vue'

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

const status = ref<'loading' | 'ready' | 'error'>('loading')

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { damClient } = useCommonAdminCoreDamOptions(props.configName)
const { initialized, loadDamConfigExtSystem, damConfigExtSystem, loadDamPrvConfig } = useDamConfigState(damClient)

onMounted(async () => {
  // todo load more at once, dont block config load
  if (!initialized.damPrvConfig) {
    try {
      await loadDamPrvConfig()
    } catch (e) {
      status.value = 'error'
    }
  }
  if (initialized.damConfigExtSystem !== props.extSystem) {
    try {
      await loadDamConfigExtSystem(props.extSystem)
    } catch (e) {
      status.value = 'error'
    }
  }
  if (status.value !== 'error') status.value = 'ready'
})

provide(ImageWidgetExtSystemConfig, damConfigExtSystem)
</script>

<template>
  <AImageWidgetMultipleInner
    v-if="status === 'ready'"
    v-bind="props"
  />
  <div v-else-if="status === 'error'">
    error
  </div>
  <div v-else>
    loading
  </div>
</template>
