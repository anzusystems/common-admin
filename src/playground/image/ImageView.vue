<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import AImageWidgetSimple from '@/components/image/AImageWidgetSimple.vue'
import AImageWidget from '@/components/image/AImageWidget.vue'
import { ref } from 'vue'

const imageId = ref(1)
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>Image</VCardTitle>
    <VCardText>
      <VRow>
        <VCol cols="4">
          <AImageWidgetSimple
            :image-id="imageId"
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
            v-model="imageId"
            label="Lead image"
            stack-id="ahoj"
          />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
