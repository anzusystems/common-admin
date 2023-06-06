<script lang="ts" setup>
import ABtnSplit from '@/components/buttons/ABtnSplit.vue'
import ActionbarWrapper from '@/views/system/ActionbarWrapper.vue'
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>Buttons</VCardTitle>
    <VCardSubtitle>ABtnSplit</VCardSubtitle>
    <VCardText>
      <ABtnSplit rounded="pill">
        <VListItem>aaa</VListItem>
      </ABtnSplit>
    </VCardText>
    <VCardText>
      <ABtnSplit>
        <VListItem>aaa</VListItem>
      </ABtnSplit>
    </VCardText>
    <VCardText>
      <ABtnSplit variant="secondary">
        <VListItem>aaa</VListItem>
      </ABtnSplit>
    </VCardText>
    <VCardText>
      <ABtnSplit variant="tertiary">
        <VListItem>aaa</VListItem>
      </ABtnSplit>
    </VCardText>
    <VCardText>
      <ABtnSplit size="small">
        <VListItem>aaa</VListItem>
      </ABtnSplit>
    </VCardText>
    <VCardText>
      <ABtnSplit
        size="small"
        rounded="pill"
      >
        <VListItem>aaa</VListItem>
      </ABtnSplit>
    </VCardText>
    <VCardText>
      <ABtnSplit
        size="x-small"
        rounded="pill"
      >
        <VListItem>aaa</VListItem>
      </ABtnSplit>
    </VCardText>
    <VCardText>
      <ABtnSplit disabled />
    </VCardText>
    <VCardText>
      <ABtnSplit loading />
    </VCardText>
    <VCardText>
      <ABtnSplit disable-more />
    </VCardText>
  </VCard>
</template>
