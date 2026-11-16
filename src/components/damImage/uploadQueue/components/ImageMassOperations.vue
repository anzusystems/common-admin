<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useImageMassOperations } from '@/components/damImage/uploadQueue/composables/imageMassOperations'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import { computed, ref } from 'vue'
import useVuelidate from '@vuelidate/core'
import { useValidate } from '@/validators/vuelidate/useValidate'
import DamSourcesAuthorsRow from '@/components/damImage/uploadQueue/components/DamSourcesAuthorsRow.vue'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import AuthorRemoteAutocompleteWithCached from '@/components/damImage/uploadQueue/author/AuthorRemoteAutocompleteWithCached.vue'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { buildFieldRules } from '@/components/damImage/uploadQueue/composables/uploadValidations'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { DamAssetType } from '@/types/coreDam/Asset'
import type { DocId } from '@/types/common'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import { storeToRefs } from 'pinia'
import { isDamSourceEnabled } from '@/components/damImage/uploadQueue/source/damSourceConfig'

const texts = ref<{ description: string; source: string; authors: DocId[]; sources: DocId[] }>({
  description: '',
  source: '',
  authors: [],
  sources: [],
})

const imageStore = useImageStore()
const { images } = storeToRefs(imageStore)
const { replaceEmptyDescription, replaceEmptySource, replaceEmptyAuthors, replaceEmptySources } =
  useImageMassOperations()
const { t } = useI18n()

const fillAll = async (forceReplace: boolean) => {
  replaceEmptyDescription(texts.value.description, forceReplace)
  if (!showDamFields.value) {
    replaceEmptySource(texts.value.source, forceReplace)
    return
  }
  if (authorEnabled.value) await replaceEmptyAuthors(texts.value.authors, forceReplace)
  if (sourceEnabled.value) await replaceEmptySources(texts.value.sources, forceReplace)
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

const { cachedExtSystemId } = useExtSystemIdForCached()

const { getDamConfigExtSystem } = useDamConfigState()

const authorEnabled = computed(() => {
  return !!getDamConfigExtSystem(cachedExtSystemId.value)?.[DamAssetType.Image]?.authors?.enabled
})

const sourceEnabled = computed(() => isDamSourceEnabled(DamAssetType.Image, cachedExtSystemId.value))

const showDamFields = computed(
  () => (authorEnabled.value || sourceEnabled.value) && images.value.some((item) => item?.showDamAuthors),
)

const { descriptionValidation, sourceValidation, sourceLabel } = useCommonAdminCoreDamOptions()
const validators = useValidate()

const rules = computed(() => ({
  texts: {
    description: buildFieldRules(descriptionValidation, validators),
    source: buildFieldRules(sourceValidation, validators),
  },
}))
const v$ = useVuelidate(rules, { texts }, { $scope: false })
</script>

<template>
  <div class="w-100">
    <VRow
      density="comfortable"
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
    <DamSourcesAuthorsRow
      v-if="showDamFields"
      :source-enabled="sourceEnabled"
      :author-enabled="authorEnabled"
      class="mt-4"
    >
      <template #sources>
        <ASystemEntityScope
          subject="author"
          system="dam"
        >
          <div class="d-flex">
            <div style="flex-grow: 1">
              <AuthorRemoteAutocompleteWithCached
                v-model="texts.sources"
                v-model:counterpart="texts.authors"
                :ext-system="cachedExtSystemId"
                :label="t('common.damImage.asset.model.sources')"
                source
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
              @click.stop="replaceEmptySources(texts.sources, false)"
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
              @click.stop="replaceEmptySources(texts.sources, true)"
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
      </template>
      <template #authors>
        <ASystemEntityScope
          subject="author"
          system="dam"
        >
          <div class="d-flex">
            <div style="flex-grow: 1">
              <AuthorRemoteAutocompleteWithCached
                v-model="texts.authors"
                v-model:counterpart="texts.sources"
                :ext-system="cachedExtSystemId"
                :label="t('common.damImage.asset.model.authors')"
                :source="sourceEnabled ? false : undefined"
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
              @click.stop="replaceEmptyAuthors(texts.authors, false)"
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
              @click.stop="replaceEmptyAuthors(texts.authors, true)"
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
      </template>
    </DamSourcesAuthorsRow>
    <VRow
      v-else
      density="comfortable"
      class="mt-4"
    >
      <VCol>
        <div class="d-flex">
          <AFormTextarea
            v-model="texts.source"
            :label="sourceLabel"
          />
          <VBtn
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
