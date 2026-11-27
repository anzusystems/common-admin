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
import DamSourcesAuthorsFields from '@/domains/dam/author/components/DamSourcesAuthorsFields.vue'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const props = withDefaults(
  defineProps<{
    index: number
    authorEnabled: boolean
    sourceEnabled: boolean
    showSourceEnabled?: boolean
    sourceLabel?: string
    editAssetLabel?: string
    readonly?: boolean
    configName?: string
  }>(),
  {
    readonly: false,
    configName: undefined,
    showSourceEnabled: true,
    sourceLabel: undefined,
    editAssetLabel: undefined,
  }
)

const emit = defineEmits<{
  (e: 'editAsset', data: DocId): void
  (e: 'removeItem', index: number): void
}>()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const imageStore = useImageStore()
const { t } = useI18n()

const { cachedExtSystemId } = useExtSystemIdForCached(damConfigName)
const authorConflicts = ref<DocId[]>([])
// `index` comes from the parent's v-for over these same images.
const image = computed(() => imageStore.images[props.index]!)

const { getDamConfigExtSystem } = useDamConfigState(undefined, damConfigName)
const imageConfig = computed(() => getDamConfigExtSystem(cachedExtSystemId.value)?.[DamAssetType.Image])

const showDamSelection = computed(() => {
  if (isNull(image.value) || isUndefined(image.value)) return false
  return image.value.showDamAuthors && (props.sourceEnabled || props.authorEnabled)
})

const imageSourceRequired = computed(() => !showDamSelection.value)

const { v$ } = useImageValidation(image, imageSourceRequired, damConfigName)

const onEditAsset = () => {
  if (isNull(image.value) || isUndefined(image.value)) return
  emit('editAsset', image.value.dam.damId)
}

const removeItem = () => {
  emit('removeItem', props.index)
}

// A typed source belongs to the user, not to a pick. This holds even when the text equals the names a pick wrote.
const onSourceTyped = () => {
  if (isNull(image.value) || isUndefined(image.value)) return
  imageStore.forgetSourceOfPick(image.value)
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
          :config-name="damConfigName"
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
        <DamSourcesAuthorsFields
          v-if="showDamSelection"
          v-model:sources="image.damSources"
          v-model:authors="image.damAuthors"
          :disabled="readonly"
          :ext-system="cachedExtSystemId"
          :source-enabled="sourceEnabled"
          :author-enabled="authorEnabled"
          :source-required="!!imageConfig?.sources?.required"
          :author-required="!!imageConfig?.authors?.required"
          :validation-scope="AImageMetadataValidationScopeSymbol"
          :author-conflicts="authorConflicts"
          show-credit
          :credit-label="sourceLabel"
        />
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
              @update:model-value="onSourceTyped"
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
