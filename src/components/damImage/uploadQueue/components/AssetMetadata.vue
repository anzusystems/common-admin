<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { computed, ref, watch } from 'vue'
import { DamAssetType, DamAssetTypeDefault } from '@/types/coreDam/Asset'
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
import ABooleanValue from '@/components/ABooleanValue.vue'
import ARow from '@/components/ARow.vue'
import ACachedUserChip from '@/components/ACachedUserChip.vue'
import ACachedChip from '@/components/ACachedChip.vue'
import { useDamCachedAssetLicences } from '@/components/damImage/composables/cachedDamAssetLicences'
import { useDamAssetAutoDelete } from '@/components/damImage/composables/damAssetAutoDelete'
import { useDamCachedUsers } from '@/components/damImage/uploadQueue/author/cachedUsers'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { resolveHolderName } from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'
import { isUndefined } from '@/utils/common'
import type { IntegerIdNullable } from '@/types/common'

const props = withDefaults(
  defineProps<{
    extSystem: IntegerId
    readonly?: boolean
    configName?: string
    showEditButton?: boolean
    // Known only by callers that have the widget's site-group upload licence (the editable "edit
    // asset" flow); when unset, single use keeps its previous editability instead of turning read-only.
    uploadLicence?: IntegerIdNullable | undefined
  }>(),
  {
    readonly: false,
    configName: 'default',
    showEditButton: false,
    uploadLicence: undefined,
  },
)

const emit = defineEmits<{
  (e: 'editInDam'): void
}>()

const { t } = useI18n()

const panels = ref(['metadata', 'file'])

const assetDetailStore = useAssetDetailStore()
const { asset, authorConflicts, metadataAreTouched, mainFileSingleUse } =
  storeToRefs(assetDetailStore)

const assetType = computed(() => {
  return asset.value?.attributes.assetType || DamAssetTypeDefault
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

const { cachedUsers } = useDamCachedUsers()

const { mainFileSingleUseEnabled, showFileInfoEnabled, editAssetLabel } =
  useCommonAdminCoreDamOptions(props.configName) // eslint-disable-line vue/no-setup-props-reactivity-loss

// Editable only for a file the site group's own redaction uploaded into its own upload licence —
// a take-over copy keeps the flag it arrived with, changing it would break the single-use exclusivity
// it was copied for (Q15, §9).
const singleUseEditable = computed(() => {
  if (isUndefined(props.uploadLicence)) return true
  if (!asset.value || asset.value.licence !== props.uploadLicence) return false
  const takenOverFromId = assetMainFile.value?.fileAttributes.takenOverFromId
  return isUndefined(takenOverFromId) || takenOverFromId === ''
})

// Empty string = held by nobody, which is also what an older payload without the field reads as.
const usedByHolderName = computed(() => {
  const resourceName = assetMainFile.value?.fileAttributes.usedByResourceName ?? ''
  return resourceName === '' ? '' : resolveHolderName(resourceName)
})

const { addToCachedAssetLicences, fetchCachedAssetLicences, getCachedAssetLicence } =
  useDamCachedAssetLicences()
const { autoDeleteAt, remainingDays } = useDamAssetAutoDelete()

watch(
  () => asset.value?.licence,
  (licence) => {
    if (isUndefined(licence)) return
    addToCachedAssetLicences(licence)
    fetchCachedAssetLicences()
  },
  { immediate: true },
)

const assetLicence = computed(() => {
  const licence = asset.value?.licence
  return isUndefined(licence) ? undefined : getCachedAssetLicence(licence)
})

// The cache answers with a placeholder until the licence arrives, so the flags are only shown once the
// real row is there — otherwise a licence that forbids direct use would read as if it allowed it.
const licenceFlagsKnown = computed(() => (assetLicence.value?.name ?? '') !== '')

const directUseAllowed = computed(() => assetLicence.value?.flags?.directUseAllowed ?? true)

const autoDeleteInDays = computed(() => {
  const licence = asset.value?.licence
  const createdAt = asset.value?.createdAt
  if (isUndefined(licence) || isUndefined(createdAt)) return null
  const deleteAt = autoDeleteAt(licence, createdAt)

  return deleteAt === null ? null : remainingDays(deleteAt)
})
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
                  v-if="readonly || !singleUseEditable"
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
            <VRow
              v-if="usedByHolderName"
              density="compact"
              class="my-2"
            >
              <VCol>
                <ARow :title="t('common.damImage.asset.model.usedBy')">
                  {{ usedByHolderName }}
                </ARow>
              </VCol>
            </VRow>
            <VRow
              v-if="licenceFlagsKnown"
              density="compact"
              class="my-2"
            >
              <VCol>
                <ARow :title="t('common.damImage.asset.model.directUseAllowed')">
                  <ABooleanValue :value="directUseAllowed" />
                </ARow>
              </VCol>
            </VRow>
            <VRow
              v-if="autoDeleteInDays !== null"
              density="compact"
              class="my-2"
            >
              <VCol>
                <ARow :title="t('common.damImage.asset.model.autoDelete')">
                  {{
                    t('common.damImage.asset.model.autoDeleteInDays', {
                      days: autoDeleteInDays,
                    })
                  }}
                </ARow>
              </VCol>
            </VRow>
          </template>
        </AssetCustomMetadataForm>
      </VExpansionPanelText>
    </VExpansionPanel>
    <VExpansionPanel
      v-if="showFileInfoEnabled"
      elevation="0"
      :title="t('common.damImage.asset.detail.info.file')"
      value="file"
    >
      <VExpansionPanelText
        class="text-body-small"
        style="overflow-wrap: normal"
      >
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
            {{ t('common.damImage.asset.detail.info.field.licence') }}
          </VCol>
          <VCol cols="9">
            <ACachedChip
              :id="asset.licence"
              :get-cached-fn="getCachedAssetLicence"
              display-text-path="name"
              route=""
              disable-click
            />
          </VCol>
        </VRow>
        <VRow>
          <VCol cols="3">
            {{ t('common.model.tracking.created') }}
          </VCol>
          <VCol cols="9">
            {{ dateTimePretty(asset.createdAt) }}<br />
            <ACachedUserChip
              :id="asset.createdBy"
              :cached-users="cachedUsers"
            />
          </VCol>
        </VRow>
        <VRow>
          <VCol cols="3">
            {{ t('common.model.tracking.modified') }}
          </VCol>
          <VCol cols="9">
            {{ dateTimePretty(asset.modifiedAt) }}<br />
            <ACachedUserChip
              :id="asset.modifiedBy"
              :cached-users="cachedUsers"
            />
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
