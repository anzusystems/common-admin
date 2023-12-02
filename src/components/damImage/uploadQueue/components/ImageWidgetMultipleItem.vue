<script lang="ts" setup>
import AImageWidgetSimple from '@/components/damImage/AImageWidgetSimple.vue'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import { computed } from 'vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import type { DocId } from '@/types/common'
import { isNull, isUndefined } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    index: number
  }>(),
  {}
)

const emit = defineEmits<{
  (e: 'editAsset', data: DocId): void
}>()

const imageStore = useImageStore()

const image = computed(() => imageStore.images[props.index])

const onEditAsset = () => {
  if (isNull(image.value) || isUndefined(image.value)) return
  emit('editAsset', image.value.dam.damId)
}
</script>

<template>
  <div class="asset-list-tiles__item">
    <div class="asset-list-tiles__item-card">
      <div class="ma-2">
        <AImageWidgetSimple
          :model-value="image.id"
          :image="image"
        />

        <VRow>
          <VCol class="text-right my-1">
            <VBtn
              variant="text"
              size="small"
              @click.stop="onEditAsset"
            >
              Edit DAM asset
            </VBtn>
          </VCol>
        </VRow>
        <VRow>
          <VCol>
            <AFormTextarea
              v-model="image.texts.description"
              label="Description"
            />
          </VCol>
        </VRow>
        <VRow>
          <VCol>
            <AFormTextarea
              v-model="image.texts.source"
              label="Source"
            />
          </VCol>
        </VRow>
      </div>
    </div>
  </div>
</template>
