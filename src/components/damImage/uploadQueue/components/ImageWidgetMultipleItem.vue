<script lang="ts" setup>
import AImageWidgetSimple from '@/components/damImage/AImageWidgetSimple.vue'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import { computed } from 'vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'

const props = withDefaults(
  defineProps<{
    index: number
  }>(),
  {}
)

const imageStore = useImageStore()

const image = computed(() => imageStore.images[props.index])
</script>

<template>
  <div class="position-relative">
    <div class="my-4">
      <AImageWidgetSimple
        :model-value="image.id"
        :image="image"
      />
    </div>
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
</template>
