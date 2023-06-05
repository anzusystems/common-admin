<script lang="ts" setup>
import ACardLoader from '@/components/ACardLoader.vue'
</script>

<template>
  <VCard
    loading="primary"
  >
    <ACardLoader loading />
    <VCardTitle>Lorem</VCardTitle>
    <VCardText>Lorem</VCardText>
  </VCard>
</template>
