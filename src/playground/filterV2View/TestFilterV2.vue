<script lang="ts" setup>
import { computed, provide } from 'vue'
import { useTestListFilter } from '@/playground/filterV2View/testFilterV2.ts'
import AFilterWrapper from '@/components/filter2/AFilterWrapper.vue'
import AFilterString from '@/components/filter2/variant/AFilterString.vue'
import AFilterValueObjectOptionsSelect from '@/components/filter2/variant/AFilterValueObjectOptionsSelect.vue'
import { useSubjectLockType, useSubjectStatus } from '@/playground/filterV2View/subjectTools.ts'
import { FilterConfigKey, FilterDataKey } from '@/components/filter2/filterInjectionKeys'
import FilterSubjectSiteRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectSiteRemoteAutocomplete.vue'
import FilterSubjectAuthorRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectAuthorRemoteAutocomplete.vue'
import FilterSubjectRubricRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectRubricRemoteAutocomplete.vue'
import FilterSubjectDeskRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectDeskRemoteAutocomplete.vue'
import FilterSubjectUserRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectUserRemoteAutocomplete.vue'
import type { IntegerIdNullable } from '@/types/common.ts'
import AFilterDatetimePicker from '@/components/filter2/variant/AFilterDatetimePicker.vue'
import AFilterBooleanSelect from '@/components/filter2/variant/AFilterBooleanSelect.vue'

const emit = defineEmits<{
  (e: 'submit'): void
  (e: 'reset'): void
}>()

const { filterConfig, filterData } = useTestListFilter()
provide(FilterConfigKey, filterConfig)
provide(FilterDataKey, filterData)

const siteId = computed(() => {
  return filterData.site as IntegerIdNullable | IntegerId[]
})

const { subjectStatusOptions } = useSubjectStatus()
const { subjectLockTypeOptions } = useSubjectLockType()
</script>

<template>
  <AFilterWrapper
    @submit="emit('submit')"
    @reset="emit('reset')"
  >
    <template #search>
      <AFilterString name="text" />
    </template>
    <template #detail>
      <VRow>
        <VCol cols="3">
          <FilterSubjectSiteRemoteAutocomplete name="site" />
        </VCol>
        <VCol cols="3">
          <FilterSubjectRubricRemoteAutocomplete
            name="rubric"
            :site-id="siteId"
          />
        </VCol>
        <VCol cols="3">
          <FilterSubjectAuthorRemoteAutocomplete name="articleAuthors" />
        </VCol>
        <VCol cols="3">
          <AFilterValueObjectOptionsSelect
            name="status"
            :items="subjectStatusOptions"
          />
        </VCol>
        <VCol cols="3">
          <AFilterString name="docId" />
        </VCol>
        <VCol cols="3">
          <FilterSubjectDeskRemoteAutocomplete name="desks" />
        </VCol>
        <VCol cols="3">
          <AFilterDatetimePicker name="publicPublishedAtFrom" />
        </VCol>
        <VCol cols="3">
          <AFilterDatetimePicker name="publicPublishedAtUntil" />
        </VCol>
        <VCol cols="3">
          <FilterSubjectUserRemoteAutocomplete name="owners" />
        </VCol>
        <VCol cols="3">
          <AFilterString name="url" />
        </VCol>
        <VCol cols="3">
          <AFilterDatetimePicker name="modifiedAtFrom" />
        </VCol>
        <VCol cols="3">
          <AFilterDatetimePicker name="modifiedAtUntil" />
        </VCol>
        <VCol cols="3">
          <AFilterValueObjectOptionsSelect
            name="lockType"
            :items="subjectLockTypeOptions"
          />
        </VCol>
        <VCol cols="3">
          <AFilterBooleanSelect name="enableAds" />
        </VCol>
      </VRow>
    </template>
  </AFilterWrapper>
  <div class="my-2">
    {{ filterData }}
  </div>
  <div class="my-2">
    {{ filterConfig }}
  </div>
</template>
