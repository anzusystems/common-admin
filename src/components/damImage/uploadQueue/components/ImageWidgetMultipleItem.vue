<script lang="ts" setup>
import AImageWidgetSimple from '@/components/damImage/AImageWidgetSimple.vue'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import { computed, ref } from 'vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import type { DocId } from '@/types/common'
import { isNull, isUndefined } from '@/utils/common'
import AActionDeleteButton from '@/components/buttons/action/AActionDeleteButton.vue'
import { HANDLE_CLASS } from '@/components/sortable/sortableActions'
import { useI18n } from 'vue-i18n'
import {
  AImageMetadataValidationScopeSymbol,
  useImageValidation,
} from '@/components/damImage/uploadQueue/composables/uploadValidations'
import AuthorRemoteAutocompleteWithCached from '@/components/damImage/uploadQueue/author/AuthorRemoteAutocompleteWithCached.vue'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'

const props = withDefaults(
  defineProps<{
    index: number
    disableDraggable: boolean
  }>(),
  {}
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
const imageSourceRequired = computed(() => {
  if (isNull(image.value) || isUndefined(image.value)) return true
  return image.value.showDamAuthors === false
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
        <div class="d-flex justify-md-space-between align-center">
          <VIcon
            :class="{
              [HANDLE_CLASS]: true,
              [HANDLE_CLASS + '--disabled']: disableDraggable,
            }"
            icon="mdi-drag"
          />
        </div>
        <AImageWidgetSimple
          :model-value="image.id"
          :image="image"
          disable-random
        />
        <VRow dense>
          <VCol class="d-flex justify-space-between mt-1">
            <VBtn
              variant="text"
              size="small"
              class="mb-2"
              @click.stop="onEditAsset"
            >
              {{ t('common.damImage.queueItem.edit') }}
            </VBtn>
            <AActionDeleteButton
              variant="icon"
              :size="30"
              button-class=""
              @delete-record="removeItem"
            />
          </VCol>
        </VRow>
        <VRow dense>
          <VCol>
            <AFormTextarea
              v-model="image.texts.description"
              :label="t('common.damImage.image.model.texts.description')"
              :help="t('common.damImage.image.help.texts.description')"
              :v="v$.image?.texts.description"
            />
          </VCol>
        </VRow>
        <VRow
          v-if="image.showDamAuthors"
          dense
        >
          <VCol>
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
                clearable
                multiple
                :validation-scope="AImageMetadataValidationScopeSymbol"
              />
            </ASystemEntityScope>
          </VCol>
        </VRow>
        <VRow
          v-else
          dense
        >
          <VCol>
            <AFormTextarea
              v-model="image.texts.source"
              :label="t('common.damImage.image.model.texts.source')"
              :v="v$.image?.texts.source"
            />
          </VCol>
        </VRow>
        <VRow>
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
