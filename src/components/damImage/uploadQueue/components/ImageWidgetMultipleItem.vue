<script lang="ts" setup>
import AImageWidgetSimple from '@/components/damImage/AImageWidgetSimple.vue'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import { computed } from 'vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import type { DocId } from '@/types/common'
import { isNull, isUndefined } from '@/utils/common'
import AActionDeleteButton from '@/components/buttons/action/AActionDeleteButton.vue'
import { HANDLE_CLASS } from '@/components/sortable/sortableActions'

const props = withDefaults(
  defineProps<{
    index: number
    disableDraggable: boolean
  }>(),
  {}
)

const emit = defineEmits<{
  (e: 'editAsset', data: DocId): void
  (e: 'removeItem', index: number): void
}>()

const imageStore = useImageStore()

const image = computed(() => imageStore.images[props.index])

const onEditAsset = () => {
  if (isNull(image.value) || isUndefined(image.value)) return
  emit('editAsset', image.value.dam.damId)
}

const removeItem = () => {
  emit('removeItem', props.index)
}
</script>

<template>
  <div class="asset-list-tiles__item">
    <div class="asset-list-tiles__item-card">
      <div class="ma-2">
        <div class="d-flex justify-md-space-between align-center">
          <VIcon
            :class="{
              [HANDLE_CLASS]: true,
              [HANDLE_CLASS + '--disabled']: disableDraggable,
            }"
            icon="mdi-drag"
          />
          <div class="text-caption">
            {{ image.position }}
          </div>
        </div>
        <AImageWidgetSimple
          :model-value="image.id"
          :image="image"
        />
        <VRow dense>
          <VCol class="d-flex justify-space-between mt-1">
            <VBtn
              variant="text"
              size="small"
              @click.stop="onEditAsset"
            >
              Edit DAM asset
            </VBtn>
            <AActionDeleteButton
              variant="icon"
              :size="30"
              button-class=""
              @delete-record="removeItem"
            />
          </VCol>
        </VRow>
        <VRow dense>
          <VCol>
            <AFormTextarea
              v-model="image.texts.description"
              label="Description"
            />
          </VCol>
        </VRow>
        <VRow dense>
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

<style lang="scss">
.asset-list-tiles--thumbnail.a-sortable-widget__group .asset-list-tiles__item img:not(.img-svg) {
  padding: 0;
}
</style>
