<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { type AssetDetailItemDto, DamAssetType, DamAssetTypeDefault } from '@/domains/dam/types/Asset'
import { assetFileIsImageFile } from '@/domains/dam/types/AssetFile'
import ACopyText from '@/domains/ui/components/ACopyText.vue'
import { prettyBytes } from '@/shared/utils/file'
import AssetMetadataImageAttributes from '@/domains/dam/assetDetail/components/AssetMetadataImageAttributes.vue'
import { dateTimePretty } from '@/shared/utils/datetime'
import ACachedUserChip from '@/domains/cached/components/ACachedUserChip.vue'
import { useDamCachedUsers } from '@/domains/dam/author/composables/cachedUsers'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

// The panel "file" of the metadata of the detail of an asset and of the dialog of a single upload. No overflow-wrap
// of its own: the detail passes `style="overflow-wrap: normal"`, which falls through to its root.

const props = defineProps<{
  asset: AssetDetailItemDto
  /** Who created and who changed the asset, by their chips. */
  showUsers: boolean
}>()

const { t } = useI18n()

const isTypeImage = computed(() => (props.asset.attributes.assetType || DamAssetTypeDefault) === DamAssetType.Image)

const { getCachedUser } = useDamCachedUsers(useDamConfigName())
</script>

<template>
  <VExpansionPanel
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
          <template v-if="showUsers">
            <br />
            <ACachedUserChip
              :id="asset.createdBy"
              :get-cached-fn="getCachedUser"
            />
          </template>
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="3">
          {{ t('common.model.tracking.modified') }}
        </VCol>
        <VCol cols="9">
          {{ dateTimePretty(asset.modifiedAt) }}
          <template v-if="showUsers">
            <br />
            <ACachedUserChip
              :id="asset.modifiedBy"
              :get-cached-fn="getCachedUser"
            />
          </template>
        </VCol>
      </VRow>
      <template v-if="asset.mainFile">
        <VRow>
          <VCol cols="3">
            {{ t('common.damImage.asset.detail.info.field.mainFileId') }}
          </VCol>
          <VCol cols="9">
            <ACopyText :value="asset.mainFile.id" />
          </VCol>
        </VRow>
        <VRow>
          <VCol cols="3">
            {{ t('common.damImage.asset.detail.info.field.mimeType') }}
          </VCol>
          <VCol cols="9">
            {{ asset.mainFile.fileAttributes.mimeType }}
          </VCol>
        </VRow>
        <VRow>
          <VCol cols="3">
            {{ t('common.damImage.asset.detail.info.field.size') }}
          </VCol>
          <VCol cols="9">
            {{ prettyBytes(asset.mainFile.fileAttributes.size) }}
          </VCol>
        </VRow>
        <AssetMetadataImageAttributes
          v-if="isTypeImage && assetFileIsImageFile(asset.mainFile)"
          :file="asset.mainFile"
        />
      </template>
    </VExpansionPanelText>
  </VExpansionPanel>
</template>
