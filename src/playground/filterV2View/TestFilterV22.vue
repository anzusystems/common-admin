<script lang="ts" setup>
import { provide, ref } from 'vue'
import { useTestListFilter } from '@/playground/filterV2View/testFilterV22'
import AFilterWrapper from '@/components/filter2/AFilterWrapper.vue'
import AFilterString from '@/components/filter2/variant/AFilterString.vue'
import AFilterValueObjectOptionsSelect from '@/components/filter2/variant/AFilterValueObjectOptionsSelect.vue'
import { useSubjectLockType, useSubjectStatus } from '@/playground/filterV2View/testFilterV2'
import { FilterConfigKey, FilterDataKey } from '@/components/filter2/filterInjectionKeys'
import FilterSubjectSiteRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectSiteRemoteAutocomplete.vue'
import FilterSubjectAuthorRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectAuthorRemoteAutocomplete.vue'
import FilterSubjectRubricRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectRubricRemoteAutocomplete.vue'
import FilterSubjectDeskRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectDeskRemoteAutocomplete.vue'
import FilterSubjectUserRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectUserRemoteAutocomplete.vue'
import type { IntegerId, IntegerIdNullable } from '@/types/common.ts'
import AFilterDatetimePicker from '@/components/filter2/variant/AFilterDatetimePicker.vue'

const emit = defineEmits<{
  (e: 'afterReset'): void
  (e: 'afterSubmit'): void
}>()

const { filterConfig, filterData } = useTestListFilter()
provide(FilterConfigKey, filterConfig)
provide(FilterDataKey, filterData)

const touched = ref(false)

const submitFilter = () => {
  touched.value = false
  emit('afterSubmit')
}

const resetFilter = () => {
  touched.value = false
  emit('afterReset')
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
      :touched="touched"
      @submit-filter="submitFilter"
      @reset-filter="resetFilter"
    >
      <template #search>
        <AFilterString
          name="text"
          @change="onAnyFilterUpdate"
        />
      </template>
      <template #detail>
        <VRow>
          <VCol cols="2">
            <FilterSubjectSiteRemoteAutocomplete
              name="site"
              @change="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="3">
            <FilterSubjectRubricRemoteAutocomplete
              name="rubric"
              :site-id="(filterData.site as IntegerIdNullable | IntegerId[])"
              @change="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="2">
            <FilterSubjectAuthorRemoteAutocomplete
              name="articleAuthors"
              @change="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="2">
            <AFilterValueObjectOptionsSelect
              name="status"
              :items="subjectStatusOptions"
              @change="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="3">
            <AFilterString
              name="docId"
              @change="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="2">
            <FilterSubjectDeskRemoteAutocomplete
              name="desk"
              @change="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="3">
            <AFilterDatetimePicker
              name="publicPublishedAtFrom"
              @change="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="3">
            <AFilterDatetimePicker
              name="publicPublishedAtUntil"
              @change="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="3">
            <FilterSubjectUserRemoteAutocomplete
              name="owners"
              @change="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="3">
            <AFilterString
              name="url"
              @change="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="3">
            <AFilterDatetimePicker
              name="modifiedAtFrom"
              @change="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="3">
            <AFilterDatetimePicker
              name="modifiedAtUntil"
              @change="onAnyFilterUpdate"
            />
          </VCol>
          <VCol cols="2">
            <AFilterValueObjectOptionsSelect
              name="lockType"
              :items="subjectLockTypeOptions"
              @change="onAnyFilterUpdate"
            />
          </VCol>
        </VRow>
      </template>
    </AFilterWrapper>
  </VForm>
</template>
