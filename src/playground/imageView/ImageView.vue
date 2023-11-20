<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import AImageWidgetSimple from '@/components/image/AImageWidgetSimple.vue'
import AImageWidget from '@/components/image/AImageWidget.vue'
import { ref } from 'vue'
import type { IntegerIdNullable } from '@/types/common'

const imageId = ref(1)
const imageId2 = ref<IntegerIdNullable>(1)
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>Image</VCardTitle>
    <VCardText>
      <VRow>
        <VCol cols="4">
          <AImageWidgetSimple
            :model-value="imageId"
            label="Simple image view"
          >
            <template #append="{ image }">
              DAM ID: {{ image?.dam.damId }}
            </template>
          </AImageWidgetSimple>
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="4">
          <AImageWidget
            v-model="imageId2"
            :licence-id="100001"
            :ext-system="1"
            queue-key="ahoj"
            label="Lead image"
          />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
