<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { ref } from 'vue'
import type { IntegerId } from '@/types/common'
import AImageWidgetMultiple from '@/components/damImage/AImageWidgetMultiple.vue'

const imageId = ref<IntegerId[]>([1, 2, 3])
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>Image multiple</VCardTitle>
    <VCardText>
      <VRow>
        <VCol>
          <AImageWidgetMultiple
            v-model="imageId"
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
