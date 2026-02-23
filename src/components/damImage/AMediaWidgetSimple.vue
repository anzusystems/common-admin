<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import imagePlaceholderPath from '@/assets/image/placeholder16x9.jpg'
import { cloneDeep, isNull, isNumber } from '@/utils/common'
import { useCommonAdminImageOptions } from '@/components/damImage/composables/commonAdminImageOptions'
import { useImageActions } from '@/components/damImage/composables/imageActions'
import { DamMediaType, type MediaAware } from '@/types/MediaAware'
import { DamAssetType, type DamAssetTypeType } from '@/types/coreDam/Asset'
import MediaWidgetSimpleDialog from '@/components/damImage/uploadQueue/components/MediaWidgetSimpleDialog.vue'

const props = withDefaults(
  defineProps<{
    media?: MediaAware | null | undefined // optional, render media instead of image
    configName?: string
    label?: string | undefined
    width?: number | undefined
    height?: undefined | number
    disableAspectRatio?: boolean
    aspectRatio?: number | string
    showDescription?: boolean
    showSource?: boolean
    damWidth?: undefined | number
    damHeight?: undefined | number
    useHtmlImg?: boolean
    widgetClass?: string | undefined
  }>(),
  {
    configName: 'default',
    label: undefined,
    media: undefined,
    width: undefined,
    height: undefined,
    disableAspectRatio: false,
    aspectRatio: 1.777, // 16/9
    showDescription: false,
    showSource: false,
    damWidth: undefined,
    damHeight: undefined,
    useHtmlImg: false,
    widgetClass: undefined,
  },
)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const imageOptions = useCommonAdminImageOptions(props.configName)
const { damImageIdToDamImageUrl } = useImageActions(imageOptions)

const resMedia = ref<null | MediaAware>(null)
const resolvedSrc = ref('')
const dialog = ref(false)

const getImageUrl = (media: MediaAware) => {
  if (isNull(media.damMedia.imageFileId)) return imagePlaceholderPath
  if (isNumber(props.damWidth) && isNumber(props.damHeight)) {
    return damImageIdToDamImageUrl(media.damMedia.imageFileId, props.damWidth, props.damHeight)
  }
  return damImageIdToDamImageUrl(media.damMedia.imageFileId)
}

const onDetailClick = () => {
  if (resMedia.value?.damMedia.playable) {
    dialog.value = true
  }
}

const onDialogClose = () => {
  dialog.value = false
}

const type = computed<DamAssetTypeType | null>(() => {
  return resMedia.value?.damMedia.assetType === DamMediaType.Video
    ? DamAssetType.Video
    : DamAssetType.Audio
})

watch(
  [() => props.media],
  async ([newMedia]) => {
    resMedia.value = null
    resolvedSrc.value = imagePlaceholderPath
    if (newMedia) {
      resMedia.value = cloneDeep(newMedia)
      resolvedSrc.value = getImageUrl(newMedia)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    v-if="label"
    class="label-container"
  >
    <h4 class="font-weight-bold text-label-large">
      {{ label }}
    </h4>
  </div>
  <div
    class="position-relative"
    :class="{ 'cursor-pointer': resMedia?.damMedia.playable }"
    @click.stop="onDetailClick"
  >
    <img
      v-if="useHtmlImg"
      alt=""
      :src="resolvedSrc"
      :width="width"
      :height="height"
      :class="widgetClass"
    >
    <VImg
      v-else
      :lazy-src="imagePlaceholderPath"
      :src="resolvedSrc"
      :width="width"
      :height="height"
      cover
      max-width="100%"
      class="disable-radius"
      :class="widgetClass"
      :aspect-ratio="disableAspectRatio ? undefined : aspectRatio"
    >
      <template #error>
        <div class="d-flex align-center justify-center h-100">
          <VIcon icon="mdi-alert-circle-outline" />
        </div>
      </template>
      <template #placeholder>
        <div class="d-flex align-center justify-center h-100">
          <VProgressCircular
            indeterminate
            color="grey-lighten-4"
          />
        </div>
      </template>
    </VImg>
    <div
      v-if="type"
      class="a-image-widget__icon"
    >
      <div v-if="type === DamAssetType.Audio">
        <VIcon
          size="80"
          icon="mdi-music"
          color="#505050"
        />
      </div>
      <div v-else-if="type === DamAssetType.Video">
        <VIcon
          size="80"
          icon="mdi-video"
          color="#505050"
        />
      </div>
    </div>
  </div>
  <slot
    name="append"
    :media="resMedia"
  />
  <MediaWidgetSimpleDialog
    v-model="dialog"
    :media="resMedia"
    @on-close="onDialogClose"
  >
    <template #preview="{ media: appendMedia }">
      <slot
        name="preview"
        :media="appendMedia"
      />
    </template>
  </MediaWidgetSimpleDialog>
</template>

<style lang="scss" scoped>
:deep(.v-img.disable-radius .v-img__img) {
  border-radius: 0;
}

.label-container {
  display: flex;
  height: 32px;
  align-items: center;
}
</style>
