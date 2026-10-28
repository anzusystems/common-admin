<script lang="ts" setup>
import AFilterWrapperSubjectSelect from '@/domains/subjectSelect/components/AFilterWrapperSubjectSelect.vue'

const emit = defineEmits<{
  (e: 'submit'): void
  (e: 'reset'): void
}>()
</script>

<template>
  <AFilterWrapperSubjectSelect
    @submit="emit('submit')"
    @reset="emit('reset')"
  />
</template>
