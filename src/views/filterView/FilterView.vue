<script lang="ts" setup>
import TestFilter from '@/views/filterView/TestFilter.vue'
import { useFilterHelpers } from '@/composables/filter/filterHelpers'
import { useTestListFilter } from '@/views/filterView/testFilter'
import { usePagination } from '@/composables/system/pagination'
import ActionbarWrapper from '@/views/system/ActionbarWrapper.vue'

const { resetFilter, submitFilter } = useFilterHelpers()
const pagination = usePagination()

const filter = useTestListFilter()

const getList = () => {
  console.log('submit')
}
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>Filters</VCardTitle>
    <VCardText>
      {{ filter }}
      <VForm>
        <TestFilter
          @submit-filter="submitFilter(filter, pagination, getList)"
          @reset-filter="resetFilter(filter, pagination, getList)"
        />
      </VForm>
    </VCardText>
  </VCard>
</template>
