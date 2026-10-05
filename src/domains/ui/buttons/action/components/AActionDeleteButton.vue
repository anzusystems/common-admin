<script lang="ts" setup>
import type { RegisteredAclValue } from '@/domains/auth/types/Permission'
import { useAclAllowed } from '@/domains/auth/composables/aclAllowed'
import { computed, ref } from 'vue'
import { eventClickBlur } from '@/shared/utils/event'
import { useI18n } from 'vue-i18n'
import ADialogToolbar from '@/domains/ui/components/ADialogToolbar.vue'
import type { ButtonVariant } from '@/shared/types/commonAdmin'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    buttonT?: string
    buttonClass?: string
    dialogMessageT?: string
    dialogConfirmButtonT?: string
    dialogCancelButtonT?: string
    dialogConfirmColor?: string
    dataCy?: string
    disabled?: boolean
    disableCloseAfterConfirm?: boolean
    loading?: boolean
    color?: string | undefined
    size?: number
    // When set, deleting acknowledges the unsaved-changes leave guard first, so the delete's follow-up
    // navigation is not blocked by a now-meaningless "unsaved changes, really leave?" prompt. (BUG-08)
    guard?: { acknowledge: () => void }
    // Shown only when the current user passes it; no ACL, no check. An array is evaluated with AND.
    acl?: RegisteredAclValue | RegisteredAclValue[]
    subject?: object
  }>(),
  {
    acl: undefined,
    subject: undefined,
    variant: 'icon',
    buttonT: 'common.button.delete',
    buttonClass: 'ml-2',
    dialogMessageT: 'common.system.modal.confirmDelete',
    dialogConfirmButtonT: 'common.button.delete',
    dialogCancelButtonT: 'common.button.cancel',
    dialogConfirmColor: 'primary',
    dataCy: 'button-delete',
    disabled: false,
    disableCloseAfterConfirm: false,
    color: undefined,
    size: 36,
    guard: undefined,
  }
)

const emit = defineEmits<{
  (e: 'deleteRecord'): void
}>()

const aclAllowed = useAclAllowed(
  () => props.acl,
  () => props.subject
)

const dialog = ref(false)

const onClick = (event: Event) => {
  eventClickBlur(event)
  dialog.value = true
}
const onConfirm = () => {
  props.guard?.acknowledge()
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
  <template v-if="aclAllowed">
    <VBtn
      v-if="variant === 'icon'"
      :aria-label="t(buttonT)"
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
      :disabled="disabled"
      :loading="loading"
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
      @keydown.esc="onCancel"
    >
      <VCard
        v-if="dialog"
        data-cy="delete-panel"
      >
        <ADialogToolbar @cancel="onCancel">
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
            data-cy="button-confirm-delete"
            @click.stop="onConfirm"
          >
            {{ t(dialogConfirmButtonT) }}
          </ABtnPrimary>
        </VCardActions>
      </VCard>
    </VDialog>
  </template>
</template>
