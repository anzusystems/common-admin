<script setup lang="ts">
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import AFileInput from '@/components/file/AFileInput.vue'
import type { VBtn } from 'vuetify/components'
import type { InputFileChangeEvent } from '@/types/ChangeEvent'
import { ref } from 'vue'
import ARow from '@/components/ARow.vue'

/**
 * For accept and maxSizes check docs {@see useFormatAndSizeCheck}
 */
withDefaults(
  defineProps<{
    fileInputKey?: number | undefined
    accept?: string | undefined
    maxSizes?: Record<string, number> | undefined
    multiple?: boolean
    toolbarT?: string
  }>(),
  {
    fileInputKey: undefined,
    accept: undefined,
    maxSizes: undefined,
    multiple: false,
    toolbarT: 'common.button.upload',
  }
)

const emit = defineEmits<{
  (e: 'change', event: InputFileChangeEvent): void
  (e: 'filesInput', files: File[]): void
}>()

const modelValue = defineModel<boolean>({ default: false, required: false })

const onClose = () => {
  modelValue.value = false
}

const { t } = useI18n()

const fileInputComponent = ref<InstanceType<typeof AFileInput> | null>(null)

const onFilesInput = (files: File[]) => {
  emit('filesInput', files)
  modelValue.value = false
}

const activate = () => {
  fileInputComponent.value?.activate()
}

defineExpose({
  activate,
})
</script>

<template>
  <VDialog
    :model-value="modelValue"
    persistent
    :max-width="500"
    @update:model-value="modelValue = $event"
  >
    <template #activator="{ props: dialogProps }">
      <slot
        name="activator"
        :props="dialogProps"
      >
        <VBtn
          v-bind="dialogProps"
          :text="t('common.button.open')"
        />
      </slot>
    </template>
    <VCard
      v-if="modelValue"
      data-cy="create-panel"
    >
      <ADialogToolbar @on-cancel="onClose">
        <slot name="title">
          {{ t(toolbarT) }}
        </slot>
      </ADialogToolbar>
      <VCardText>
        <ARow>
          <AFileInput
            ref="fileInput"
            :file-input-key="fileInputKey"
            :accept="accept"
            :max-sizes="maxSizes"
            :multiple="multiple"
            use-dropzone
            @files-input="onFilesInput"
            @change="emit('change', $event)"
          />
        </ARow>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <ABtnTertiary
          data-cy="button-close"
          @click.stop="onClose"
        >
          {{ t('common.button.close') }}
        </ABtnTertiary>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
