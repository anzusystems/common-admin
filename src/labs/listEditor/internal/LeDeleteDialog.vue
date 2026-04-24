<script setup lang="ts">
// Shared delete-confirmation dialog used by all three list-editor variants.
// The outer editors keep their own dialog-related state (open flag, in-flight,
// error message) and supply i18n-resolved title / text / button labels — this
// component is pure presentation plus confirm/cancel emits.

export interface Props {
  title: string
  text: string
  confirmLabel?: string
  cancelLabel?: string
  error?: string | null
  inFlight?: boolean
}

withDefaults(defineProps<Props>(), {
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
  error: null,
  inFlight: false,
})

const open = defineModel<boolean>({ required: true })

defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <VDialog
    v-model="open"
    max-width="420"
    :persistent="inFlight"
  >
    <VCard>
      <VCardTitle class="text-headline-small">
        {{ title }}
      </VCardTitle>
      <VCardText>
        {{ text }}
        <VAlert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          {{ error }}
        </VAlert>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          :disabled="inFlight"
          @click="$emit('cancel')"
        >
          {{ cancelLabel }}
        </VBtn>
        <VBtn
          color="error"
          variant="flat"
          :loading="inFlight"
          :disabled="inFlight"
          @click="$emit('confirm')"
        >
          {{ confirmLabel }}
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
