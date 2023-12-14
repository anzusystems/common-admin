<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { DamAssetType } from '@/types/coreDam/Asset'
import { type AssetFile, assetFileIsImageFile } from '@/types/coreDam/AssetFile'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { storeToRefs } from 'pinia'
import AssetCustomMetadataForm from '@/components/damImage/uploadQueue/components/AssetCustomMetadataForm.vue'
import ACopyText from '@/components/ACopyText.vue'
import { prettyBytes } from '@/utils/file'
import AssetMetadataImageAttributes from '@/components/damImage/uploadQueue/components/AssetMetadataImageAttributes.vue'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import { dateTimePretty } from '@/utils/datetime'
import { ADamAssetMetadataValidationScopeSymbol } from '@/components/damImage/uploadQueue/composables/uploadValidations'
import AuthorRemoteAutocompleteWithCached from '@/components/damImage/uploadQueue/author/AuthorRemoteAutocompleteWithCached.vue'
import KeywordRemoteAutocompleteWithCached from '@/components/damImage/uploadQueue/keyword/KeywordRemoteAutocompleteWithCached.vue'
import { useDamKeywordAssetTypeConfig } from '@/components/damImage/uploadQueue/keyword/damKeywordConfig'
import { useDamAuthorAssetTypeConfig } from '@/components/damImage/uploadQueue/author/damAuthorConfig'
import type { IntegerId } from '@/types/common'

const props = withDefaults(
  defineProps<{
    extSystem: IntegerId
  }>(),
  {}
)

const { t } = useI18n()

const panels = ref(['metadata', 'file'])

const assetDetailStore = useAssetDetailStore()
const { asset, authorConflicts, metadataAreTouched } = storeToRefs(assetDetailStore)

const assetType = computed(() => {
  return asset.value?.attributes.assetType || DamAssetType.Default
})

const isTypeImage = computed(() => {
  return assetType.value === DamAssetType.Image
})

const assetMainFile = computed<null | AssetFile>(() => {
  return asset.value && asset.value.mainFile ? (asset.value.mainFile as AssetFile) : null
})

const onAnyMetadataChange = () => {
  metadataAreTouched.value = true
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss,vue/no-ref-object-reactivity-loss
const { keywordRequired, keywordEnabled } = useDamKeywordAssetTypeConfig(assetType.value, props.extSystem)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss,vue/no-ref-object-reactivity-loss
const { authorRequired, authorEnabled } = useDamAuthorAssetTypeConfig(assetType.value, props.extSystem)
</script>

<template>
  <VExpansionPanels
    v-if="asset"
    v-model="panels"
    multiple
    class="v-expansion-panels--compact"
  >
    <VExpansionPanel
      elevation="0"
      :title="t('common.damImage.asset.detail.info.metadata')"
      value="metadata"
    >
      <VExpansionPanelText>
        <AssetCustomMetadataForm
          v-if="asset"
          v-model="asset.metadata.customData"
          :ext-system="extSystem"
          :asset-type="assetType"
          @any-change="onAnyMetadataChange"
        >
          <template #after-pinned>
            <VRow
              v-if="keywordEnabled"
              dense
              class="my-2"
            >
              <VCol>
                <ASystemEntityScope
                  subject="keyword"
                  system="dam"
                >
                  <KeywordRemoteAutocompleteWithCached
                    v-model="asset.keywords"
                    :ext-system="extSystem"
                    :label="t('common.damImage.asset.model.keywords')"
                    data-cy="custom-field-keywords"
                    clearable
                    multiple
                    :required="keywordRequired"
                    :validation-scope="ADamAssetMetadataValidationScopeSymbol"
                    @update:model-value="onAnyMetadataChange"
                  />
                </ASystemEntityScope>
              </VCol>
            </VRow>
            <VRow
              v-if="authorEnabled"
              dense
              class="my-2"
            >
              <VCol>
                <ASystemEntityScope
                  subject="author"
                  system="dam"
                >
                  <AuthorRemoteAutocompleteWithCached
                    v-model="asset.authors"
                    :ext-system="extSystem"
                    :label="t('common.damImage.asset.model.authors')"
                    :author-conflicts="authorConflicts"
                    data-cy="custom-field-authors"
                    clearable
                    multiple
                    :required="authorRequired"
                    :validation-scope="ADamAssetMetadataValidationScopeSymbol"
                    @update:model-value="onAnyMetadataChange"
                  />
                </ASystemEntityScope>
              </VCol>
            </VRow>
          </template>
        </AssetCustomMetadataForm>
      </VExpansionPanelText>
    </VExpansionPanel>
    <VExpansionPanel
      elevation="0"
      :title="t('common.damImage.asset.detail.info.file')"
      value="file"
    >
      <VExpansionPanelText class="text-caption">
        <!-- all types -->
        <VRow>
          <VCol cols="3">
            {{ t('common.damImage.asset.detail.info.field.id') }}
          </VCol>
          <VCol cols="9">
            <ACopyText :value="asset.id" />
          </VCol>
        </VRow>
        <VRow>
          <VCol cols="3">
            {{ t('common.damImage.asset.detail.info.field.type') }}
          </VCol>
          <VCol cols="9">
            {{ asset.attributes.assetType }}
          </VCol>
        </VRow>
        <VRow>
          <VCol cols="3">
            {{ t('common.model.tracking.created') }}
          </VCol>
          <VCol cols="9">
            {{ dateTimePretty(asset.createdAt) }}
          </VCol>
        </VRow>
        <VRow>
          <VCol cols="3">
            {{ t('common.model.tracking.modified') }}
          </VCol>
          <VCol cols="9">
            {{ dateTimePretty(asset.modifiedAt) }}
          </VCol>
        </VRow>
        <div v-if="assetMainFile">
          <VRow>
            <VCol cols="3">
              {{ t('common.damImage.asset.detail.info.field.mainFileId') }}
            </VCol>
            <VCol cols="9">
              <ACopyText :value="assetMainFile.id" />
            </VCol>
          </VRow>
          <VRow>
            <VCol cols="3">
              {{ t('common.damImage.asset.detail.info.field.mimeType') }}
            </VCol>
            <VCol cols="9">
              {{ assetMainFile.fileAttributes.mimeType }}
            </VCol>
          </VRow>
          <VRow>
            <VCol cols="3">
              {{ t('common.damImage.asset.detail.info.field.size') }}
            </VCol>
            <VCol cols="9">
              {{ prettyBytes(assetMainFile.fileAttributes.size) }}
            </VCol>
          </VRow>
          <AssetMetadataImageAttributes
            v-if="isTypeImage && assetFileIsImageFile(assetMainFile)"
            :file="assetMainFile"
          />
        </div>
      </VExpansionPanelText>
    </VExpansionPanel>
  </VExpansionPanels>
</template>
