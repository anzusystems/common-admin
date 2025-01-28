<script lang="ts" setup>
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import ARow from '@/components/ARow.vue'
import { reactive, ref } from 'vue'
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import AFormRemoteAutocomplete from '@/components/form/AFormRemoteAutocomplete.vue'
import type { IntegerId } from '@/types/common'
import { makeFilterHelper } from '@/composables/filter/filterHelpers'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import type { ValueObjectOption } from '@/types/ValueObject'
import { fetchPollListByIds, fetchPollListDemo, type PollDemo } from '@/playground/subjectSelectView/pollDemoApi'

const value = ref<any>([1])
const selected = ref<any>([])

const fetchItems = async (pagination: Pagination, filterBag: FilterBag) => {
  const rubrics = await fetchPollListDemo(pagination, filterBag)

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

const makeFilter = makeFilterHelper('cms', 'poll')

const innerFilter = reactive({
  id: {
    ...makeFilter({ name: 'id' }),
  },
  title: {
    ...makeFilter({ name: 'title', variant: 'startsWith', field: 'texts.title' }),
  },
})
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
              :inner-filter="innerFilter"
              chips
              multiple
              filter-by-field="title"
            />
          </ARow>
        </ASystemEntityScope>
      </VForm>
    </VCardText>
  </VCard>
</template>
