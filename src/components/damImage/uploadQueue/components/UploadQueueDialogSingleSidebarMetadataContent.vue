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
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import type { UploadQueueItem } from '@/types/coreDam/UploadQueue'
import AuthorRemoteAutocompleteWithCached from '@/components/damImage/uploadQueue/author/AuthorRemoteAutocompleteWithCached.vue'
import KeywordRemoteAutocompleteWithCached from '@/components/damImage/uploadQueue/keyword/KeywordRemoteAutocompleteWithCached.vue'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { ADamAssetMetadataValidationScopeSymbol } from '@/components/damImage/uploadQueue/composables/uploadValidations'
import { dateTimePretty } from '@/utils/datetime'

const props = withDefaults(
  defineProps<{
    queueKey: string
  }>(),
  {}
)

const { t } = useI18n()

const panels = ref(['metadata', 'file'])

const assetDetailStore = useAssetDetailStore()
const { asset, authorConflicts, metadataAreTouched } = storeToRefs(assetDetailStore)

const uploadQueuesStore = useUploadQueuesStore()

const items = computed(() => {
  return uploadQueuesStore.getQueueItems(props.queueKey)
})

const item = computed<UploadQueueItem | null>(() => {
  return items.value[0] ?? null
})

// const { asset, authorConflicts, metadataTouch } = useAssetDetailActions()

const assetType = computed(() => {
  return DamAssetType.Image
})

const isTypeImage = computed(() => {
  return assetType.value === DamAssetType.Image
})

const assetMainFile = computed<null | AssetFile>(() => {
  return asset.value && asset.value.mainFile ? (asset.value.mainFile as AssetFile) : null
})

const { damConfigExtSystem } = useDamConfigState()

const onAnyMetadataChange = () => {
  metadataAreTouched.value = true
}
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
          v-if="item"
          v-model="item.customData"
          :asset-type="assetType"
          @any-change="onAnyMetadataChange"
        >
          <template #after-pinned>
            <VRow
              v-if="damConfigExtSystem[assetType].keywords.enabled"
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
                    :label="t('common.damImage.asset.model.keywords')"
                    data-cy="custom-field-keywords"
                    clearable
                    multiple
                    :required="damConfigExtSystem[assetType].keywords.required"
                    :validation-scope="ADamAssetMetadataValidationScopeSymbol"
                    @update:model-value="onAnyMetadataChange"
                  />
                </ASystemEntityScope>
              </VCol>
            </VRow>
            <VRow
              v-if="damConfigExtSystem[assetType].authors.enabled"
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
                    :label="t('common.damImage.asset.model.authors')"
                    :author-conflicts="authorConflicts"
                    data-cy="custom-field-authors"
                    clearable
                    multiple
                    :required="damConfigExtSystem[assetType].authors.enabled"
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
      v-if="asset"
      elevation="0"
      :title="t('coreDam.asset.detail.info.file')"
      value="file"
    >
      <VExpansionPanelText class="text-caption">
        <!-- all types -->
        <VRow>
          <VCol cols="3">
            {{ t('coreDam.asset.detail.info.field.id') }}
          </VCol>
          <VCol cols="9">
            <ACopyText :value="asset.id" />
          </VCol>
        </VRow>
        <VRow>
          <VCol cols="3">
            {{ t('coreDam.asset.detail.info.field.type') }}
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
              {{ t('coreDam.asset.detail.info.field.mainFileId') }}
            </VCol>
            <VCol cols="9">
              <ACopyText :value="assetMainFile.id" />
            </VCol>
          </VRow>
          <VRow>
            <VCol cols="3">
              {{ t('coreDam.asset.detail.info.field.mimeType') }}
            </VCol>
            <VCol cols="9">
              {{ assetMainFile.fileAttributes.mimeType }}
            </VCol>
          </VRow>
          <VRow>
            <VCol cols="3">
              {{ t('coreDam.asset.detail.info.field.size') }}
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
