<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useImageMassOperations } from '@/components/damImage/uploadQueue/composables/imageMassOperations'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import { computed, ref } from 'vue'
import useVuelidate from '@vuelidate/core'
import { useValidate } from '@/validators/vuelidate/useValidate'

const texts = ref({ description: '', source: '' })

const { replaceEmptyDescription, replaceEmptySource } = useImageMassOperations()
const { t } = useI18n()

const fillAll = (forceReplace: boolean) => {
  replaceEmptyDescription(texts.value.description, forceReplace)
  replaceEmptySource(texts.value.source, forceReplace)
}

const clearForm = () => {
  texts.value.description = ''
  texts.value.source = ''
}

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
            :v="v$"
            :label="t('common.damImage.image.model.texts.description')"
            v-model="texts.description"
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
