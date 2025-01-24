<script lang="ts" setup>
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import AImageWidgetSimple from '@/components/damImage/AImageWidgetSimple.vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import { storeToRefs } from 'pinia'
import type { DocId } from '@/types/common'
import { isNull } from '@/utils/common'
import {
  AImageMetadataValidationScopeSymbol,
  useImageValidation,
} from '@/components/damImage/uploadQueue/composables/uploadValidations'
import { useAlerts } from '@/composables/system/alerts'
import AuthorRemoteAutocompleteWithCached from '@/components/damImage/uploadQueue/author/AuthorRemoteAutocompleteWithCached.vue'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    saving: boolean
    loading: boolean
    expand?: boolean
    showDamAuthors?: boolean
  }>(),
  {
    expand: false,
    showDamAuthors: false,
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
const assetDetailStore = useAssetDetailStore()
const { asset, authorConflicts } = storeToRefs(assetDetailStore)
const { cachedExtSystemId } = useExtSystemIdForCached()

const imageSourceRequired = computed(() => {
  return !props.showDamAuthors
})

const { v$ } = useImageValidation(imageDetail, imageSourceRequired)

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
    <template v-if="imageDetail">
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
      <VRow v-if="showDamAuthors && asset">
        <VCol>
          <ASystemEntityScope
            subject="author"
            system="dam"
          >
            <AuthorRemoteAutocompleteWithCached
              v-model="asset.authors"
              :ext-system="cachedExtSystemId"
              :label="t('common.damImage.asset.model.authors')"
              :author-conflicts="authorConflicts"
              data-cy="custom-field-authors"
              clearable
              multiple
              :validation-scope="AImageMetadataValidationScopeSymbol"
            />
          </ASystemEntityScope>
        </VCol>
      </VRow>
      <VRow v-else>
        <VCol>
          <AFormTextarea
            v-model="imageDetail.texts.source"
            :label="t('common.damImage.image.model.texts.source')"
            :v="v$.image.texts.source"
          />
        </VCol>
      </VRow>
    </template>
  </div>
  <VDialog
    v-else
    :model-value="modelValue"
    :max-width="500"
    eager
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
          <VRow v-if="showDamAuthors && asset">
            <VCol>
              <ASystemEntityScope
                subject="author"
                system="dam"
              >
                <AuthorRemoteAutocompleteWithCached
                  v-model="asset.authors"
                  :ext-system="cachedExtSystemId"
                  :label="t('common.damImage.asset.model.authors')"
                  :author-conflicts="authorConflicts"
                  data-cy="custom-field-authors"
                  clearable
                  multiple
                  :validation-scope="AImageMetadataValidationScopeSymbol"
                />
              </ASystemEntityScope>
            </VCol>
          </VRow>
          <VRow v-else>
            <VCol>
              <AFormTextarea
                v-model="imageDetail.texts.source"
                :label="t('common.damImage.image.model.texts.source')"
                :v="v$.image.texts.source"
                required
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
