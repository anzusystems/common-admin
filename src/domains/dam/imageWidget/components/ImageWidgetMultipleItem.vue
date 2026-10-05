<script lang="ts" setup>
import AImageWidgetSimple from '@/domains/dam/imageWidget/components/AImageWidgetSimple.vue'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import { computed, ref } from 'vue'
import AFormTextarea from '@/domains/form/components/AFormTextarea.vue'
import type { DocId } from '@/shared/types/common'
import { isNull, isUndefined } from '@/shared/utils/common'
import AActionDeleteButton from '@/domains/ui/buttons/action/components/AActionDeleteButton.vue'
import { useI18n } from 'vue-i18n'
import { AImageMetadataValidationScopeSymbol, useImageValidation } from '@/domains/dam/composables/uploadValidations'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import ASystemEntityScope from '@/domains/form/components/ASystemEntityScope.vue'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'

const props = withDefaults(
  defineProps<{
    index: number
    authorEnabled: boolean
    showSourceEnabled?: boolean
    sourceLabel?: string
    editAssetLabel?: string
    readonly?: boolean
    configName?: string
  }>(),
  {
    readonly: false,
    configName: 'default',
    showSourceEnabled: true,
    sourceLabel: undefined,
    editAssetLabel: undefined,
  }
)

const emit = defineEmits<{
  (e: 'editAsset', data: DocId): void
  (e: 'removeItem', index: number): void
}>()

const imageStore = useImageStore()
const { t } = useI18n()

const { cachedExtSystemId } = useExtSystemIdForCached()
const authorConflicts = ref<DocId[]>([])
// `index` comes from the parent's v-for over these same images.
const image = computed(() => imageStore.images[props.index]!)

const imageSourceRequired = computed(() => {
  if (isNull(image.value) || isUndefined(image.value)) return true
  return !(image.value.showDamAuthors && props.authorEnabled)
})

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
          :config-name="configName"
        />
        <VRow density="compact">
          <VCol class="d-flex justify-space-between mt-1">
            <VBtn
              v-if="!readonly"
              variant="text"
              size="small"
              class="mb-2"
              @click.stop="onEditAsset"
            >
              {{ editAssetLabel }}
            </VBtn>
            <AActionDeleteButton
              v-if="!readonly"
              variant="icon"
              :size="30"
              button-class=""
              @delete-record="removeItem"
            />
          </VCol>
        </VRow>
        <!-- `undefined`, not `false`, when editable: the fields then still follow a parent form's readonly and disabled. -->
        <VRow density="compact">
          <VCol>
            <AFormTextarea
              v-model="image.texts.description"
              :readonly="readonly || undefined"
              :label="t('common.damImage.image.model.texts.description')"
              :help="t('common.damImage.image.help.texts.description')"
              :v="v$.image?.texts.description"
            />
          </VCol>
        </VRow>
        <VRow
          v-if="image.showDamAuthors && authorEnabled"
          density="compact"
        >
          <VCol>
            <ASystemEntityScope
              subject="author"
              system="dam"
            >
              <AuthorRemoteAutocompleteWithCached
                v-model="image.damAuthors"
                :disabled="readonly || undefined"
                :ext-system="cachedExtSystemId"
                :label="t('common.damImage.asset.model.authors')"
                :author-conflicts="authorConflicts"
                data-cy="custom-field-authors"
                clearable
                multiple
                :validation-scope="AImageMetadataValidationScopeSymbol"
              />
            </ASystemEntityScope>
          </VCol>
        </VRow>
        <VRow
          v-else
          density="compact"
        >
          <VCol>
            <AFormTextarea
              v-model="image.texts.source"
              :readonly="readonly || undefined"
              :label="sourceLabel"
              :v="v$.image?.texts.source"
            />
          </VCol>
        </VRow>
        <VRow v-if="showSourceEnabled">
          <VCol>
            <VSwitch
              v-model="image.flags.showSource"
              :disabled="readonly || undefined"
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
