<script lang="ts" setup>
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import { onMounted, provide, ref } from 'vue'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import type { ImageAware, ImageWidgetSelectConfig, ImageWidgetUploadConfig } from '@/types/ImageAware'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import ImageWidgetInner from '@/components/damImage/uploadQueue/components/ImageWidgetInner.vue'
import { ImageWidgetExtSystemConfigs } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import { isUndefined } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    modelValue: IntegerIdNullable
    queueKey: UploadQueueKey
    uploadConfig: ImageWidgetUploadConfig
    selectConfig: ImageWidgetSelectConfig[]
    licenceId: IntegerId
    extSystem: IntegerId
    image?: ImageAware | undefined // optional, if available, no need to fetch image data
    configName?: string
    label?: string | undefined
    readonly?: boolean
    dataCy?: string | undefined
    expandOptions?: boolean
    expandMetadata?: boolean
    disableOnClickMenu?: boolean
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
    expandMetadata: false,
    disableOnClickMenu: false,
    width: undefined,
    callDeleteApiOnRemove: false,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', data: IntegerIdNullable): void
  (e: 'afterMetadataSaveSuccess'): void
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
  const promises: Promise<any>[] = []
  if (!initialized.damPrvConfig) {
    promises.push(loadDamPrvConfig())
  }
  const config = getDamConfigExtSystem(props.extSystem)
  if (isUndefined(config)) {
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

provide(ImageWidgetExtSystemConfigs, damConfigExtSystem)

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

<style lang="scss">
$class-name-root: 'a-image-widget';

.#{$class-name-root} {
  &__options {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
}
</style>
