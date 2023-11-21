<script lang="ts" setup>
import { ref, toRefs, watch } from 'vue'
import imagePlaceholderPath from '@/assets/image/placeholder16x9.jpg'
import type { Image } from '@/types/Image'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import { cmsClient } from '@/playground/mock/cmsClient'

const props = withDefaults(
  defineProps<{
    image?: Image | null
    imageId?: number | null
    width?: number | undefined
    disableAspectRatio?: boolean
  }>(),
  {
    image: null,
    imageId: null,
    width: undefined,
    disableAspectRatio: false,
  }
)

const TODO_PATH = 'http://admin-image.smedata.localhost'
// const DAM_IMAGE_ASPECT_RATIO = 16 / 9
const DAM_IMAGE_MEDIUM_PREVIEW_WIDTH = 500
const DAM_IMAGE_MEDIUM_PREVIEW_HEIGHT = 281

const fetchImageTODO = (id: number) => apiFetchOne<Image>(cmsClient, '/adm/v1/image/:id', { id }, 'cms', 'image')

const getCoreImageUrl = (
  image: Image,
  width = DAM_IMAGE_MEDIUM_PREVIEW_WIDTH,
  height = DAM_IMAGE_MEDIUM_PREVIEW_HEIGHT,
  random = true
) => {
  return (
    TODO_PATH +
    '/image/w' +
    width +
    '-h' +
    height +
    (image.dam.regionPosition > 0 ? '-c' + image.dam.regionPosition : '') +
    '/' +
    image.dam.damId +
    '.jpg' +
    (random ? '?random=' + Date.now() : '')
  )
}

const { image, imageId } = toRefs(props)

const resolvedSrc = ref('')

// const imageAspectRatioComputed = computed(() => {
//   if (props.disableAspectRatio) {
//     return undefined
//   }
//   return DAM_IMAGE_ASPECT_RATIO
// })

watch(
  [image, imageId],
  async ([newImage, newImageId]) => {
    resolvedSrc.value = imagePlaceholderPath
    if (newImage) {
      resolvedSrc.value = getCoreImageUrl(newImage)
      return
    }
    if (newImageId) {
      const resImage = await fetchImageTODO(newImageId)
      // if (isImage(resImage)) {
      // if (true) {
      resolvedSrc.value = getCoreImageUrl(resImage)
      return
      // }
    }
    return
  },
  { immediate: true }
)
</script>

<template>
  <VImg
    :lazy-src="imagePlaceholderPath"
    :src="resolvedSrc"
    :width="width"
    cover
    max-width="100%"
    class="disable-radius"
  >
    <template #placeholder>
      <div class="d-flex align-center justify-center h-100">
        <VProgressCircular
          indeterminate
          color="grey-lighten-4"
        />
      </div>
    </template>
  </VImg>
</template>

<style lang="scss">
.v-img.disable-radius .v-img__img {
  border-radius: 0;
}
</style>
