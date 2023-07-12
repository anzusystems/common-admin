<script lang="ts" setup>
import AImageDropzone from '@/components/file/AFileDropzone.vue'
import type { IntegerIdNullable } from '@/types/common'
import type { ImageWidgetImage } from '@/types/ImageWidgetImage'
import imagePlaceholderPath from '@/assets/image/placeholder16x9.jpg'
import { computed, ref } from 'vue'
import { useImageOptions } from '@/components/image/composables/imageOptions'
import { useImageActions } from '@/components/image/composables/imageActions'

/**
 * For accept and maxSizes check docs {@see useFormatAndSizeCheck}
 */
const props = withDefaults(
  defineProps<{
    modelValue: IntegerIdNullable
    stackId: string
    configName?: string
    label?: string | undefined
    image?: ImageWidgetImage | undefined // optional, if available, no need to fetch image data
    readonly?: boolean
    dataCy?: string | undefined
    expandOptions?: boolean
    disableOnClickMenu?: boolean
    width?: number | undefined
    accept?: string | undefined
    maxSizes?: Record<string, number> | undefined
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
    accept: undefined,
    maxSizes: undefined,
  }
)

const clickMenuOpened = ref(false)

const imageOptions = useImageOptions(props.configName)
const { fetchImageWidgetData } = imageOptions
const { widgetImageToDamImageUrl } = useImageActions(imageOptions)

const enabledInteractionComputed = computed(() => {
  return true
})

const showReviewIcon = computed(() => {
  return true
})

const imageLoaded = computed(() => {
  return true
})

const actionEditMeta = () => {}
const actionLibrary = () => {}
const actionDelete = () => {}
</script>

<template>
  <div class="a-image-widget">
    <div class="a-image-widget__options">
      <h4
        v-if="label"
        class="font-weight-bold text-subtitle-2"
      >
        {{ label }}
      </h4>
      <div v-show="enabledInteractionComputed">
        <VBtn
          v-if="showReviewIcon"
          color="orange"
          variant="text"
          size="small"
          @click.stop="actionEditMeta"
        >
          <VIcon
            size="small"
            icon="mdi-alert"
          />
          <span>Check metadata</span>
        </VBtn>
        <div
          v-if="expandOptions"
          class="d-flex flex-row"
        >
          <VBtn
            v-if="imageLoaded"
            class="mr-2 mb-2"
            @click="actionEditMeta"
          >
            Edit metadata
          </VBtn>
          <VBtn
            class="mr-2 mb-2"
            @click="actionLibrary"
          >
            <span v-if="imageLoaded">Replace from library</span>
            <span v-else>Choose from library</span>
          </VBtn>
          // upload button
        </div>
        <VBtn
          variant="text"
          size="x-small"
          icon
        >
          <VIcon icon="mdi-dots-horizontal" />
          <VTooltip
            activator="parent"
            location="top"
          >
            Image options
          </VTooltip>
          <VMenu
            v-model="clickMenuOpened"
            activator="parent"
            location="bottom right"
          >
            <VCard>
              <VList density="compact">
                <VListItem
                  v-if="imageLoaded"
                  @click="actionEditMeta"
                >
                  <VListItem-title>Update metadata</VListItem-title>
                </VListItem>
                <VListItem @click="actionLibrary">
                  <VListItem-title>
                    <span v-if="imageLoaded">Replace from library</span>
                    <span v-else>Choose from library</span>
                  </VListItem-title>
                </VListItem>
                // upload button
                <VListItem
                  v-if="imageLoaded"
                  @click="actionDelete"
                >
                  <VListItem-title>Remove image</VListItem-title>
                </VListItem>
              </VList>
            </VCard>
          </VMenu>
        </VBtn>
      </div>
    </div>
    <div class="position-relative">
      <VImg
        :lazy-src="imagePlaceholderPath"
        :src="imagePlaceholderPath"
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
      <AImageDropzone
        variant="fill"
        transparent
        :accept="accept"
        :max-sizes="maxSizes"
        @on-click="clickMenuOpened = true"
      />
    </div>
  </div>
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
