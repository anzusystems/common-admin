<script lang="ts" setup>
import type { IntegerId } from '@/types/common'
import { inject, onMounted, ref, type ShallowRef } from 'vue'
import { isUndefined } from '@/utils/common'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'
import { ImageWidgetExtSystemConfig } from '@/components/damImage/composables/imageWidgetInkectionKeys'
import { DamExtSystemConfig } from '@/types/coreDam/DamConfig'
import UploadQueueEditable from '@/components/damImage/uploadQueue/UploadQueueEditable.vue'
import { useDisplay } from 'vuetify'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import AImageWidgetMultipleItem from '@/components/damImage/AImageWidgetMultipleItem.vue'
import { storeToRefs } from 'pinia'
import { fetchImageListByIds } from '@/components/damImage/composables/imageApi'
import { useCommonAdminImageOptions } from '@/components/damImage/composables/commonAdminImageOptions'
import { useAlerts } from '@/composables/system/alerts'

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

const emit = defineEmits<{
  (e: 'update:modelValue', data: IntegerId[]): void
}>()

const imageWidgetExtSystemConfig = inject<ShallowRef<DamExtSystemConfig> | undefined>(
  ImageWidgetExtSystemConfig,
  undefined
)

if (isUndefined(imageWidgetExtSystemConfig)) {
  throw new Error("Fatal error, parent component doesn't provide necessary config ext system config.")
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imageOptions = useCommonAdminImageOptions(props.configName)
const { imageClient } = imageOptions
const { showErrorsDefault } = useAlerts()

const { mobile } = useDisplay()
const massOperations = ref(!mobile.value)
const imagesLoading = ref(false)

const imageStore = useImageStore()
const { images } = storeToRefs(imageStore)

const fetchImagesOnLoad = async () => {
  try {
    imagesLoading.value = true
    imageStore.setImages(await fetchImageListByIds(imageClient, props.modelValue))
    emit(
      'update:modelValue',
      images.value.map((image) => image.id)
    )
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    imagesLoading.value = false
  }
}

onMounted(() => {
  fetchImagesOnLoad()
})
</script>

<template>
  <AImageWidgetMultipleItem
    v-for="(image, index) in images"
    :key="image.id"
    :index="index"
  />
  <UploadQueueEditable
    :queue-key="queueKey"
    :mass-operations="massOperations"
  />
</template>

<style lang="scss"></style>
