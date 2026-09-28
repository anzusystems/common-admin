<script setup lang="ts">
import { useTheme } from '@/composables/themeSettings'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  (e: 'closeDialog'): void
}>()

const { t } = useI18n()

const { toolbarColor } = useTheme()

const closeDialog = () => {
  emit('closeDialog')
}
</script>

<template>
  <VCard class="dam-image-detail">
    <div class="d-flex flex-column w-100 h-100">
      <VToolbar
        :color="toolbarColor"
        density="compact"
        :height="64"
        class="border-b"
      >
        <div class="text-label-large d-flex" />
        <VSpacer />
        <div>
          <VBtn
            icon
            :aria-label="t('common.button.close')"
            variant="text"
            :width="36"
            :height="36"
            class="mr-1"
            @click.stop="closeDialog"
          >
            <VIcon icon="mdi-close" />
          </VBtn>
        </div>
      </VToolbar>
      <div class="d-flex w-100 h-100 justify-center align-center">
        <VProgressCircular
          indeterminate
          color="primary"
        />
      </div>
    </div>
  </VCard>
</template>
