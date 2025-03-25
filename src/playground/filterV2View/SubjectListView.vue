<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import SubjectDatatable from '@/playground/filterV2View/SubjectDatatable.vue'

// const filterSubmit = ({
//   filterData,
//   filterConfig,
// }: {
//   filterData: SubjectFilterData
//   filterConfig: SubjectFilterConfig
// }) => {
//   console.log('filterSubmit', filterData, filterConfig)
// }
//
// const filterReset = ({
//   filterData,
//   filterConfig,
// }: {
//   filterData: SubjectFilterData
//   filterConfig: SubjectFilterConfig
// }) => {
//   console.log('filterReset', filterData, filterConfig)
// }
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardText>
      <SubjectDatatable />
    </VCardText>
  </VCard>
</template>
