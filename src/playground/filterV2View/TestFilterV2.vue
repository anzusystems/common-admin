<script lang="ts" setup>
import {
  AFilterDatetimePicker,
  AFilterString,
  AFilterValueObjectOptionsSelect,
  AFilterWrapper,
} from '@anzusystems/common-admin'
import { ref } from 'vue'
import { useSubjectLockType, useSubjectStatus, useTestListFilter } from '@/playground/filterV2View/testFilterV2'
import FilterSubjectSiteRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectSiteRemoteAutocomplete.vue'
import FilterSubjectRubricRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectRubricRemoteAutocomplete.vue'
import FilterSubjectAuthorRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectAuthorRemoteAutocomplete.vue'
import FilterSubjectDeskRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectDeskRemoteAutocomplete.vue'
import FilterSubjectUserRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectUserRemoteAutocomplete.vue'

const emit = defineEmits<{
  (e: 'submitFilter'): void
  (e: 'resetFilter'): void
}>()

const showAdvanced = defineModel<boolean>('showAdvanced', { default: false, required: false })

const filter = useTestListFilter()
const touched = ref(false)

const submitFilter = () => {
  touched.value = false
  emit('submitFilter')
}

const resetFilter = () => {
  touched.value = false
  emit('resetFilter')
}

const onAnyFilterUpdate = () => {
  touched.value = true
}

const { subjectStatusOptions } = useSubjectStatus()
const { subjectLockTypeOptions } = useSubjectLockType()
</script>

<template>
  <VForm
    name="search"
    @submit.prevent="submitFilter"
  >
    <AFilterWrapper
      v-model:show-advanced="showAdvanced"
      enable-advanced
      :touched="touched"
      @reset-filter="resetFilter"
    >
      <VRow align="start">
        <VCol cols="3">
          <AFilterString
            v-model="filter.text"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
      </VRow>
      <template #advanced>
        <VRow>
          <VCol cols="2">
            <FilterSubjectSiteRemoteAutocomplete
              v-model="filter.site"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="3">
            <FilterSubjectRubricRemoteAutocomplete
              v-model="filter.rubric"
              :site-id="filter.site.model"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="2">
            <FilterSubjectAuthorRemoteAutocomplete
              v-model="filter.articleAuthors"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="2">
            <AFilterValueObjectOptionsSelect
              v-model="filter.status"
              :items="subjectStatusOptions"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
        </VRow>
        <VRow>
          <VCol cols="3">
            <AFilterString
              v-model="filter.docId"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="2">
            <FilterSubjectDeskRemoteAutocomplete
              v-model="filter.desk"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="3">
            <AFilterDatetimePicker
              v-model="filter.publicPublishedAtFrom"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="3">
            <AFilterDatetimePicker
              v-model="filter.publicPublishedAtUntil"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="3">
            <FilterSubjectUserRemoteAutocomplete
              v-model="filter.owners"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="3">
            <AFilterString
              v-model="filter.url"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
        </VRow>
        <VRow>
          <VCol cols="3">
            <AFilterDatetimePicker
              v-model="filter.modifiedAtFrom"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="3">
            <AFilterDatetimePicker
              v-model="filter.modifiedAtUntil"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="2">
            <AFilterValueObjectOptionsSelect
              v-model="filter.lockType"
              :items="subjectLockTypeOptions"
              @update:model-value="onAnyFilterUpdate"
            />
          </VCol>
        </VRow>
      </template>
    </AFilterWrapper>
  </VForm>
</template>
