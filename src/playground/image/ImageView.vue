<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import AImageSimple from '@/components/image/AImageSimple.vue'
import AImage from '@/components/image/AImage.vue'
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>Image</VCardTitle>
    <VCardText>
      <VRow>
        <VCol cols="4">
          <AImageSimple />
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="4">
          <AImage />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
