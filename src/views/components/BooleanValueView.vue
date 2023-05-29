<script lang="ts" setup>
import ABooleanValue from '@/components/ABooleanValue.vue'
</script>

<template>
  <VCard>
    <VCardTitle>ABooleanValue</VCardTitle>
    <VCardSubtitle> :value="true" </VCardSubtitle>
    <VCardText>
      <ABooleanValue :value="true" />
    </VCardText>
    <VCardSubtitle> :value="false" </VCardSubtitle>
    <VCardText>
      <ABooleanValue :value="false" />
    </VCardText>
    <VCardSubtitle> :value="true" chip </VCardSubtitle>
    <VCardText>
      <ABooleanValue
        :value="true"
        chip
      />
    </VCardText>
    <VCardSubtitle> :value="false" chip </VCardSubtitle>
    <VCardText>
      <ABooleanValue
        :value="false"
        chip
      />
    </VCardText>
    <VCardSubtitle> :value="false" chip invert-color </VCardSubtitle>
    <VCardText>
      <ABooleanValue
        :value="false"
        chip
        invert-color
      />
    </VCardText>
  </VCard>
</template>
