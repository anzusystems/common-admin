<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { computed, ref, watch } from 'vue'
import { DamAssetTypeDefault } from '@/domains/dam/types/Asset'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { storeToRefs } from 'pinia'
import AssetCustomMetadataForm from '@/domains/dam/assetDetail/components/AssetCustomMetadataForm.vue'
import AssetFileInfoPanel from '@/domains/dam/assetDetail/components/AssetFileInfoPanel.vue'
import ASystemEntityScope from '@/domains/form/components/ASystemEntityScope.vue'
import { ADamAssetMetadataValidationScopeSymbol } from '@/domains/dam/composables/uploadValidations'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import { useDamKeywordAssetTypeConfig } from '@/domains/dam/keyword/composables/damKeywordConfig'
import { useDamAuthorAssetTypeConfig } from '@/domains/dam/author/composables/damAuthorConfig'
import type { DocId, IntegerId } from '@/shared/types/common'
import ABooleanValue from '@/domains/ui/components/ABooleanValue.vue'
import ARow from '@/domains/ui/components/ARow.vue'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'
import { useAssetSuggestions } from '@/domains/dam/uploadQueue/composables/assetSuggestions'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import { useDamCachedUsers } from '@/domains/dam/author/composables/cachedUsers'

const props = withDefaults(
  defineProps<{
    extSystem: IntegerId
    readonly?: boolean
    configName?: string
    showEditButton?: boolean
  }>(),
  {
    readonly: false,
    configName: undefined,
    showEditButton: false,
  }
)

const emit = defineEmits<{
  (e: 'editInDam'): void
}>()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const { t } = useI18n()

const panels = ref(['metadata', 'file'])

const assetDetailStore = useAssetDetailStore()
const { asset, metadataAreTouched, mainFileSingleUse } = storeToRefs(assetDetailStore)

const assetType = computed(() => {
  return asset.value?.attributes.assetType || DamAssetTypeDefault
})

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { authorRequired, authorEnabled } = useDamAuthorAssetTypeConfig(
  // eslint-disable-next-line vue/no-ref-object-reactivity-loss
  assetType.value,
  props.extSystem,
  damConfigName
)

const { getAuthorConflicts } = useAssetSuggestions()
const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors(damConfigName)

// DAM author suggestions for names read from the file, as the queue row card offers them.
// Taken from the asset itself, because nothing writes the store field.
// None in a read-only side panel, or when the authors field is disabled. Such an asset may still carry old suggestions.
const authorConflicts = computed<DocId[]>(() =>
  props.readonly || !authorEnabled.value || !asset.value
    ? []
    : getAuthorConflicts(asset.value.metadata.authorSuggestions ?? {})
)
// The chips show names from the configuration's cache, as the row's do. Without it a chip spins forever.
watch(
  authorConflicts,
  (conflicts) => {
    if (conflicts.length === 0) return
    addToCachedAuthors(conflicts)
    fetchCachedAuthors()
  },
  { immediate: true }
)

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

const { mainFileSingleUseEnabled, showFileInfoEnabled, editAssetLabel } = useCommonAdminCoreDamOptions(damConfigName)

const { addToCachedUsers, fetchCachedUsers } = useDamCachedUsers(damConfigName)
// The "file" panel chips show creator and modifier from the configuration's user cache.
// A picker click fills it only for the clicked asset.
// The "edit asset" detail of a widget or a queue row showed two chips spinning forever.
watch(
  [() => asset.value?.createdBy, () => asset.value?.modifiedBy],
  ([createdBy, modifiedBy]) => {
    if (!showFileInfoEnabled || (!createdBy && !modifiedBy)) return
    addToCachedUsers(createdBy, modifiedBy)
    fetchCachedUsers()
  },
  { immediate: true }
)
</script>

<template>
  <VBtn
    v-if="showEditButton && asset"
    size="small"
    class="ma-2"
    @click="emit('editInDam')"
  >
    {{ editAssetLabel }}
  </VBtn>
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
          :readonly="readonly"
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
                    v-model="asset.keywords"
                    :ext-system="extSystem"
                    :label="t('common.damImage.asset.model.keywords')"
                    data-cy="custom-field-keywords"
                    clearable
                    multiple
                    :disabled="readonly"
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
                    v-model="asset.authors"
                    :ext-system="extSystem"
                    :label="t('common.damImage.asset.model.authors')"
                    :author-conflicts="authorConflicts"
                    data-cy="custom-field-authors"
                    clearable
                    multiple
                    :disabled="readonly"
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
                <ARow
                  v-if="readonly"
                  :title="t('common.damImage.asset.model.mainFileSingleUse')"
                >
                  <ABooleanValue :value="mainFileSingleUse" />
                </ARow>
                <VSwitch
                  v-else
                  v-model="mainFileSingleUse"
                  :label="t('common.damImage.asset.model.mainFileSingleUse')"
                />
              </VCol>
            </VRow>
          </template>
        </AssetCustomMetadataForm>
      </VExpansionPanelText>
    </VExpansionPanel>
    <!-- The detail wraps text only between words, unlike its card (design 1.10, JS29). -->
    <AssetFileInfoPanel
      v-if="showFileInfoEnabled"
      :asset="asset"
      show-users
      style="overflow-wrap: normal"
    />
  </VExpansionPanels>
</template>
