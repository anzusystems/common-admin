<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import ASystemEntityScope from '@/domains/form/components/ASystemEntityScope.vue'
import AssetCustomMetadataFormMassOperations from '@/domains/dam/uploadQueue/components/AssetCustomMetadataFormMassOperations.vue'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import type { IntegerId } from '@/shared/types/common'
import type { CustomDataValue } from '@/domains/customDataForm/types/CustomDataForm'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import {
  type UploadQueueMassOperationsBinding,
  useLibraryUploadQueueMassOperationsBinding,
} from '@/domains/dam/uploadQueue/components/uploadQueueBindings'

const props = withDefaults(
  defineProps<{
    queueKey: UploadQueueKey
    extSystem: IntegerId
    /** What the mass operations ask of their host; without it the library's store. */
    operations?: UploadQueueMassOperationsBinding
  }>(),
  {
    operations: undefined,
  }
)

const massOperationsData = ref<Record<'image' | 'video' | 'audio' | 'document', Record<string, CustomDataValue>>>({
  image: {},
  video: {},
  audio: {},
  document: {},
})
const massOperationsKeywords = ref([])
const massOperationsAuthors = ref([])

const { t } = useI18n()

// The two icon buttons beside a field, named for who cannot see them: what each does, and to which field.
const fillEmptyName = (field: string) => t('common.damImage.asset.massOperations.fillOneEmptyField', { field })
const replaceName = (field: string) => t('common.damImage.asset.massOperations.replaceOneField', { field })

const panels = ref<Array<string>>(['general'])

// Created only when the host binds none.
const operations = props.operations ?? useLibraryUploadQueueMassOperationsBinding(() => props.queueKey)

const fillEmptyField = (data: { assetType: DamAssetTypeType; elementProperty: string; value: any }) => {
  operations.fillCustomDataValue(data)
}
const replaceField = (data: { assetType: DamAssetTypeType; elementProperty: string; value: any }) => {
  operations.fillCustomDataValue(data, true)
}
const fillEmptyKeywords = () => {
  operations.fillKeywords(massOperationsKeywords.value)
}
const replaceKeywords = () => {
  operations.fillKeywords(massOperationsKeywords.value, true)
}
const fillEmptyAuthors = () => {
  operations.fillAuthors(massOperationsAuthors.value)
}
const replaceAuthors = () => {
  operations.fillAuthors(massOperationsAuthors.value, true)
}
const fillAll = (forceReplace = false) => {
  for (const [elementProperty, value] of Object.entries(massOperationsData.value.image)) {
    operations.fillCustomDataValue(
      {
        assetType: DamAssetType.Image,
        elementProperty,
        value,
      },
      forceReplace
    )
  }
  for (const [elementProperty, value] of Object.entries(massOperationsData.value.video)) {
    operations.fillCustomDataValue(
      {
        assetType: DamAssetType.Video,
        elementProperty,
        value,
      },
      forceReplace
    )
  }
  for (const [elementProperty, value] of Object.entries(massOperationsData.value.audio)) {
    operations.fillCustomDataValue(
      {
        assetType: DamAssetType.Audio,
        elementProperty,
        value,
      },
      forceReplace
    )
  }
  for (const [elementProperty, value] of Object.entries(massOperationsData.value.document)) {
    operations.fillCustomDataValue(
      {
        assetType: DamAssetType.Document,
        elementProperty,
        value,
      },
      forceReplace
    )
  }
  if (authorEnabled.value) {
    forceReplace ? replaceAuthors() : fillEmptyAuthors()
  }
  if (keywordEnabled.value) {
    forceReplace ? replaceKeywords() : fillEmptyKeywords()
  }
}
const clearForm = () => {
  massOperationsData.value = { image: {}, video: {}, audio: {}, document: {} }
  massOperationsAuthors.value = []
  massOperationsKeywords.value = []
}

const assetTypes = computed(() => {
  return operations.assetTypes()
})

const { getDamConfigExtSystem } = useDamConfigState()

const keywordEnabled = computed(() => {
  const config = getDamConfigExtSystem(props.extSystem)
  if (!config) return false
  return assetTypes.value.some((type) => !!config[type]?.keywords?.enabled)
})

const authorEnabled = computed(() => {
  const config = getDamConfigExtSystem(props.extSystem)
  if (!config) return false
  return assetTypes.value.some((type) => !!config[type]?.authors?.enabled)
})

onMounted(() => {
  if (assetTypes.value[0]) {
    panels.value.push(assetTypes.value[0])
  }
})
</script>

