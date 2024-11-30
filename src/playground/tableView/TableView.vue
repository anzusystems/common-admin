<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import AuthorDatatable from '@/playground/tableView/AuthorDatatable.vue'
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardText>
      <h2 class="text-h5 mt-5 mb-2">
        DAM Author datatable
      </h2>
      <AuthorDatatable />
    </VCardText>
  </VCard>
</template>
