<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  (e: 'cancel'): void
}>()

const { t } = useI18n()

const onCancel = () => {
  emit('cancel')
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
      :aria-label="t('common.button.close')"
      size="small"
      variant="text"
      data-cy="button-close"
      @click.stop="onCancel"
    />
  </VToolbar>
</template>
