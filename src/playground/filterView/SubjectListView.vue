<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import SubjectDatatable from '@/playground/filterView/SubjectDatatable.vue'
import { useSubjectListActions } from '@/playground/filterView/subjectTools'
import ACard from '@/components/ACard.vue'

const { listLoading } = useSubjectListActions()
</script>

<template>
  <ActionbarWrapper />

  <ACard :loading="listLoading">
    <VCardText>
      <SubjectDatatable />
    </VCardText>
  </ACard>
</template>
