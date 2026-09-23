<script setup lang="ts">
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import type { MediaAware } from '@/types/MediaAware'

withDefaults(
  defineProps<{
    modelValue: boolean
    media: null | MediaAware
  }>(),
  {}
)

const emit = defineEmits<{
  (e: 'onClose'): void
}>()

const { t } = useI18n()

const onDialogModelUpdate = (newValue: boolean) => {
  if (newValue) return
  emit('onClose')
}
</script>

<template>
  <VDialog
    :model-value="modelValue"
    :max-width="500"
    eager
    @update:model-value="onDialogModelUpdate"
  >
    <VCard v-if="modelValue">
      <ADialogToolbar @on-cancel="onDialogModelUpdate(false)">
        {{ t('common.damImage.media.meta.preview') }}
      </ADialogToolbar>
      <VCardText>
        <slot
          name="preview"
          :media="media"
        />
      </VCardText>
      <VCardActions>
        <VSpacer />
        <ABtnTertiary
          data-cy="button-close"
          @click.stop="onDialogModelUpdate(false)"
        >
          {{ t('common.button.close') }}
        </ABtnTertiary>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
