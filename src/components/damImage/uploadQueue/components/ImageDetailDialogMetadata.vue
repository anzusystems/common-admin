<script lang="ts" setup>
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import AImageWidgetSimple from '@/components/damImage/AImageWidgetSimple.vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import { storeToRefs } from 'pinia'
import type { DocId } from '@/types/common'
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
import {
  isImageCreateUpdateAware,
  isMediaAware,
  useImageMediaWidgetStore,
} from '@/components/damImage/uploadQueue/composables/imageMediaWidgetStore'
import { DamAssetType, type DamAssetTypeType } from '@/types/coreDam/Asset'
import type { ImageCreateUpdateAware } from '@/types/ImageAware'
import ARow from '@/components/ARow.vue'
import DamAdminAssetLink from '@/components/dam/DamAdminAssetLink.vue'
import { isNull } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    saving: boolean
    loading: boolean
    type: DamAssetTypeType | null
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
const imageMediaWidgetStore = useImageMediaWidgetStore()
const { detail } = storeToRefs(imageMediaWidgetStore)
const assetDetailStore = useAssetDetailStore()
const { asset, authorConflicts } = storeToRefs(assetDetailStore)
const { cachedExtSystemId } = useExtSystemIdForCached()

const imageSourceRequired = computed(() => {
  return !props.showDamAuthors
})

const imageMedia = computed<ImageCreateUpdateAware | undefined>(() => {
  if (!isMediaAware(detail.value) || isNull(detail.value.dam.imageFileId)) return undefined

  return {
    texts: {
      description: '',
      source: '',
    },
    dam: {
      damId: detail.value.dam.imageFileId,
      licenceId: detail.value.dam.licenceId,
      regionPosition: 0,
    },
    flags: {
      showSource: false,
    },
  }
})

const { v$ } = useImageValidation(detail, imageSourceRequired)

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
  if (!isImageCreateUpdateAware(detail.value)) return
  emit('editAsset', detail.value.dam.damId)
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
    <template v-if="isImageCreateUpdateAware(detail)">
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
            v-model="detail.texts.description"
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
            v-model="detail.texts.source"
            :label="t('common.damImage.image.model.texts.source')"
            :v="v$.image?.texts.source"
          />
        </VCol>
      </VRow>
      <VRow>
        <VCol>
          <VSwitch
            v-model="detail.flags.showSource"
            :label="t('common.damImage.image.model.flags.showSource')"
            density="compact"
            hide-details
          />
        </VCol>
      </VRow>
    </template>
    <template v-else-if="isMediaAware(detail)">
      <div>
        {{ detail.dam }}
      </div>
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
        {{ type === DamAssetType.Image ? t('common.damImage.image.meta.edit') : t('common.damImage.media.meta.edit') }}
      </ADialogToolbar>
      <VCardText>
        <div
          v-if="loading"
          class="d-flex align-center justify-center"
        >
          <VProgressCircular indeterminate />
        </div>
        <div
          v-else-if="isImageCreateUpdateAware(detail)"
          class="position-relative"
        >
          <div class="my-4">
            <AImageWidgetSimple
              :model-value="detail.id"
              :image="detail"
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
                v-model="detail.texts.description"
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
                v-model="detail.texts.source"
                :label="t('common.damImage.image.model.texts.source')"
                :v="v$.image?.texts.source"
                required
              />
            </VCol>
          </VRow>
          <VRow>
            <VCol>
              <VSwitch
                v-model="detail.flags.showSource"
                :label="t('common.damImage.image.model.flags.showSource')"
                density="compact"
                hide-details
              />
            </VCol>
          </VRow>
        </div>
        <div
          v-else-if="isMediaAware(detail)"
          class="position-relative"
        >
          <div class="my-4">
            <h4 class="font-weight-bold text-subtitle-2">
              {{ t('common.damImage.media.model.dam.imageFileId') }}:
            </h4>
            <AImageWidgetSimple
              :model-value="null"
              :image="imageMedia"
            />
          </div>
          <ARow :title="t('common.damImage.media.model.dam.assetId')">
            <div class="d-flex align-center justify-space-between">
              <div>{{ detail.dam.assetId }}</div>
              <DamAdminAssetLink :asset-id="detail.dam.assetId" />
            </div>
          </ARow>
          <ARow :title="t('common.damImage.media.model.dam.licenceId')">
            {{ detail.dam.licenceId }}
          </ARow>
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
