<script lang="ts" setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { eventClickBlur } from '@/shared/utils/event'
import ADialogToolbar from '@/domains/ui/components/ADialogToolbar.vue'

const props = withDefaults(
  defineProps<{
    isUploading: boolean
    buttonSize?: number
    dataCy?: string
  }>(),
  {
    buttonSize: 26,
    dataCy: 'button-stop',
  }
)
const emit = defineEmits<{
  (e: 'confirm'): void
}>()

const dialog = ref(false)

const onClick = (event: Event) => {
  eventClickBlur(event)
  if (!props.isUploading) {
    emit('confirm')
    return
  }
  dialog.value = true
}
const onConfirm = () => {
  emit('confirm')
  dialog.value = false
}

const onCancel = () => {
  dialog.value = false
}

const { t } = useI18n()
</script>

<template>
  <VBtn
    :aria-label="t('common.damImage.upload.stop')"
    variant="flat"
    :data-cy="dataCy"
    icon
    :width="buttonSize"
    :height="buttonSize"
    @click.stop="onClick"
  >
    <VIcon icon="mdi-close" />
    <VTooltip
      activator="parent"
      location="bottom"
    >
      {{ t('common.damImage.upload.stop') }}
    </VTooltip>
  </VBtn>
  <VDialog
    v-model="dialog"
    :width="500"
    @keydown.esc="onCancel"
  >
    <VCard
      v-if="dialog"
      data-cy="delete-panel"
    >
      <ADialogToolbar @cancel="onCancel">
        {{ t('common.damImage.upload.stopConfirmQuestion') }}
      </ADialogToolbar>
      <VCardActions>
        <VSpacer />
        <ABtnTertiary
          data-cy="button-cancel"
          @click.stop="onCancel"
        >
          {{ t('common.button.cancel') }}
        </ABtnTertiary>
        <ABtnPrimary
          data-cy="button-confirm"
          @click.stop="onConfirm"
        >
          {{ t('common.damImage.upload.stop') }}
        </ABtnPrimary>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
