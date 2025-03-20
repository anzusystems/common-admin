<script lang="ts" setup>
import { useFilterHelpers } from '@/composables/filter/filterHelpers'
import { useTestListFilter } from '@/playground/filterV2View/testFilterV2'
import { usePagination } from '@/composables/system/pagination'
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { onMounted, ref } from 'vue'
import TestFilterV22 from '@/playground/filterV2View/TestFilterV22.vue'

const { resetFilter, submitFilter, loadStoredFilter } = useFilterHelpers('filterDemo')
const pagination = usePagination()

const filter = useTestListFilter()
const showAdvancedFilter = ref(false)

const getList = () => {
  console.log('submit')
}

onMounted(() => {
  loadStoredFilter(filter, { showAdvancedFilter })
})
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>Filters</VCardTitle>
    <VCardText>
      <VForm>
        <TestFilterV22
          v-model:show-advanced="showAdvancedFilter"
          @submit-filter="submitFilter(filter, pagination, getList)"
          @reset-filter="resetFilter(filter, pagination, getList)"
        />
      </VForm>
    </VCardText>
  </VCard>
</template>
