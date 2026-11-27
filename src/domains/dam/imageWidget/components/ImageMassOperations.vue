<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useImageMassOperations } from '@/domains/dam/imageWidget/composables/useImageMassOperations'
import AFormTextarea from '@/domains/form/components/AFormTextarea.vue'
import { computed, ref } from 'vue'
import useVuelidate from '@vuelidate/core'
import { useValidate } from '@/shared/validators/vuelidate/useValidate'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import DamSourcesAuthorsFields from '@/domains/dam/author/components/DamSourcesAuthorsFields.vue'
import type { DocId } from '@/shared/types/common'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { storeToRefs } from 'pinia'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { buildFieldRules } from '@/domains/dam/composables/uploadValidations'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

const props = withDefaults(
  defineProps<{
    /** DAM configuration to use. Defaults to the parent component's, else `default`. */
    configName?: string
  }>(),
  {
    configName: undefined,
  }
)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const texts = ref<{ description: string; source: string; authors: DocId[]; sources: DocId[] }>({
  description: '',
  source: '',
  authors: [],
  sources: [],
})

const imageStore = useImageStore()
const { images, readonly } = storeToRefs(imageStore)
const {
  replaceEmptyDescription,
  replaceEmptySource,
  replaceEmptyAuthors,
  replaceEmptySources,
  replaceEmptySelections,
} = useImageMassOperations(damConfigName)
const { t } = useI18n()
const { showErrorsDefault } = useAlerts()

// Accessible names for the two icon buttons beside a field: the action and the field.
const fillEmptyName = (field: string) => t('common.damImage.asset.massOperations.fillOneEmptyField', { field })
const replaceName = (field: string) => t('common.damImage.asset.massOperations.replaceOneField', { field })

// Names are looked up first. Nothing is filled if the lookup fails.
const fillAuthors = async (forceReplace: boolean) => {
  try {
    await replaceEmptyAuthors(texts.value.authors, forceReplace)
  } catch (error) {
    showErrorsDefault(error)
  }
}

const fillSources = async (forceReplace: boolean) => {
  try {
    await replaceEmptySources(texts.value.sources, forceReplace)
  } catch (error) {
    showErrorsDefault(error)
  }
}

const fillAll = async (forceReplace: boolean) => {
  replaceEmptyDescription(texts.value.description, forceReplace)
  if (!showDamFields.value) {
    replaceEmptySource(texts.value.source, forceReplace)
    return
  }
  // Both at once: a row takes each pick as it would alone, and its source the credit of both.
  try {
    await replaceEmptySelections(
      {
        ...(sourceEnabled.value ? { damSources: texts.value.sources } : {}),
        ...(authorEnabled.value ? { damAuthors: texts.value.authors } : {}),
      },
      forceReplace
    )
  } catch (error) {
    showErrorsDefault(error)
  }
}

const clearForm = () => {
  texts.value.description = ''
  if (!showDamFields.value) {
    texts.value.source = ''
    return
  }
  if (authorEnabled.value) texts.value.authors = []
  if (sourceEnabled.value) texts.value.sources = []
}

const { cachedExtSystemId } = useExtSystemIdForCached(damConfigName)

const { getDamConfigExtSystem } = useDamConfigState(undefined, damConfigName)

const authorEnabled = computed(() => {
  return !!getDamConfigExtSystem(cachedExtSystemId.value)?.[DamAssetType.Image]?.authors?.enabled
})

const sourceEnabled = computed(() => {
  return !!getDamConfigExtSystem(cachedExtSystemId.value)?.[DamAssetType.Image]?.sources?.enabled
})

const { descriptionValidation, sourceValidation, sourceLabel } = useCommonAdminCoreDamOptions(damConfigName)
const validators = useValidate()

const rules = computed(() => ({
  texts: {
    description: buildFieldRules(descriptionValidation, validators),
    source: buildFieldRules(sourceValidation, validators),
  },
}))
const v$ = useVuelidate(rules, { texts }, { $scope: false })

// Sources and authors instead of the source, when the ext system has either and a row offers the pick.
const showDamFields = computed(
  () => (authorEnabled.value || sourceEnabled.value) && images.value.some((item) => item?.showDamAuthors)
)
</script>

<template>
  <div
    v-if="!readonly"
    class="w-100"
  >
    <VRow
      density="compact"
      class="mt-4"
    >
      <VCol>
        <div class="d-flex">
          <AFormTextarea
            v-model="texts.description"
            :v="v$"
            :label="t('common.damImage.image.model.texts.description')"
          />
          <VBtn
            :aria-label="fillEmptyName(t('common.damImage.image.model.texts.description'))"
            icon
            size="small"
            variant="text"
            class="mr-1"
            @click.stop="replaceEmptyDescription(texts.description, false)"
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
            :aria-label="replaceName(t('common.damImage.image.model.texts.description'))"
            icon
            size="small"
            variant="text"
            @click.stop="replaceEmptyDescription(texts.description, true)"
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
      </VCol>
    </VRow>
    <DamSourcesAuthorsFields
      v-if="showDamFields"
      v-model:sources="texts.sources"
      v-model:authors="texts.authors"
      :ext-system="cachedExtSystemId"
      :source-enabled="sourceEnabled"
      :author-enabled="authorEnabled"
      :validation-scope="false"
      class="mt-4"
    >
      <template #sources-append>
        <VBtn
          :aria-label="fillEmptyName(t('common.damImage.asset.model.sources'))"
          icon
          size="small"
          variant="text"
          class="mr-1"
          @click.stop="fillSources(false)"
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
          :aria-label="replaceName(t('common.damImage.asset.model.sources'))"
          icon
          size="small"
          variant="text"
          @click.stop="fillSources(true)"
        >
          <VIcon icon="mdi-file-replace-outline" />
          <VTooltip
            activator="parent"
            location="bottom"
          >
            {{ t('common.damImage.asset.massOperations.replaceOne') }}
          </VTooltip>
        </VBtn>
      </template>
      <template #authors-append>
        <VBtn
          :aria-label="fillEmptyName(t('common.damImage.asset.model.authors'))"
          icon
          size="small"
          variant="text"
          class="mr-1"
          @click.stop="fillAuthors(false)"
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
          @click.stop="fillAuthors(true)"
        >
          <VIcon icon="mdi-file-replace-outline" />
          <VTooltip
            activator="parent"
            location="bottom"
          >
            {{ t('common.damImage.asset.massOperations.replaceOne') }}
          </VTooltip>
        </VBtn>
      </template>
    </DamSourcesAuthorsFields>
    <VRow
      v-else
      density="compact"
      class="mt-4"
    >
      <VCol>
        <div class="d-flex">
          <AFormTextarea
            v-model="texts.source"
            :label="sourceLabel"
          />
          <VBtn
            :aria-label="fillEmptyName(sourceLabel)"
            icon
            size="small"
            variant="text"
            class="mr-1"
            @click.stop="replaceEmptySource(texts.source, false)"
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
            :aria-label="replaceName(sourceLabel)"
            icon
            size="small"
            variant="text"
            @click.stop="replaceEmptySource(texts.source, true)"
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
      </VCol>
    </VRow>
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
</template>
