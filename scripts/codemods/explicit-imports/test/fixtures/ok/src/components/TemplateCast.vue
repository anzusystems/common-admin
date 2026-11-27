<script setup lang="ts" generic="T extends DocId">
const props = defineProps<{ value: T; raw: unknown }>()
</script>

<template>
  <div>{{ props.value }} {{ raw as IntegerId }}</div>
</template>
