<script lang="ts" setup>
import AImageWidgetSimple from '@/components/damImage/AImageWidgetSimple.vue'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import { computed, ref } from 'vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import type { DocId } from '@/types/common'
import { isNull, isUndefined } from '@/utils/common'
import AActionDeleteButton from '@/components/buttons/action/AActionDeleteButton.vue'
import { useI18n } from 'vue-i18n'
import {
  AImageMetadataValidationScopeSymbol,
  useImageValidation,
} from '@/components/damImage/uploadQueue/composables/uploadValidations'
import { useDamCachedAuthors } from '@/components/damImage/uploadQueue/author/cachedAuthors'
import { useDamCreditPreview } from '@/components/damImage/uploadQueue/composables/damCredit'
import DamSourcesAuthorsFields from '@/components/damImage/uploadQueue/components/DamSourcesAuthorsFields.vue'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { DamAssetType } from '@/types/coreDam/Asset'

const props = withDefaults(
  defineProps<{
    index: number
    authorEnabled: boolean
    sourceEnabled: boolean
    showSourceEnabled?: boolean
    sourceLabel?: string
    editAssetLabel?: string
  }>(),
  {
    showSourceEnabled: true,
    sourceLabel: undefined,
    editAssetLabel: undefined,
  },
)

const emit = defineEmits<{
  (e: 'editAsset', data: DocId): void
  (e: 'removeItem', index: number): void
}>()

const imageStore = useImageStore()
const { t } = useI18n()

const { cachedExtSystemId } = useExtSystemIdForCached()
const authorConflicts = ref<DocId[]>([])
const image = computed(() => imageStore.images[props.index])

const { getCachedAuthor } = useDamCachedAuthors()
const credit = useDamCreditPreview(
  getCachedAuthor,
  cachedExtSystemId,
  () => image.value.damSources,
  () => image.value.damAuthors,
)

const { getDamConfigExtSystem } = useDamConfigState()
const imageConfig = computed(
  () => getDamConfigExtSystem(cachedExtSystemId.value)?.[DamAssetType.Image],
)

const showDamSelection = computed(
  () => !!image.value?.showDamAuthors && (props.sourceEnabled || props.authorEnabled),
)

const imageSourceRequired = computed(() => !showDamSelection.value)

const { v$ } = useImageValidation(image, imageSourceRequired)

const onEditAsset = () => {
  if (isNull(image.value) || isUndefined(image.value)) return
  emit('editAsset', image.value.dam.damId)
}

const removeItem = () => {
  emit('removeItem', props.index)
}
</script>

<template>
  <div class="asset-list-tiles__item">
    <div class="asset-list-tiles__item-card">
      <div class="ma-2">
        <!-- No reorder controls here: the grid is `#view-body`, which SortableJS never binds to.
             Reordering lives in reorder mode. -->
        <AImageWidgetSimple
          :model-value="image.id"
          :image="image"
        />
        <VRow density="compact">
          <VCol class="d-flex justify-space-between mt-1">
            <VBtn
              variant="text"
              size="small"
              class="mb-2"
              @click.stop="onEditAsset"
            >
              {{ editAssetLabel }}
            </VBtn>
            <AActionDeleteButton
              variant="icon"
              :size="30"
              button-class=""
              @delete-record="removeItem"
            />
          </VCol>
        </VRow>
        <VRow density="compact">
          <VCol>
            <AFormTextarea
              v-model="image.texts.description"
              :label="t('common.damImage.image.model.texts.description')"
              :help="t('common.damImage.image.help.texts.description')"
              :v="v$.image?.texts.description"
            />
          </VCol>
        </VRow>
        <DamSourcesAuthorsFields
          v-if="showDamSelection"
          v-model:sources="image.damSources"
          v-model:authors="image.damAuthors"
          :ext-system="cachedExtSystemId"
          :source-enabled="sourceEnabled"
          :author-enabled="authorEnabled"
          :source-required="!!imageConfig?.sources.required"
          :author-required="!!imageConfig?.authors?.required"
          :validation-scope="AImageMetadataValidationScopeSymbol"
          :author-conflicts="authorConflicts"
          :credit="credit"
          :credit-label="sourceLabel"
          @change="image.damSelectionChanged = true"
        />
        <VRow
          v-else
          density="comfortable"
        >
          <VCol>
            <AFormTextarea
              v-model="image.texts.source"
              :label="sourceLabel"
              :v="v$.image?.texts.source"
            />
          </VCol>
        </VRow>
        <VRow v-if="showSourceEnabled">
          <VCol>
            <VSwitch
              v-model="image.flags.showSource"
              :label="t('common.damImage.image.model.flags.showSource')"
              density="compact"
              hide-details
            />
          </VCol>
        </VRow>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.asset-list-tiles--thumbnail.a-sortable-widget__group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  .asset-list-tiles__item {
    flex: 1 1 260px;
    min-width: 260px;
    max-width: 400px;

    img:not(.img-svg) {
      padding: 0;
    }
  }
}
</style>
