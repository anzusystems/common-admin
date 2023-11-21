<script lang="ts" setup>
import type { IntegerId } from '@/types/common'
import { inject, ref, type ShallowRef } from 'vue'
import { isUndefined } from '@/utils/common'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import { ImageWidgetExtSystemConfig } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import { DamExtSystemConfig } from '@/types/coreDam/DamConfig'
import UploadQueueEditable from '@/components/damImage/uploadQueue/UploadQueueEditable.vue'
import { useDisplay } from 'vuetify'

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
    width: undefined,
  }
)

const imageWidgetExtSystemConfig = inject<ShallowRef<DamExtSystemConfig> | undefined>(
  ImageWidgetExtSystemConfig,
  undefined
)

if (isUndefined(imageWidgetExtSystemConfig)) {
  throw new Error("Fatal error, parent component doesn't provide necessary config ext system config.")
}

const { mobile } = useDisplay()
const massOperations = ref(!mobile.value)
</script>

<template>
  <UploadQueueEditable
    :queue-key="queueKey"
    :mass-operations="massOperations"
  />
</template>

<style lang="scss"></style>
