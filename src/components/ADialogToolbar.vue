<script setup lang="ts">
const emit = defineEmits<{
  (e: 'onCancel'): void
}>()

const onCancel = () => {
  emit('onCancel')
}
</script>

<template>
  <VToolbar
    density="compact"
    color="transparent"
  >
    <VToolbarTitle class="flex-fill">
      <slot />
    </VToolbarTitle>
    <VSpacer />
    <VBtn
      class="ml-2"
      icon="mdi-close"
      size="small"
      variant="text"
      data-cy="button-close"
      @click.stop="onCancel"
    />
  </VToolbar>
</template>
