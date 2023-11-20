<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import AImageWidgetSimple from '@/components/image/AImageWidgetSimple.vue'
import AImageWidget from '@/components/image/AImageWidget.vue'
import { ref } from 'vue'
import AImageWidgetConfigProvider from '@/components/image/AImageWidgetConfigProvider.vue'
import type { IntegerIdNullable } from '@/types/common'

const imageId = ref(1)
const imageId2 = ref<IntegerIdNullable>(null)
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
          <AImageWidgetConfigProvider :ext-system="1">
            <AImageWidget
              v-model="imageId2"
              :licence-id="100001"
              queue-key="ahoj"
              label="Lead image"
            />
          </AImageWidgetConfigProvider>
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
