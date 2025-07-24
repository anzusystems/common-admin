<script lang="ts" setup>
import { usePollSelectStore } from '@/playground/subjectSelect2View/pollSelectStore'
import AFilterString from '@/labs/filters/AFilterString.vue'
import AFilterWrapperSubjectSelect from '@/labs/subjectSelect/AFilterWrapperSubjectSelect.vue'

const emit = defineEmits<{
  (e: 'submit'): void
  (e: 'reset'): void
}>()

const { datatableHiddenColumns } = usePollSelectStore()
</script>

<template>
  <AFilterWrapperSubjectSelect
    v-model:datatable-hidden-columns="datatableHiddenColumns"
    @submit="emit('submit')"
    @reset="emit('reset')"
  >
    <template #search>
      <AFilterString name="title" />
    </template>
  </AFilterWrapperSubjectSelect>
  <!--  <VRow>-->
  <!--    <VCol :cols="12">-->
  <!--      <AFilterString-->
  <!--        v-model="filter.title"-->
  <!--        @update:model-value="onAnyFilterUpdate"-->
  <!--        @keydown.enter="submitFilter"-->
  <!--      />-->
  <!--    </VCol>-->
  <!--  </VRow>-->
</template>
