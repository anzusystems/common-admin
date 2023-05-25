<script lang="ts" setup>
import { computed } from 'vue'
import { AssetStatus, AssetType } from '@/types/coreDam/Asset'
import placeholder16x9 from '@/assets/image/placeholder16x9.jpg'
import { isUndefined } from '@/lib'

const props = withDefaults(
  defineProps<{
    src?: string
    assetType?: AssetType
    assetStatus?: AssetStatus
    backgroundColor?: string
    width?: number
    height?: number
    fallbackHeight?: number
    iconSize?: number
    iconColor?: string
  }>(),
  {
    assetType: AssetType.Image,
    assetStatus: AssetStatus.WithFile,
    src: undefined,
    backgroundColor: '#ccc',
    width: undefined,
    height: undefined,
    fallbackHeight: 200,
    iconSize: 80,
    iconColor: '#505050',
  }
)
const emit = defineEmits<{
  (e: 'error'): void
}>()

const onError = () => {
  emit('error')
}

const icon = computed(() => {
  if (props.assetStatus === AssetStatus.Deleting) return 'mdi-trash-can'
  switch (props.assetType) {
    case AssetType.Audio:
      return props.assetStatus === AssetStatus.WithFile ? 'mdi-music' : 'mdi-music-off'
    case AssetType.Document:
      return props.assetStatus === AssetStatus.WithFile ? 'mdi-note' : 'mdi-note-off'
    case AssetType.Video:
      return props.assetStatus === AssetStatus.WithFile ? 'mdi-video' : 'mdi-video-off'
    case AssetType.Image:
      return props.assetStatus === AssetStatus.WithFile ? 'mdi-image' : 'mdi-image-off'
    default:
      return ''
  }
})

const srcComputed = computed(() => {
  return isUndefined(props.src) ? placeholder16x9 : props.src
})

const showIconComputed = computed(() => {
  if (props.assetType === AssetType.Image && props.src) return false
  return true
})
</script>

<template>
  <div
    v-if="assetStatus === AssetStatus.WithFile && src"
    class="asset-image asset-image--img position-relative"
  >
    <img
      :src="srcComputed"
      :width="width"
      :height="height"
      alt=""
      :style="'background-color:' + backgroundColor"
      @onerror="onError"
    >
    <div
      v-if="showIconComputed"
      class="asset-image__icon-wrapper"
    >
      <div
        class="asset-image__icon-circle"
        :style="{ padding: iconSize / 4 + 'px' }"
      >
        <VIcon
          v-if="icon.length"
          :size="iconSize"
          :icon="icon"
          :color="iconColor"
          class="asset-image__icon"
        />
      </div>
    </div>
  </div>
  <div
    v-else
    :style="{ height: fallbackHeight + 'px', backgroundColor: backgroundColor }"
    style="width: 100%"
    class="asset-image asset-image--placeholder d-flex align-center justify-center"
  >
    <div
      v-if="showIconComputed"
      class="asset-image__icon-wrapper"
    >
      <div
        class="asset-image__icon-circle"
        :style="{ padding: iconSize / 4 + 'px' }"
      >
        <VIcon
          v-if="icon.length"
          :size="iconSize"
          :icon="icon"
          :color="iconColor"
          class="asset-image__icon"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss">
// todo Stano -> copy paste from dam-admin [duplicate code]
.asset-image {
  position: relative;

  &__icon-wrapper {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__icon-circle {
    border-radius: 100%;
    background-color: rgba(204 204 204 / 50%);
  }
}
</style>
