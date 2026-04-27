<script setup lang="ts">
import { useI18n } from 'vue-i18n'

export interface Props {
  title?: string
  body?: string
  stayLabel?: string
  discardLabel?: string
}

withDefaults(defineProps<Props>(), {
  title: undefined,
  body: undefined,
  stayLabel: undefined,
  discardLabel: undefined,
})

const open = defineModel<boolean>({ required: true })

const emit = defineEmits<{
  resolve: [discard: boolean]
}>()

const { t } = useI18n()

const onStay = () => {
  emit('resolve', false)
}

const onDiscard = () => {
  emit('resolve', true)
}
</script>

<template>
  <VDialog
    v-model="open"
    max-width="480"
    persistent
  >
    <VCard>
      <VCardTitle>
        {{ title ?? t('common.sortable.unsavedChanges.title') }}
      </VCardTitle>
      <VCardText>
        {{ body ?? t('common.sortable.unsavedChanges.body') }}
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          @click="onStay"
        >
          {{ stayLabel ?? t('common.sortable.unsavedChanges.stay') }}
        </VBtn>
        <VBtn
          color="warning"
          variant="elevated"
          @click="onDiscard"
        >
          {{ discardLabel ?? t('common.sortable.unsavedChanges.discard') }}
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
