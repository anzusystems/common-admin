<script lang="ts" setup>
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import AImageWidgetSimple from '@/components/damImage/AImageWidgetSimple.vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import { storeToRefs } from 'pinia'
import type { DocId } from '@/types/common'
import { isNull } from '@/utils/common'
import { useImageValidation } from '@/components/damImage/uploadQueue/composables/uploadValidations'
import { useAlerts } from '@/composables/system/alerts'

withDefaults(
  defineProps<{
    modelValue: boolean
    saving: boolean
    loading: boolean
    expand?: boolean
  }>(),
  {
    expand: false,
  }
)

const emit = defineEmits<{
  (e: 'editAsset', data: DocId): void
  (e: 'onConfirm'): void
  (e: 'onClose'): void
}>()

const { t } = useI18n()
const imageStore = useImageStore()
const { imageDetail } = storeToRefs(imageStore)

const { v$ } = useImageValidation(imageDetail)

const { showValidationError } = useAlerts()

const onConfirm = () => {
  v$.value.$touch()
  if (v$.value.$invalid) {
    showValidationError()
    return
  }
  emit('onConfirm')
}

const onDialogModelUpdate = (newValue: boolean) => {
  if (newValue) return
  emit('onClose')
}

const onEditAsset = () => {
  if (isNull(imageDetail.value)) return
  emit('editAsset', imageDetail.value.dam.damId)
}

defineExpose({
  confirm: onConfirm,
})
</script>

<template>
  <div v-if="expand">
    <VRow v-if="loading">
      <VCol>
        <div class="d-flex align-center justify-center">
          <VProgressCircular indeterminate />
        </div>
      </VCol>
    </VRow>
    <VRow v-if="imageDetail">
      <VCol>
        <VBtn @click.stop="onEditAsset">
          {{ t('common.damImage.image.button.editAsset') }}
        </VBtn>
      </VCol>
    </VRow>
    <VRow v-if="imageDetail">
      <VCol>
        <AFormTextarea
          v-model="imageDetail.texts.description"
          :label="t('common.damImage.image.model.texts.description')"
          :help="t('common.damImage.image.help.texts.description')"
        />
      </VCol>
    </VRow>
    <VRow v-if="imageDetail">
      <VCol>
        <AFormTextarea
          v-model="imageDetail.texts.source"
          :label="t('common.damImage.image.model.texts.source')"
          :v="v$.image.texts.source"
        />
      </VCol>
    </VRow>
  </div>
  <VDialog
    v-else
    :model-value="modelValue"
    :max-width="500"
    @update:model-value="onDialogModelUpdate"
  >
    <VCard v-if="modelValue">
      <ADialogToolbar @on-cancel="onDialogModelUpdate(false)">
        {{ t('common.damImage.image.meta.edit') }}
      </ADialogToolbar>
      <VCardText>
        <div
          v-if="loading"
          class="d-flex align-center justify-center"
        >
          <VProgressCircular indeterminate />
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
                {{ t('common.damImage.image.button.editAsset') }}
              </VBtn>
            </VCol>
          </VRow>
          <VRow>
            <VCol>
              <AFormTextarea
                v-model="imageDetail.texts.description"
                :label="t('common.damImage.image.model.texts.description')"
                :help="t('common.damImage.image.help.texts.description')"
              />
            </VCol>
          </VRow>
          <VRow>
            <VCol>
              <AFormTextarea
                v-model="imageDetail.texts.source"
                :label="t('common.damImage.image.model.texts.source')"
                :v="v$.image.texts.source"
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
