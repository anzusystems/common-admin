<script lang="ts" setup>
import ARow from '@/components/ARow.vue'
</script>

<template>
  <VCard>
    <VCardTitle>ARow</VCardTitle>
    <VCardSubtitle> title="The title" value="The value" </VCardSubtitle>
    <VCardText>
      <ARow title="The title" value="The value"></ARow>
    </VCardText>
    <VCardSubtitle> Use a slot </VCardSubtitle>
    <VCardText>
      <ARow title="The title">
        <VChip>I'm a chip</VChip>
      </ARow>
    </VCardText>
  </VCard>
</template>
