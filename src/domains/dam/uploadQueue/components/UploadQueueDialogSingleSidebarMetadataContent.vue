<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { storeToRefs } from 'pinia'
import AssetCustomMetadataForm from '@/domains/dam/assetDetail/components/AssetCustomMetadataForm.vue'
import AssetFileInfoPanel from '@/domains/dam/assetDetail/components/AssetFileInfoPanel.vue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import type { UploadQueueItem } from '@/domains/dam/types/UploadQueue'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import ASystemEntityScope from '@/domains/form/components/ASystemEntityScope.vue'
import { ADamAssetMetadataValidationScopeSymbol } from '@/domains/dam/composables/uploadValidations'
import { useDamKeywordAssetTypeConfig } from '@/domains/dam/keyword/composables/damKeywordConfig'
import { useDamAuthorAssetTypeConfig } from '@/domains/dam/author/composables/damAuthorConfig'
import type { IntegerId } from '@/shared/types/common'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const props = withDefaults(
  defineProps<{
    queueKey: string
    extSystem: IntegerId
    configName?: string
  }>(),
  {
    configName: undefined,
  }
)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const { t } = useI18n()

const panels = ref(['metadata', 'file'])

const assetDetailStore = useAssetDetailStore()
const { asset, metadataAreTouched } = storeToRefs(assetDetailStore)

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

const onAnyMetadataChange = () => {
  metadataAreTouched.value = true
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { keywordRequired, keywordEnabled } = useDamKeywordAssetTypeConfig(
  // eslint-disable-next-line vue/no-ref-object-reactivity-loss
  assetType.value,
  props.extSystem,
  damConfigName
)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { authorRequired, authorEnabled } = useDamAuthorAssetTypeConfig(
  // eslint-disable-next-line vue/no-ref-object-reactivity-loss
  assetType.value,
  props.extSystem,
  damConfigName
)
const { mainFileSingleUseEnabled, showFileInfoEnabled } = useCommonAdminCoreDamOptions(damConfigName)
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
                density="compact"
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
              <VRow
                v-if="authorEnabled"
                density="compact"
                class="my-2"
              >
                <VCol>
                  <ASystemEntityScope
                    subject="author"
                    system="dam"
                  >
                    <AuthorRemoteAutocompleteWithCached
                      v-model="item.authors"
                      :label="t('common.damImage.asset.model.authors')"
                      :author-conflicts="item.authorConflicts"
                      data-cy="custom-field-authors"
                      :ext-system="extSystem"
                      clearable
                      multiple
                      :disabled="!item.canEditMetadata"
                      :required="authorRequired"
                      :validation-scope="ADamAssetMetadataValidationScopeSymbol"
                      @update:model-value="onAnyMetadataChange"
                    />
                  </ASystemEntityScope>
                </VCol>
              </VRow>
              <VRow
                v-if="mainFileSingleUseEnabled"
                density="compact"
                class="my-2"
              >
                <VCol>
                  <VSwitch
                    v-model="item.mainFileSingleUse"
                    :label="t('common.damImage.asset.model.mainFileSingleUse')"
                  />
                </VCol>
              </VRow>
            </template>
          </AssetCustomMetadataForm>
        </VForm>
      </VExpansionPanelText>
    </VExpansionPanel>
    <!--
      Only for this row's asset. The store is shared and holds the previous asset until the dialog has read its own.
    -->
    <AssetFileInfoPanel
      v-if="asset && asset.id === item.assetId && showFileInfoEnabled"
      :asset="asset"
      :show-users="false"
    />
  </VExpansionPanels>
</template>
