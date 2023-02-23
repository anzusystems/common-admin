<script lang="ts" setup>
import { ref } from 'vue'
import { clickBlur } from '@/utils/event'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    variant?: string
    buttonT?: string
    buttonClass?: string
    dialogMessageT?: string
    dialogConfirmButtonT?: string
    dialogCancelButtonT?: string
    dialogConfirmColor?: string
    dialogCancelColor?: string
    dialogZIndex?: number
    dialogMaxWidth?: number
    dataCy?: string
    disabled?: boolean
    disableCloseAfterConfirm?: boolean
    loading?: boolean
    color?: string
    width?: number
    height?: number
  }>(),
  {
    variant: 'text',
    buttonT: 'common.button.delete',
    buttonClass: 'ml-2',
    dialogMessageT: 'common.modal.confirmDelete',
    dialogConfirmButtonT: 'common.button.delete',
    dialogCancelButtonT: 'common.button.cancel',
    dialogConfirmColor: 'error',
    dialogCancelColor: 'secondary',
    dialogZIndex: 200,
    dialogMaxWidth: 300,
    dataCy: 'button-delete',
    disabled: false,
    disableCloseAfterConfirm: false,
    color: undefined,
    width: undefined,
    height: undefined,
  }
)
const emit = defineEmits<{
  (e: 'deleteRecord'): void
}>()

const dialog = ref(false)

const onClick = (event: Event) => {
  clickBlur(event)
  dialog.value = true
}
const onConfirm = () => {
  emit('deleteRecord')
  if (!props.disableCloseAfterConfirm) closeDialog()
}

const closeDialog = () => {
  dialog.value = false
}

const onCancel = () => {
  closeDialog()
}

const { t } = useI18n()

defineExpose({
  closeDialog,
})
</script>

<template>
  <VBtn
    :class="buttonClass"
    :data-cy="dataCy"
    icon
    size="small"
    :variant="variant"
    :disabled="disabled"
    :color="color"
    :loading="loading"
    :width="width"
    :height="height"
    @click.stop="onClick"
  >
    <VIcon icon="mdi-trash-can-outline" />
    <VTooltip activator="parent" location="bottom">{{ t(buttonT) }}</VTooltip>
  </VBtn>
  <VDialog v-model="dialog" persistent :width="500" no-click-animation>
    <VCard v-if="dialog" data-cy="delete-panel">
      <VToolbar class="pl-2" density="compact">
        <div class="d-block pl-0 w-100">
          <div class="text-h6">{{ t(dialogMessageT) }}</div>
        </div>
        <VSpacer />
        <VToolbarItems>
          <VBtn
            class="ml-2"
            icon="mdi-close"
            size="small"
            variant="text"
            :disabled="loading"
            data-cy="button-close"
            @click.stop="onCancel"
          />
        </VToolbarItems>
      </VToolbar>
      <VCardActions>
        <VSpacer />
        <VBtn :color="dialogCancelColor" text :disabled="loading" data-cy="button-cancel" @click.stop="onCancel">
          {{ t(dialogCancelButtonT) }}
        </VBtn>
        <VBtn :color="dialogConfirmColor" :loading="loading" data-cy="button-confirm" @click.stop="onConfirm">
          {{ t(dialogConfirmButtonT) }}
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
