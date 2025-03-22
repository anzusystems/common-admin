<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import TestFilterV2 from '@/playground/filterV2View/TestFilterV2.vue'

const afterSubmit = () => {
  console.log('afterSubmit')
}

const afterReset = () => {
  console.log('afterReset')
}
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>Filters</VCardTitle>
    <VCardText>
      <VForm>
        <TestFilterV2
          @after-reset="afterReset"
          @after-submit="afterSubmit"
        />
      </VForm>
    </VCardText>
  </VCard>
</template>
