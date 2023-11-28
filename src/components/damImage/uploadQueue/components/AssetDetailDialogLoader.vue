<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/composables/themeSettings'

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
        class="system-border-b"
      >
        <div>
          <VBtn
            variant="text"
            icon
            class="mx-1"
            :width="36"
            :height="36"
            @click.stop=""
          >
            <VIcon icon="mdi-chevron-left" />
            <VTooltip
              activator="parent"
              location="bottom"
            >
              {{ t('coreDam.asset.list.prev') }}
            </VTooltip>
          </VBtn>
          <VBtn
            variant="text"
            icon
            class="mr-2"
            :width="36"
            :height="36"
            @click.stop=""
          >
            <VIcon icon="mdi-chevron-right" />
            <VTooltip
              activator="parent"
              location="bottom"
            >
              {{ t('coreDam.asset.list.next') }}
            </VTooltip>
          </VBtn>
        </div>
        <div class="text-subtitle-2 d-flex" />
        <VSpacer />
        <div>
          <VBtn
            icon
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
