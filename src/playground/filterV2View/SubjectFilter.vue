<script lang="ts" setup>
import { computed, provide } from 'vue'
import {
  type SubjectFilterConfig,
  type SubjectFilterData,
  useSubjectListFilter,
} from '@/playground/filterV2View/subjectFilter'
import AFilterWrapper2 from '@/components/filter2/AFilterWrapper2.vue'
import AFilterString2 from '@/components/filter2/variant/AFilterString2.vue'
import { FilterConfigKey, FilterDataKey } from '@/components/filter2/filterInjectionKeys'
import FilterSubjectSiteRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectSiteRemoteAutocomplete.vue'
import FilterSubjectAuthorRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectAuthorRemoteAutocomplete.vue'
import FilterSubjectRubricRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectRubricRemoteAutocomplete.vue'
import FilterSubjectDeskRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectDeskRemoteAutocomplete.vue'
import FilterSubjectUserRemoteAutocomplete from '@/playground/filterV2View/FilterSubjectUserRemoteAutocomplete.vue'
import type { IntegerId, IntegerIdNullable } from '@/types/common'
import AFilterValueObjectOptionsSelect2 from '@/components/filter2/variant/AFilterValueObjectOptionsSelect2.vue'
import {
  allowedTimeIntervalValuesSubject,
  useSubjectListActions,
  useSubjectLockType,
  useSubjectStatus,
} from '@/playground/filterV2View/subjectTools'
import AFilterTimeInterval2 from '@/components/filter2/variant/AFilterTimeInterval2.vue'
import { cmsClient } from '@/playground/mock/cmsClient'

const emit = defineEmits<{
  (e: 'submit', value: { filterData: SubjectFilterData; filterConfig: SubjectFilterConfig }): void
  (e: 'reset', value: { filterData: SubjectFilterData; filterConfig: SubjectFilterConfig }): void
}>()

const { filterConfig, filterData } = useSubjectListFilter()
provide(FilterConfigKey, filterConfig)
provide(FilterDataKey, filterData)

const siteId = computed(() => {
  return filterData.site as IntegerIdNullable | IntegerId[]
})

const { subjectStatusOptions } = useSubjectStatus()
const { subjectLockTypeOptions } = useSubjectLockType()
const { datatableHiddenColumns } = useSubjectListActions()
</script>

<template>
  <AFilterWrapper2
    v-model:datatable-hidden-columns="datatableHiddenColumns"
    :client="cmsClient"
    system="cms"
    :user-id="10001039"
    bookmark-system-resource="subject"
    @submit="emit('submit', { filterData, filterConfig })"
    @reset="emit('reset', { filterData, filterConfig })"
  >
    <template #search>
      <AFilterString2 name="text" />
    </template>
    <template #item.status>
      <AFilterValueObjectOptionsSelect2
        name="status"
        :items="subjectStatusOptions"
      />
    </template>
    <template #item.lockType>
      <AFilterValueObjectOptionsSelect2
        name="lockType"
        :items="subjectLockTypeOptions"
      />
    </template>
    <template #item.site>
      <FilterSubjectSiteRemoteAutocomplete name="site" />
    </template>
    <template #item.rubric>
      <FilterSubjectRubricRemoteAutocomplete
        name="rubric"
        :site-id="siteId"
      />
    </template>
    <template #item.articleAuthors>
      <FilterSubjectAuthorRemoteAutocomplete name="articleAuthors" />
    </template>
    <template #item.desks>
      <FilterSubjectDeskRemoteAutocomplete name="desks" />
    </template>
    <template #item.owners>
      <FilterSubjectUserRemoteAutocomplete name="owners" />
    </template>
    <template #item.publicPublishedAtFrom>
      <AFilterTimeInterval2
        name-from="publicPublishedAtFrom"
        name-until="publicPublishedAtUntil"
        :allowed="allowedTimeIntervalValuesSubject"
      />
    </template>
    <template #item.modifiedAtFrom>
      <AFilterTimeInterval2
        name-from="modifiedAtFrom"
        name-until="modifiedAtUntil"
        :allowed="allowedTimeIntervalValuesSubject"
      />
    </template>
  </AFilterWrapper2>
</template>
