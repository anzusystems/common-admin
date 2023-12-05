<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import { DamAssetType } from '@/types/coreDam/Asset'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import AssetCustomMetadataFormMassOperations from '@/components/damImage/uploadQueue/components/AssetCustomMetadataFormMassOperations.vue'
import AuthorRemoteAutocompleteWithCached from '@/components/damImage/uploadQueue/author/AuthorRemoteAutocompleteWithCached.vue'
import KeywordRemoteAutocompleteWithCached from '@/components/damImage/uploadQueue/keyword/KeywordRemoteAutocompleteWithCached.vue'
import { useUploadQueueMassOperations } from '@/components/damImage/uploadQueue/composables/uploadQueueMassOperations'

const props = withDefaults(
  defineProps<{
    queueKey: string
  }>(),
  {}
)

const massOperationsData = ref({ image: {}, video: {}, audio: {}, document: {} })
const massOperationsKeywords = ref([])
const massOperationsAuthors = ref([])

const { t } = useI18n()

const panels = ref<Array<string>>(['general'])

const uploadQueuesStore = useUploadQueuesStore()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { replaceEmptyCustomDataValue, replaceEmptyAuthors, replaceEmptyKeywords } = useUploadQueueMassOperations(
  props.queueKey
)

const fillEmptyField = (data: { assetType: DamAssetType; elementProperty: string; value: any }) => {
  replaceEmptyCustomDataValue(data)
}
const replaceField = (data: { assetType: DamAssetType; elementProperty: string; value: any }) => {
  replaceEmptyCustomDataValue(data, true)
}
const fillEmptyKeywords = () => {
  replaceEmptyKeywords(massOperationsKeywords.value)
}
const replaceKeywords = () => {
  replaceEmptyKeywords(massOperationsKeywords.value, true)
}
const fillEmptyAuthors = () => {
  replaceEmptyAuthors(massOperationsAuthors.value)
}
const replaceAuthors = () => {
  replaceEmptyAuthors(massOperationsAuthors.value, true)
}
const fillAll = (forceReplace = false) => {
  for (const [elementProperty, value] of Object.entries(massOperationsData.value.image)) {
    replaceEmptyCustomDataValue(
      {
        assetType: DamAssetType.Image,
        elementProperty,
        value,
      },
      forceReplace
    )
  }
  for (const [elementProperty, value] of Object.entries(massOperationsData.value.video)) {
    replaceEmptyCustomDataValue(
      {
        assetType: DamAssetType.Video,
        elementProperty,
        value,
      },
      forceReplace
    )
  }
  for (const [elementProperty, value] of Object.entries(massOperationsData.value.audio)) {
    replaceEmptyCustomDataValue(
      {
        assetType: DamAssetType.Audio,
        elementProperty,
        value,
      },
      forceReplace
    )
  }
  for (const [elementProperty, value] of Object.entries(massOperationsData.value.document)) {
    replaceEmptyCustomDataValue(
      {
        assetType: DamAssetType.Document,
        elementProperty,
        value,
      },
      forceReplace
    )
  }
  if (forceReplace) {
    replaceAuthors()
    replaceKeywords()
    return
  }
  fillEmptyAuthors()
  fillEmptyKeywords()
}
const clearForm = () => {
  massOperationsData.value = { image: {}, video: {}, audio: {}, document: {} }
  massOperationsAuthors.value = []
  massOperationsKeywords.value = []
}

const assetTypes = computed(() => {
  return uploadQueuesStore.getQueueItemsTypes(props.queueKey)
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
        <div class="text-caption pa-3">
          {{ t('common.damImage.asset.massOperations.description') }}
        </div>
        <VExpansionPanels
          v-model="panels"
          multiple
          class="v-expansion-panels--compact"
        >
          <VExpansionPanel
            elevation="0"
            :title="t('common.damImage.asset.massOperations.general')"
            value="general"
          >
            <VExpansionPanelText>
              <VRow
                dense
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
                          multiple
                          :validation-scope="false"
                        />
                      </div>
                      <VBtn
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
                dense
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
                          clearable
                          multiple
                          :validation-scope="false"
                        />
                      </div>
                      <VBtn
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
