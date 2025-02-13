<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { ref } from 'vue'
import type { IntegerId } from '@/types/common'
import AImageWidgetMultiple from '@/components/damImage/AImageWidgetMultiple.vue'
import AImageWidgetMultipleSimple from '@/components/damImage/AImageWidgetMultipleSimple.vue'
import ImageMassOperations from '@/components/damImage/uploadQueue/components/ImageMassOperations.vue'

const imageIds = ref<IntegerId[]>([])

const component = ref<InstanceType<typeof AImageWidgetMultiple> | null>(null)

const save = () => {
  component.value?.saveImages()
}
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>Image multiple</VCardTitle>
    <VCardText>
      <VRow>
        <VCol>
          {{ imageIds }}
        </VCol>
      </VRow>
      <VRow>
        <VCol>
          Simple:<br>
          <AImageWidgetMultipleSimple
            v-model="imageIds"
            show-description
            show-source
          />
        </VCol>
      </VRow>
      <VRow>
        <VCol>
          Editable<br>
          <VBtn @click.stop="save">
            Save editable
          </VBtn>
        </VCol>
      </VRow>
      <VRow>
        <VCol>
          <AImageWidgetMultiple
            ref="component"
            v-model="imageIds"
            :upload-licence="100000"
            :select-licences="[100000]"
            queue-key="gallery"
          />
        </VCol>
        <VCol cols="3">
          <ImageMassOperations />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
