<script lang="ts" setup>
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import AImageWidgetSimple from '@/components/damImage/AImageWidgetSimple.vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import { storeToRefs } from 'pinia'
import type { DocId } from '@/types/common'
import { isNull } from '@/utils/common'

withDefaults(
  defineProps<{
    modelValue: boolean
    saving: boolean
    loading: boolean
  }>(),
  {}
)

const emit = defineEmits<{
  (e: 'editAsset', data: DocId): void
  (e: 'onConfirm'): void
  (e: 'onClose'): void
}>()

const { t } = useI18n()

const onConfirm = () => {
  emit('onConfirm')
}

const onDialogModelUpdate = (newValue: boolean) => {
  if (newValue) return
  emit('onClose')
}

const imageStore = useImageStore()
const { imageDetail } = storeToRefs(imageStore)

const onEditAsset = () => {
  if (isNull(imageDetail.value)) return
  emit('editAsset', imageDetail.value.dam.damId)
}
</script>

<template>
  <VDialog
    :model-value="modelValue"
    :max-width="500"
    @update:model-value="onDialogModelUpdate"
  >
    <VCard v-if="modelValue">
      <ADialogToolbar @on-cancel="onDialogModelUpdate(false)">
        Update metadata
      </ADialogToolbar>
      <VCardText>
        <div
          v-if="loading"
          class="d-flex align-center justify-center"
        >
          <VProgressCircular
            indeterminate
          />
        </div>
        <div
          v-else-if="imageDetail"
          class="position-relative"
        >
          <div class="my-4">
            <AImageWidgetSimple
              :model-value="imageDetail.id"
              :image="imageDetail"
            />
          </div>
          <VRow>
            <VCol>
              <VBtn @click.stop="onEditAsset">
                Edit DAM asset
              </VBtn>
            </VCol>
          </VRow>
          <VRow>
            <VCol>
              <AFormTextarea
                v-model="imageDetail.texts.description"
                label="Description"
              />
            </VCol>
          </VRow>
          <VRow>
            <VCol>
              <AFormTextarea
                v-model="imageDetail.texts.source"
                label="Source"
              />
            </VCol>
          </VRow>
        </div>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <ABtnPrimary
          :loading="saving"
          :disabled="loading"
          @click.stop="onConfirm"
        >
          {{ t('common.button.confirm') }}
        </ABtnPrimary>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
