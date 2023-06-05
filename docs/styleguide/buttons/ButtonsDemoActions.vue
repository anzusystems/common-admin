<script lang="ts" setup>
import AActionCloseButton from "@/components/buttons/action/AActionCloseButton.vue";
import AActionSaveButton from "@/components/buttons/action/AActionSaveButton.vue";
import AActionEditButton from "@/components/buttons/action/AActionEditButton.vue";
</script>

<template>
  <div class="d-flex align-center">
    <VSpacer />
    <AActionSaveButton class="mr-2" />
    <AActionEditButton variant="secondary" class=" mr-2" route-name="" />
    <ABtnTertiary rounded>Other</ABtnTertiary>
    <AActionCloseButton />
  </div>
</template>
