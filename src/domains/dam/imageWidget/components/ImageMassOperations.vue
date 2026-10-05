<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useImageMassOperations } from '@/domains/dam/imageWidget/composables/useImageMassOperations'
import AFormTextarea from '@/domains/form/components/AFormTextarea.vue'
import { computed, ref } from 'vue'
import useVuelidate from '@vuelidate/core'
import { useValidate } from '@/shared/validators/vuelidate/useValidate'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import ASystemEntityScope from '@/domains/form/components/ASystemEntityScope.vue'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { storeToRefs } from 'pinia'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { buildFieldRules } from '@/domains/dam/composables/uploadValidations'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { useAlerts } from '@/domains/system/composables/alerts'

const texts = ref({ description: '', source: '', authors: [] })

const imageStore = useImageStore()
const { images, readonly } = storeToRefs(imageStore)
const { replaceEmptyDescription, replaceEmptySource, replaceEmptyAuthors } = useImageMassOperations()
const { t } = useI18n()
const { showErrorsDefault } = useAlerts()

// The authors' names are looked up first, and nothing is filled when that fails.
const fillAuthors = async (forceReplace: boolean) => {
  try {
    await replaceEmptyAuthors(texts.value.authors, forceReplace)
  } catch (error) {
    showErrorsDefault(error)
  }
}

const fillAll = (forceReplace: boolean) => {
  replaceEmptyDescription(texts.value.description, forceReplace)
  if (authorEnabled.value && showDamAuthorsAtLeastOne.value) {
    fillAuthors(forceReplace)
  } else {
    replaceEmptySource(texts.value.source, forceReplace)
  }
}

const clearForm = () => {
  texts.value.description = ''
  if (authorEnabled.value && showDamAuthorsAtLeastOne.value) {
    texts.value.authors = []
  } else {
    texts.value.source = ''
  }
}

const { cachedExtSystemId } = useExtSystemIdForCached()

const { getDamConfigExtSystem } = useDamConfigState()

const authorEnabled = computed(() => {
  return !!getDamConfigExtSystem(cachedExtSystemId.value)?.[DamAssetType.Image]?.authors?.enabled
})

const { descriptionValidation, sourceValidation, sourceLabel } = useCommonAdminCoreDamOptions()
const validators = useValidate()

const rules = computed(() => ({
  texts: {
    description: buildFieldRules(descriptionValidation, validators),
    source: buildFieldRules(sourceValidation, validators),
  },
}))
const v$ = useVuelidate(rules, { texts }, { $scope: false })

const showDamAuthorsAtLeastOne = computed(() => {
  if (images.value.length === 0) return false
  return images.value.length && images.value.some((item) => item?.showDamAuthors)
})
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
            :aria-label="t('common.damImage.asset.massOperations.fillOneEmpty')"
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
            :aria-label="t('common.damImage.asset.massOperations.replaceOne')"
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
    <VRow
      v-if="authorEnabled && showDamAuthorsAtLeastOne"
      density="compact"
      class="mt-4"
    >
      <VCol>
        <ASystemEntityScope
          subject="keyword"
          system="dam"
        >
          <div class="d-flex">
            <div style="flex-grow: 1">
              <AuthorRemoteAutocompleteWithCached
                v-model="texts.authors"
                :ext-system="cachedExtSystemId"
                :label="t('common.damImage.asset.model.authors')"
                clearable
                multiple
                :validation-scope="false"
              />
            </div>
            <VBtn
              :aria-label="t('common.damImage.asset.massOperations.fillOneEmpty')"
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
              :aria-label="t('common.damImage.asset.massOperations.replaceOne')"
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
          </div>
        </ASystemEntityScope>
      </VCol>
    </VRow>
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
            :aria-label="t('common.damImage.asset.massOperations.fillOneEmpty')"
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
            :aria-label="t('common.damImage.asset.massOperations.replaceOne')"
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