<template>
  <div class="sidebar-info d-flex w-100 h-100 flex-column">
    <div class="w-100 d-flex flex-column">
      <VTabs class="sidebar-info__tabs">
        <VTab>{{ t('common.damImage.asset.massOperations.title') }}</VTab>
      </VTabs>
      <div class="sidebar-info__content">
        <div class="text-body-small pa-3">
          {{ t('common.damImage.asset.massOperations.description') }}
        </div>
        <VExpansionPanels
          v-model="panels"
          multiple
          class="v-expansion-panels--compact"
        >
          <VExpansionPanel
            v-if="keywordEnabled || authorEnabled"
            elevation="0"
            :title="t('common.damImage.asset.massOperations.general')"
            value="general"
          >
            <VExpansionPanelText>
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
                    <div class="d-flex">
                      <div style="min-width: 286px">
                        <KeywordRemoteAutocompleteWithCached
                          v-model="massOperationsKeywords"
                          :label="t('common.damImage.asset.model.keywords')"
                          clearable
                          :ext-system="extSystem"
                          multiple
                          :validation-scope="false"
                        />
                      </div>
                      <VBtn
                        :aria-label="fillEmptyName(t('common.damImage.asset.model.keywords'))"
                        icon
                        size="small"
                        variant="text"
                        class="mr-1"
                        @click.stop="fillEmptyKeywords"
                      >
                        <VIcon icon="mdi-file-arrow-left-right-outline" />
                        <VTooltip
                          activator="parent"
                          location="bottom"
                        >
                          {{ t('common.damImage.asset.massOperations.fillOneEmpty') }}
                        </VTooltip>
                      </VBtn>
                      <VBtn
                        :aria-label="replaceName(t('common.damImage.asset.model.keywords'))"
                        icon
                        size="small"
                        variant="text"
                        @click.stop="replaceKeywords"
                      >
                        <VIcon icon="mdi-file-replace-outline" />
                        <VTooltip
                          activator="parent"
                          location="bottom"
                        >
                          {{ t('common.damImage.asset.massOperations.replaceOne') }}
                        </VTooltip>
                      </VBtn>
                    </div>
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
                    <div class="d-flex">
                      <div style="min-width: 286px">
                        <AuthorRemoteAutocompleteWithCached
                          v-model="massOperationsAuthors"
                          :label="t('common.damImage.asset.model.authors')"
                          :ext-system="extSystem"
                          clearable
                          multiple
                          :validation-scope="false"
                        />
                      </div>
                      <VBtn
                        :aria-label="fillEmptyName(t('common.damImage.asset.model.authors'))"
                        icon
                        size="small"
                        variant="text"
                        class="mr-1"
                        @click.stop="fillEmptyAuthors"
                      >
                        <VIcon icon="mdi-file-arrow-left-right-outline" />
                        <VTooltip
                          activator="parent"
                          location="bottom"
                        >
                          {{ t('common.damImage.asset.massOperations.fillOneEmpty') }}
                        </VTooltip>
                      </VBtn>
                      <VBtn
                        :aria-label="replaceName(t('common.damImage.asset.model.authors'))"
                        icon
                        size="small"
                        variant="text"
                        @click.stop="replaceAuthors"
                      >
                        <VIcon icon="mdi-file-replace-outline" />
                        <VTooltip
                          activator="parent"
                          location="bottom"
                        >
                          {{ t('common.damImage.asset.massOperations.replaceOne') }}
                        </VTooltip>
                      </VBtn>
                    </div>
                  </ASystemEntityScope>
                </VCol>
              </VRow>
            </VExpansionPanelText>
          </VExpansionPanel>
          <VExpansionPanel
            v-if="assetTypes.includes(DamAssetType.Image)"
            elevation="0"
            :title="t('common.damImage.asset.assetType.image')"
            :value="DamAssetType.Image"
          >
            <VExpansionPanelText>
              <AssetCustomMetadataFormMassOperations
                v-model="massOperationsData.image"
                :asset-type="DamAssetType.Image"
                :ext-system="extSystem"
                @fill-empty-field="fillEmptyField"
                @replace-field="replaceField"
              />
            </VExpansionPanelText>
          </VExpansionPanel>
          <VExpansionPanel
            v-if="assetTypes.includes(DamAssetType.Video)"
            elevation="0"
            :title="t('common.damImage.asset.assetType.video')"
            :value="DamAssetType.Video"
          >
            <VExpansionPanelText>
              <AssetCustomMetadataFormMassOperations
                v-model="massOperationsData.video"
                :asset-type="DamAssetType.Video"
                :ext-system="extSystem"
                @fill-empty-field="fillEmptyField"
                @replace-field="replaceField"
              />
            </VExpansionPanelText>
          </VExpansionPanel>
          <VExpansionPanel
            v-if="assetTypes.includes(DamAssetType.Audio)"
            elevation="0"
            :title="t('common.damImage.asset.assetType.audio')"
            :value="DamAssetType.Audio"
          >
            <VExpansionPanelText>
              <AssetCustomMetadataFormMassOperations
                v-model="massOperationsData.audio"
                :asset-type="DamAssetType.Audio"
                :ext-system="extSystem"
                @fill-empty-field="fillEmptyField"
                @replace-field="replaceField"
              />
            </VExpansionPanelText>
          </VExpansionPanel>
          <VExpansionPanel
            v-if="assetTypes.includes(DamAssetType.Document)"
            elevation="0"
            :title="t('common.damImage.asset.assetType.document')"
            :value="DamAssetType.Document"
          >
            <VExpansionPanelText>
              <AssetCustomMetadataFormMassOperations
                v-model="massOperationsData.document"
                :asset-type="DamAssetType.Document"
                :ext-system="extSystem"
                @fill-empty-field="fillEmptyField"
                @replace-field="replaceField"
              />
            </VExpansionPanelText>
          </VExpansionPanel>
        </VExpansionPanels>
      </div>
      <div class="sidebar-info__actions pa-2 d-flex align-center justify-center">
        <VBtn
          class="mr-2"
          variant="text"
          size="small"
          @click.stop="fillAll(false)"
        >
          {{ t('common.damImage.asset.massOperations.fillAllEmpty') }}
        </VBtn>
        <VBtn
          class="mr-2"
          variant="text"
          size="small"
          @click.stop="fillAll(true)"
        >
          {{ t('common.damImage.asset.massOperations.replaceAll') }}
        </VBtn>
        <VBtn
          variant="text"
          size="small"
          @click.stop="clearForm"
        >
          {{ t('common.damImage.asset.massOperations.clearForm') }}
        </VBtn>
      </div>
    </div>
  </div>
</template>
