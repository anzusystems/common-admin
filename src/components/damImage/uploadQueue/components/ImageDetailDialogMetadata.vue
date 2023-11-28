<script lang="ts" setup>
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import AImageWidgetSimple from '@/components/damImage/AImageWidgetSimple.vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import { storeToRefs } from 'pinia'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
  }>(),
  {}
)

const emit = defineEmits<{
  (e: 'update:modelValue', data: boolean): void
}>()

const { t } = useI18n()

const onConfirm = () => {}
const onClose = () => {
  emit('update:modelValue', false)
}

const imageStore = useImageStore()
const { imageDetail } = storeToRefs(imageStore)
</script>

<template>
  <VDialog
    :model-value="modelValue"
    :max-width="500"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <VCard v-if="modelValue">
      <ADialogToolbar @on-cancel="onClose">
        Update metadata
      </ADialogToolbar>
      <VCardText>
        <div
          v-if="imageDetail"
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
        <ABtnPrimary @click.stop="onConfirm">
          <slot name="button-confirm-title">
            {{ t('common.button.confirm') }}
          </slot>
        </ABtnPrimary>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
