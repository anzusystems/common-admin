<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import TestFilterV2 from '@/playground/filterV2View/TestFilterV2.vue'
import { type SubjectFilterConfig, type SubjectFilterData } from '@/playground/filterV2View/testFilterV2.ts'

const filterSubmit = ({
  filterData,
  filterConfig,
}: {
  filterData: SubjectFilterData
  filterConfig: SubjectFilterConfig
}) => {
  console.log('filterSubmit', filterData, filterConfig)
}

const filterReset = ({
  filterData,
  filterConfig,
}: {
  filterData: SubjectFilterData
  filterConfig: SubjectFilterConfig
}) => {
  console.log('filterReset', filterData, filterConfig)
}
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>Filters</VCardTitle>
    <VCardText>
      <VForm>
        <TestFilterV2
          @submit="filterSubmit"
          @reset="filterReset"
        />
      </VForm>
    </VCardText>
  </VCard>
</template>
