<script setup lang="ts">
const props = defineProps<{ readonly: boolean }>()
const label = computed(() => (props.readonly ? 'read' : 'write'))
</script>

<template>
  <div v-if="readonly">{{ label }}</div>
</template>
