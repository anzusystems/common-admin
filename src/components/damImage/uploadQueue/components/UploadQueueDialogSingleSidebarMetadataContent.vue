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
import DamSourcesAuthorsRow from '@/components/damImage/uploadQueue/components/DamSourcesAuthorsRow.vue'
import { useDamCachedAuthors } from '@/components/damImage/uploadQueue/author/cachedAuthors'
import { useDamCreditPreview } from '@/components/damImage/uploadQueue/composables/damCredit'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import { ADamAssetMetadataValidationScopeSymbol } from '@/components/damImage/uploadQueue/composables/uploadValidations'
import { dateTimePretty } from '@/utils/datetime'
import { useDamKeywordAssetTypeConfig } from '@/components/damImage/uploadQueue/keyword/damKeywordConfig'
import { useDamAuthorAssetTypeConfig } from '@/components/damImage/uploadQueue/author/damAuthorConfig'
import { useDamSourceAssetTypeConfig } from '@/components/damImage/uploadQueue/source/damSourceConfig'
import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import type { IntegerId } from '@/types/common'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'

const props = withDefaults(
  defineProps<{
    queueKey: string
    extSystem: IntegerId
    configName?: string
  }>(),
  {
    configName: 'default',
  },
)

const { t } = useI18n()

const panels = ref(['metadata', 'file'])

const assetDetailStore = useAssetDetailStore()
const { asset, authorConflicts, metadataAreTouched, mainFileSingleUse } =
  storeToRefs(assetDetailStore)

const uploadQueuesStore = useUploadQueuesStore()

const items = computed(() => {
  return uploadQueuesStore.getQueueItems(props.queueKey)
})

const item = computed<UploadQueueItem | null>(() => {
  return items.value[0] ?? null
})

const assetType = computed(() => {
  return DamAssetType.Image
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

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { keywordRequired, keywordEnabled } = useDamKeywordAssetTypeConfig(
  // eslint-disable-next-line vue/no-ref-object-reactivity-loss
  assetType.value,
  props.extSystem,
)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { authorRequired, authorEnabled } = useDamAuthorAssetTypeConfig(
  // eslint-disable-next-line vue/no-ref-object-reactivity-loss
  assetType.value,
  props.extSystem,
)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { sourceRequired, sourceEnabled } = useDamSourceAssetTypeConfig(
  // eslint-disable-next-line vue/no-ref-object-reactivity-loss
  assetType.value,
  props.extSystem,
)

const { getCachedAuthor } = useDamCachedAuthors()
const credit = useDamCreditPreview(
  getCachedAuthor,
  () => props.extSystem,
  () => item.value?.sources ?? [],
  () => item.value?.authors ?? [],
)

const onSourceFound = (author: DamAuthor) => {
  if (!item.value || item.value.sources.includes(author.id)) return
  item.value.sources = [...item.value.sources, author.id]
  onAnyMetadataChange()
}

const onAuthorFound = (author: DamAuthor) => {
  if (!item.value || item.value.authors.includes(author.id)) return
  item.value.authors = [...item.value.authors, author.id]
  onAnyMetadataChange()
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { mainFileSingleUseEnabled, showFileInfoEnabled } = useCommonAdminCoreDamOptions(
  props.configName,
)
</script>

<template>
  <VExpansionPanels
    v-if="item"
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
        <VForm :disabled="!item.canEditMetadata">
          <AssetCustomMetadataForm
            v-if="item"
            v-model="item.customData"
            :ext-system="extSystem"
            :asset-type="assetType"
            @any-change="onAnyMetadataChange"
          >
            <template #after-pinned>
              <VRow
                v-if="keywordEnabled"
                density="comfortable"
                class="my-2"
              >
                <VCol>
                  <ASystemEntityScope
                    subject="keyword"
                    system="dam"
                  >
                    <KeywordRemoteAutocompleteWithCached
                      v-model="item.keywords"
                      :label="t('common.damImage.asset.model.keywords')"
                      data-cy="custom-field-keywords"
                      :ext-system="extSystem"
                      clearable
                      multiple
                      :disabled="!item.canEditMetadata"
                      :required="keywordRequired"
                      :validation-scope="ADamAssetMetadataValidationScopeSymbol"
                      @update:model-value="onAnyMetadataChange"
                    />
                  </ASystemEntityScope>
                </VCol>
              </VRow>
              <DamSourcesAuthorsRow
                :source-enabled="sourceEnabled"
                :author-enabled="authorEnabled"
                :credit="credit"
                class="my-2"
              >
                <template #sources>
                  <ASystemEntityScope
                    subject="author"
                    system="dam"
                  >
                    <AuthorRemoteAutocompleteWithCached
                      v-model="item.sources"
                      :label="t('common.damImage.asset.model.sources')"
                      data-cy="custom-field-sources"
                      :ext-system="extSystem"
                      source
                      clearable
                      multiple
                      :disabled="!item.canEditMetadata"
                      :required="sourceRequired"
                      :validation-scope="ADamAssetMetadataValidationScopeSymbol"
                      @update:model-value="onAnyMetadataChange"
                      @author-found="onAuthorFound"
                    />
                  </ASystemEntityScope>
                </template>
                <template #authors>
                  <ASystemEntityScope
                    subject="author"
                    system="dam"
                  >
                    <AuthorRemoteAutocompleteWithCached
                      v-model="item.authors"
                      :label="t('common.damImage.asset.model.authors')"
                      :author-conflicts="authorConflicts"
                      data-cy="custom-field-authors"
                      :ext-system="extSystem"
                      :source="sourceEnabled ? false : undefined"
                      clearable
                      multiple
                      :disabled="!item.canEditMetadata"
                      :required="authorRequired"
                      :validation-scope="ADamAssetMetadataValidationScopeSymbol"
                      @update:model-value="onAnyMetadataChange"
                      @source-found="onSourceFound"
                    />
                  </ASystemEntityScope>
                </template>
              </DamSourcesAuthorsRow>
              <VRow
                v-if="mainFileSingleUseEnabled"
                density="comfortable"
                class="my-2"
              >
                <VCol>
                  <VSwitch
                    v-model="mainFileSingleUse"
                    :label="t('common.damImage.asset.model.mainFileSingleUse')"
                  />
                </VCol>
              </VRow>
            </template>
          </AssetCustomMetadataForm>
        </VForm>
      </VExpansionPanelText>
    </VExpansionPanel>
    <VExpansionPanel
      v-if="asset && showFileInfoEnabled"
      elevation="0"
      :title="t('common.damImage.asset.detail.info.file')"
      value="file"
    >
      <VExpansionPanelText class="text-body-small">
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
        <template v-if="assetMainFile">
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
        </template>
      </VExpansionPanelText>
    </VExpansionPanel>
  </VExpansionPanels>
</template>
