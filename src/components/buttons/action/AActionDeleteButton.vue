<script lang="ts" setup>
import { computed, ref } from 'vue'
import { eventClickBlur } from '@/utils/event'
import { useI18n } from 'vue-i18n'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { ButtonVariant } from '@/types/commonAdmin'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    buttonT?: string
    buttonClass?: string
    dialogMessageT?: string
    dialogConfirmButtonT?: string
    dialogCancelButtonT?: string
    dialogConfirmColor?: string
    dialogZIndex?: number
    dialogMaxWidth?: number
    dataCy?: string
    disabled?: boolean
    disableCloseAfterConfirm?: boolean
    loading?: boolean
    color?: string | undefined
    size?: number
  }>(),
  {
    variant: 'icon',
    buttonT: 'common.button.delete',
    buttonClass: 'ml-2',
    dialogMessageT: 'common.system.modal.confirmDelete',
    dialogConfirmButtonT: 'common.button.delete',
    dialogCancelButtonT: 'common.button.cancel',
    dialogConfirmColor: 'primary',
    dialogZIndex: 200,
    dialogMaxWidth: 300,
    dataCy: 'button-delete',
    disabled: false,
    disableCloseAfterConfirm: false,
    color: undefined,
    size: 36,
  }
)
const emit = defineEmits<{
  (e: 'deleteRecord'): void
}>()

const dialog = ref(false)

const onClick = (event: Event) => {
  eventClickBlur(event)
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

const variantComputed = computed(() => {
  switch (props.variant) {
    case 'secondary':
      return 'outlined'
    case 'tertiary':
    case 'icon':
      return 'text'
    default:
      return 'flat'
  }
})
</script>

<template>
  <VBtn
    v-if="variant === 'icon'"
    :class="buttonClass"
    :data-cy="dataCy"
    icon
    size="small"
    :variant="variantComputed"
    :disabled="disabled"
    :color="color"
    :loading="loading"
    :width="size"
    :height="size"
    @click.stop="onClick"
  >
    <VIcon icon="mdi-trash-can-outline" />
    <VTooltip
      activator="parent"
      location="bottom"
    >
      {{ t(buttonT) }}
    </VTooltip>
  </VBtn>
  <VBtn
    v-else
    :class="buttonClass"
    :data-cy="dataCy"
    :variant="variantComputed"
    :color="color"
    rounded="pill"
    :height="size"
    @click.stop="onClick"
  >
    {{ t(buttonT) }}
  </VBtn>
  <VDialog
    v-model="dialog"
    persistent
    :width="500"
    no-click-animation
  >
    <VCard
      v-if="dialog"
      data-cy="delete-panel"
    >
      <ADialogToolbar @on-cancel="onCancel">
        {{ t(dialogMessageT) }}
      </ADialogToolbar>
      <VCardActions>
        <VSpacer />
        <ABtnTertiary
          :disabled="loading"
          data-cy="button-cancel"
          @click.stop="onCancel"
        >
          {{ t(dialogCancelButtonT) }}
        </ABtnTertiary>
        <ABtnPrimary
          :color="dialogConfirmColor"
          :loading="loading"
          data-cy="button-confirm"
          @click.stop="onConfirm"
        >
          {{ t(dialogConfirmButtonT) }}
        </ABtnPrimary>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
