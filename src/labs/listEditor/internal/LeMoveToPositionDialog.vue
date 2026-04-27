<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export interface Props {
  total: number
  currentIndex: number
  itemLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  itemLabel: undefined,
})

const open = defineModel<boolean>({ required: true })

const emit = defineEmits<{
  confirm: [newIndex: number]
}>()

const { t } = useI18n()

const targetPosition = ref<number>(props.currentIndex + 1)

watch(open, (now) => {
  if (now) targetPosition.value = props.currentIndex + 1
})

const totalLabel = computed(() => Math.max(props.total, 1))
const isInvalid = computed<boolean>(
  () => !Number.isFinite(targetPosition.value) || targetPosition.value < 1 || targetPosition.value > totalLabel.value,
)

const onConfirm = () => {
  if (isInvalid.value) return
  const newIndex = Math.max(0, Math.min(props.total - 1, targetPosition.value - 1))
  emit('confirm', newIndex)
  open.value = false
}

const onCancel = () => {
  open.value = false
}
</script>

<template>
  <VDialog
    v-model="open"
    max-width="420"
    persistent
  >
    <VCard>
      <VCardTitle>
        {{ t('common.sortable.moveToPosition.title') }}
      </VCardTitle>

      <VCardText>
        <p
          v-if="itemLabel"
          class="text-body-2 mb-3"
        >
          {{ t('common.sortable.moveToPosition.itemDescription', { label: itemLabel }) }}
        </p>
        <VTextField
          v-model.number="targetPosition"
          type="number"
          :min="1"
          :max="totalLabel"
          :label="t('common.sortable.moveToPosition.positionLabel', { max: totalLabel })"
          :hint="t('common.sortable.moveToPosition.positionHint', { current: currentIndex + 1, max: totalLabel })"
          :error="isInvalid"
          autofocus
          density="comfortable"
          variant="outlined"
          @keydown.enter.prevent="onConfirm"
        />
      </VCardText>

      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          @click="onCancel"
        >
          {{ t('common.sortable.reorderCancel') }}
        </VBtn>
        <VBtn
          color="primary"
          variant="elevated"
          :disabled="isInvalid"
          @click="onConfirm"
        >
          {{ t('common.sortable.moveToPosition.confirm') }}
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
