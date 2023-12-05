<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { ref } from 'vue'
import type { IntegerId } from '@/types/common'
import AImageWidgetMultiple from '@/components/damImage/AImageWidgetMultiple.vue'

const imageIds = ref<IntegerId[]>([1231, 1232, 1233])

const component = ref<InstanceType<typeof AImageWidgetMultiple> | null>(null)

const save = () => {
  component.value.saveImages()
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
          <VBtn @click.stop="save">
            Save
          </VBtn>
        </VCol>
      </VRow>
      <VRow>
        <VCol>
          <AImageWidgetMultiple
            ref="component"
            v-model="imageIds"
            :licence-id="100001"
            :ext-system="1"
            queue-key="gallery"
            label="Images"
          />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
