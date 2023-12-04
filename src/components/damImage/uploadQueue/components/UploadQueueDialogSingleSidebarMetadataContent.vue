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

const props = withDefaults(
  defineProps<{
    queueKey: string
  }>(),
  {
  }
)

const { t } = useI18n()

const panels = ref(['metadata', 'file'])

const assetDetailStore = useAssetDetailStore()
const { asset } = storeToRefs(assetDetailStore)

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

// const { keywordEnabled, keywordRequired } = useKeywordAssetTypeConfig(assetType.value)
// const { authorEnabled, authorRequired } = useAuthorAssetTypeConfig(assetType.value)

const onAnyMetadataChange = () => {
  // metadataTouch()
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
      :title="t('coreDam.asset.detail.info.metadata')"
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
            <!--            <VRow-->
            <!--              v-if="keywordEnabled"-->
            <!--              dense-->
            <!--              class="my-2"-->
            <!--            >-->
            <!--              <VCol>-->
            <!--                <ASystemEntityScope-->
            <!--                  subject="keyword"-->
            <!--                  system="dam"-->
            <!--                >-->
            <!--                  <KeywordRemoteAutocompleteWithCached-->
            <!--                    v-model="asset.keywords"-->
            <!--                    :label="t('coreDam.asset.model.keywords')"-->
            <!--                    data-cy="custom-field-keywords"-->
            <!--                    clearable-->
            <!--                    multiple-->
            <!--                    :required="keywordRequired"-->
            <!--                    :validation-scope="ADamAssetMetadataValidationScopeSymbol"-->
            <!--                    @update:model-value="onAnyMetadataChange"-->
            <!--                  />-->
            <!--                </ASystemEntityScope>-->
            <!--              </VCol>-->
            <!--            </VRow>-->
            <!--            <VRow-->
            <!--              v-if="authorEnabled"-->
            <!--              dense-->
            <!--              class="my-2"-->
            <!--            >-->
            <!--              <VCol>-->
            <!--                <ASystemEntityScope-->
            <!--                  subject="author"-->
            <!--                  system="dam"-->
            <!--                >-->
            <!--                  <AuthorRemoteAutocompleteWithCached-->
            <!--                    v-model="asset.authors"-->
            <!--                    :label="t('coreDam.asset.model.authors')"-->
            <!--                    :author-conflicts="authorConflicts"-->
            <!--                    data-cy="custom-field-authors"-->
            <!--                    clearable-->
            <!--                    multiple-->
            <!--                    :required="authorRequired"-->
            <!--                    :validation-scope="ADamAssetMetadataValidationScopeSymbol"-->
            <!--                    @update:model-value="onAnyMetadataChange"-->
            <!--                  />-->
            <!--                </ASystemEntityScope>-->
            <!--              </VCol>-->
            <!--            </VRow>-->
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
            <!--            {{ dateTimePretty(asset.createdAt) }}<br><CachedDamUserChip :id="asset.createdBy" />-->
          </VCol>
        </VRow>
        <VRow>
          <VCol cols="3">
            {{ t('common.model.tracking.modified') }}
          </VCol>
          <VCol cols="9">
            <!--            {{ dateTimePretty(asset.modifiedAt) }}<br><CachedDamUserChip :id="asset.modifiedBy" />-->
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
