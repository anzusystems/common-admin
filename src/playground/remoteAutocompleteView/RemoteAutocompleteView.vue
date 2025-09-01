<script lang="ts" setup>
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import ARow from '@/components/ARow.vue'
import { provide, type Ref, ref } from 'vue'
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import type { IntegerId } from '@/types/common'
import type { ValueObjectOption } from '@/types/ValueObject'
import { fetchPollListByIds, type PollDemo, useFetchPollListDemo } from '@/playground/subjectSelectView/pollDemoApi'
import DamAssetLicenceRemoteAutocomplete from '@/components/dam/user/DamAssetLicenceRemoteAutocomplete.vue'
import { damClient } from '@/playground/mock/coreDamClient'
import AFormRemoteAutocomplete from '@/labs/form/AFormRemoteAutocomplete.vue'
import {
  createFilter,
  createFilterStore,
  type FilterConfig,
  type FilterData,
  type MakeFilterOption,
} from '@/labs/filters/filterFactory'
import type { Pagination } from '@/labs/filters/pagination'
import { FilterInnerConfigKey, FilterInnerDataKey } from '@/labs/filters/filterInjectionKeys'

const value = ref<any>([])
const selected = ref<any>([])

const valueLicence = ref<IntegerId[]>([])

const { executeFetch } = useFetchPollListDemo()

const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
  const rubrics = await executeFetch(pagination, filterData, filterConfig)

  return rubrics.map((poll: PollDemo) => ({
    title: poll.texts.title,
    value: poll.id,
    subtitle: poll.votes + '',
  })) as ValueObjectOption<IntegerId>[]
}

const fetchItemsByIds = async (ids: IntegerId[]) => {
  const rubrics = await fetchPollListByIds(ids)

  return rubrics.map((poll: PollDemo) => ({
    title: poll.texts.title,
    value: poll.id,
    subtitle: poll.votes + '',
  })) as ValueObjectOption<IntegerId>[]
}

function useRubricInnerFilter() {
  const filterFieldsInner = [
    { name: 'id' as const, default: null },
    { name: 'title' as const, default: null, type: 'string', variant: 'startsWith', apiName: 'texts.title' },
  ] satisfies readonly MakeFilterOption[]

  const { filterConfig, filterData } = createFilter(filterFieldsInner, createFilterStore(filterFieldsInner), {
    elastic: true,
    system: 'cms',
    subject: 'poll',
  })

  return {
    filterConfig,
    filterData,
  }
}
const { filterData, filterConfig } = useRubricInnerFilter()
provide(FilterInnerConfigKey, filterConfig)
provide(FilterInnerDataKey, filterData)
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>Forms</VCardTitle>
    <VCardText>
      <VForm>
        <ASystemEntityScope
          system="system"
          subject="subject"
        >
          <ARow title="v-model">
            {{ value }}
          </ARow>
          <ARow title="v-model:selected">
            {{ selected }}
          </ARow>
          <ARow>
            <AFormRemoteAutocomplete
              v-model="value"
              v-model:selected="selected"
              :fetch-items="fetchItems"
              :fetch-items-by-ids="fetchItemsByIds"
              chips
              multiple
              filter-by-field="title"
            />
          </ARow>
          <ARow title="v-model">
            {{ valueLicence }}
          </ARow>
          <ARow>
            <DamAssetLicenceRemoteAutocomplete
              v-model="valueLicence"
              :client="damClient"
              label="DAM Asset Licence multiple"
              multiple
              clearable
            />
          </ARow>
        </ASystemEntityScope>
      </VForm>
    </VCardText>
  </VCard>
</template>
