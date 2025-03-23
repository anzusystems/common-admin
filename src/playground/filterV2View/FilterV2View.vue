<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import TestFilterV2 from '@/playground/filterV2View/TestFilterV2.vue'

const filterSubmit = (a, b) => {
  console.log('filterSubmit', a, b)
}

const filterReset = () => {
  console.log('filterReset', a, b)
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
