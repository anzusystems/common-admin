<script lang="ts" setup>
import TestFilter from '@/playground/filterView/TestFilter.vue'
import { useFilterHelpers } from '@/composables/filter/filterHelpers'
import { useTestListFilter } from '@/playground/filterView/testFilter'
import { usePagination } from '@/composables/system/pagination'
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { onMounted } from 'vue'

const { resetFilter, submitFilter, loadStoredFilter } = useFilterHelpers('filterDemo')
const pagination = usePagination()

const filter = useTestListFilter()

const getList = () => {
  console.log('submit')
}

onMounted(() => {
  loadStoredFilter(filter)
})
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
