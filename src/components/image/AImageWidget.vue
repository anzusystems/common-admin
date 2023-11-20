<script lang="ts" setup>
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import { onMounted, provide, ref } from 'vue'
import { useDamConfigState } from '@/components/dam/uploadQueue/damConfigState'
import { useCoreDamOptions } from '@/components/dam/assetSelect/composables/coreDamOptions'
import type { ImageWidgetImage } from '@/types/ImageWidgetImage'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import AImageWidgetInner from '@/components/image/AImageWidgetInner.vue'
import { CurrentUserSymbol } from '@/components/injectionKeys'
import { ImageWidgetExtSystemConfig } from '@/components/image/composables/imageWidgetInkectionKeys'

/**
 * For accept and maxSizes check docs {@see useFormatAndSizeCheck}
 */
const props = withDefaults(
  defineProps<{
    modelValue: IntegerIdNullable
    queueKey: UploadQueueKey
    licenceId: IntegerId
    extSystem: IntegerId
    image?: ImageWidgetImage | undefined // optional, if available, no need to fetch image data
    configName?: string
    label?: string | undefined
    readonly?: boolean
    dataCy?: string | undefined
    expandOptions?: boolean
    disableOnClickMenu?: boolean
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
    disableOnClickMenu: false,
    width: undefined,
  }
)

const ready = ref(false)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { damClient } = useCoreDamOptions(props.configName)
const { initialized, loadDamConfigExtSystem, damConfigExtSystem } = useDamConfigState(damClient)

onMounted(async () => {
  if (initialized.damConfigExtSystem !== props.extSystem) {
    await loadDamConfigExtSystem(props.extSystem)
  }
  ready.value = true
})

provide(ImageWidgetExtSystemConfig, damConfigExtSystem)
</script>

<template>
  <AImageWidgetInner
    v-if="ready"
    v-bind="props"
  />
  <div v-else>
    loading
  </div>
</template>
