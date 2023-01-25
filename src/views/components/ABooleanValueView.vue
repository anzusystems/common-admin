<script lang="ts" setup>
import ABooleanValue from '@/components/ABooleanValue.vue'
</script>

<template>
  <VCard>
    <VCardTitle>ABooleanValue</VCardTitle>
    <VCardSubtitle> :value="true" </VCardSubtitle>
    <VCardText>
      <ABooleanValue :value="true"></ABooleanValue>
    </VCardText>
    <VCardSubtitle> :value="false" </VCardSubtitle>
    <VCardText>
      <ABooleanValue :value="false"></ABooleanValue>
    </VCardText>
    <VCardSubtitle> :value="true" chip </VCardSubtitle>
    <VCardText>
      <ABooleanValue :value="true" chip></ABooleanValue>
    </VCardText>
    <VCardSubtitle> :value="false" chip </VCardSubtitle>
    <VCardText>
      <ABooleanValue :value="false" chip></ABooleanValue>
    </VCardText>
    <VCardSubtitle> :value="false" chip invert-color </VCardSubtitle>
    <VCardText>
      <ABooleanValue :value="false" chip invert-color></ABooleanValue>
    </VCardText>
  </VCard>
</template>
