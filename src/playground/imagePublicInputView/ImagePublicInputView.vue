<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import AImagePublicInput from '@/components/damImage/AImagePublicInput.vue'
import { ref } from 'vue'
import type { IntegerIdNullable } from '@/types/common'
import ADialogToolbar from '@/components/ADialogToolbar.vue'

const dialog = ref(false)
const saving = ref(false)
const image = ref<IntegerIdNullable>(800)
const imagePublicInputComponent = ref<InstanceType<typeof AImagePublicInput> | null>(null)

const onDialogConfirm = async () => {
  saving.value = true
  try {
    await imagePublicInputComponent.value?.submit()
    dialog.value = false
  } catch (e) {
    //
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>Image public input</VCardTitle>
    <VCardText>
      <ABtnPrimary @click.stop="dialog = true">
        Open
      </ABtnPrimary>
      <VDialog
        v-model="dialog"
        :width="500"
      >
        <VCard
          v-if="dialog"
          data-cy="delete-panel"
        >
          <ADialogToolbar @on-cancel="dialog = false">
            Example dialog, like embed dialog
          </ADialogToolbar>
          <VCardText>
            <AImagePublicInput
              ref="imagePublicInputComponent"
              v-model="image"
              :select-licences="[100000, 100001]"
            />
          </VCardText>
          <VCardActions>
            <VSpacer />
            <ABtnTertiary @click.stop="dialog = false">
              Cancel
            </ABtnTertiary>
            <ABtnPrimary
              :loading="saving"
              @click.stop="onDialogConfirm"
            >
              Confirm
            </ABtnPrimary>
          </VCardActions>
        </VCard>
      </VDialog>
    </VCardText>
  </VCard>
</template>
