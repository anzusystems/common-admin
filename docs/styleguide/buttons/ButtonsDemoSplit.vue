<script lang="ts" setup>
import ABtnSplit from "@/components/buttons/ABtnSplit.vue";
</script>

<template>
  <div class="d-flex justify-space-between align-center">
    <ABtnSplit rounded="pill">
      <template #button-content>Save</template>
      <VListItem>save and close</VListItem>
    </ABtnSplit>
    <ABtnSplit>
      <template #button-content>Save</template>
      <VListItem>save and close</VListItem>
    </ABtnSplit>
    <ABtnSplit variant="secondary">
      <template #button-content>Save</template>
      <VListItem>save and close</VListItem>
    </ABtnSplit>
    <ABtnSplit variant="tertiary">
      <template #button-content>Save</template>
      <VListItem>save and close</VListItem>
    </ABtnSplit>
  </div>
</template>
