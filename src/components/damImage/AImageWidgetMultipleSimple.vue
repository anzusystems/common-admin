<script lang="ts" setup>
import type { IntegerId } from '@/types/common'
import type { ImageAware } from '@/types/ImageAware'
import AImageWidgetSimple from '@/components/damImage/AImageWidgetSimple.vue'
import { ref, toRefs, watch } from 'vue'
import { cloneDeep } from '@/utils/common'
import { fetchImageListByIds } from '@/components/damImage/uploadQueue/api/imageApi'
import { useAlerts } from '@/composables/system/alerts'
import { useCommonAdminImageOptions } from '@/components/damImage/composables/commonAdminImageOptions'

const props = withDefaults(
  defineProps<{
    modelValue: IntegerId[]
    images?: ImageAware[]
    configName?: string
    label?: string | undefined
    width?: number | undefined
    disableAspectRatio?: boolean
    aspectRatio?: number | string
    showDescription?: boolean
    showSource?: boolean
  }>(),
  {
    images: () => [],
    configName: 'default',
    label: undefined,
    image: undefined,
    width: undefined,
    disableAspectRatio: false,
    aspectRatio: 1.777, // 16/9
    showDescription: false,
    showSource: false,
  }
)

const { images, modelValue } = toRefs(props)

const resImages = ref<ImageAware[]>([])

const { showErrorsDefault } = useAlerts()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imageOptions = useCommonAdminImageOptions(props.configName)
const { imageClient } = imageOptions

watch(
  [images, modelValue],
  async ([newImages, newImageIds]) => {
    resImages.value = []
    if (newImages && newImages.length > 0) {
      resImages.value = cloneDeep(newImages)
      return
    }
    if (newImageIds && newImageIds.length > 0) {
      try {
        resImages.value = await fetchImageListByIds(imageClient, newImageIds)
      } catch (error) {
        showErrorsDefault(error)
      }
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="asset-list-tiles asset-list-tiles--thumbnail">
    <div
      v-for="image in resImages"
      :key="image.id"
      class="asset-list-tiles__item"
    >
      <div class="asset-list-tiles__item-card">
        <div class="ma-2">
          <AImageWidgetSimple
            :model-value="image.id"
            :image="image"
            :config-name="configName"
            :width="width"
            :disable-aspect-ratio="disableAspectRatio"
            :aspect-ratio="aspectRatio"
            :show-description="showDescription"
            :show-source="showSource"
          />
        </div>
      </div>
    </div>
  </div>
</template>
