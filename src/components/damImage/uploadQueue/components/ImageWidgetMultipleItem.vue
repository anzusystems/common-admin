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
import AuthorRemoteAutocompleteWithCached from '@/components/damImage/uploadQueue/author/AuthorRemoteAutocompleteWithCached.vue'
import type { DamAuthor } from '@/components/damImage/uploadQueue/author/DamAuthor'
import { useAlerts } from '@/composables/system/alerts'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { fetchDamCredit } from '@/components/damImage/uploadQueue/composables/damCredit'
import DamSourcesAuthorsRow from '@/components/damImage/uploadQueue/components/DamSourcesAuthorsRow.vue'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
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

const { damClient } = useCommonAdminCoreDamOptions()
const { showErrorsDefault } = useAlerts()
let creditRequestId = 0

const onSelectionChange = async () => {
  const target = image.value
  target.damSelectionChanged = true
  const requestId = ++creditRequestId
  try {
    const credit = await fetchDamCredit(
      damClient,
      cachedExtSystemId.value,
      target.damSources,
      target.damAuthors,
    )
    if (requestId !== creditRequestId) return
    target.texts.source = credit
  } catch (e) {
    showErrorsDefault(e)
  }
}

const onSourceFound = (author: DamAuthor) => {
  if (image.value.damSources.includes(author.id)) return
  image.value.damSources = [...image.value.damSources, author.id]
  onSelectionChange()
}

const onAuthorFound = (author: DamAuthor) => {
  if (image.value.damAuthors.includes(author.id)) return
  image.value.damAuthors = [...image.value.damAuthors, author.id]
  onSelectionChange()
}

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
        <DamSourcesAuthorsRow
          v-if="showDamSelection"
          :source-enabled="sourceEnabled"
          :author-enabled="authorEnabled"
          :credit="image.texts.source"
          :credit-label="sourceLabel"
        >
          <template #sources>
            <ASystemEntityScope
              subject="author"
              system="dam"
            >
              <AuthorRemoteAutocompleteWithCached
                v-model="image.damSources"
                :ext-system="cachedExtSystemId"
                :label="t('common.damImage.asset.model.sources')"
                data-cy="custom-field-sources"
                :required="!!imageConfig?.sources.required"
                source
                clearable
                multiple
                :validation-scope="AImageMetadataValidationScopeSymbol"
                @update:model-value="onSelectionChange"
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
                v-model="image.damAuthors"
                :ext-system="cachedExtSystemId"
                :label="t('common.damImage.asset.model.authors')"
                :author-conflicts="authorConflicts"
                data-cy="custom-field-authors"
                :required="!!imageConfig?.authors?.required"
                :source="sourceEnabled ? false : undefined"
                clearable
                multiple
                :validation-scope="AImageMetadataValidationScopeSymbol"
                @update:model-value="onSelectionChange"
                @source-found="onSourceFound"
              />
            </ASystemEntityScope>
          </template>
        </DamSourcesAuthorsRow>
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
