<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useImageMassOperations } from '@/components/damImage/uploadQueue/composables/imageMassOperations'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import { computed, ref } from 'vue'
import useVuelidate from '@vuelidate/core'
import { useValidate } from '@/validators/vuelidate/useValidate'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import AuthorRemoteAutocompleteWithCached from '@/components/damImage/uploadQueue/author/AuthorRemoteAutocompleteWithCached.vue'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'
import { storeToRefs } from 'pinia'

const texts = ref({ description: '', source: '', authors: [] })

const imageStore = useImageStore()
const { images } = storeToRefs(imageStore)
const { replaceEmptyDescription, replaceEmptySource, replaceEmptyAuthors } = useImageMassOperations()
const { t } = useI18n()

const fillAll = (forceReplace: boolean) => {
  replaceEmptyDescription(texts.value.description, forceReplace)
  replaceEmptySource(texts.value.source, forceReplace)
  replaceEmptyAuthors(texts.value.authors, forceReplace)
}

const clearForm = () => {
  texts.value.description = ''
  texts.value.source = ''
  texts.value.authors = []
}

const { cachedExtSystemId } = useExtSystemIdForCached()

const { maxLength } = useValidate()

const rules = computed(() => ({
  texts: {
    description: {
      maxLength: maxLength(2000),
    },
    source: {
      maxLength: maxLength(255),
    },
  },
}))
const v$ = useVuelidate(rules, { texts }, { $scope: false })

const showDamAuthorsAtLeastOne = computed(() => {
  if (images.value.length === 0) return false
  return images.value.length && images.value.some((item) => item?.showDamAuthors)
})
</script>

<template>
  <div class="w-100">
    <VRow
      dense
      class="mt-1"
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
    <VRow
      v-if="showDamAuthorsAtLeastOne"
      dense
      class="mt-1"
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
      </VCol>
    </VRow>
    <VRow
      v-else
      dense
      class="mt-1"
    >
      <VCol>
        <div class="d-flex">
          <AFormTextarea
            v-model="texts.source"
            :label="t('common.damImage.image.model.texts.source')"
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
