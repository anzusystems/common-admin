<script setup lang="ts">
import { readonly } from 'vue'

const props = defineProps<{ readonly: boolean; items: string[] }>()
const frozen = readonly(props.items)
</script>

<template>
  <div v-if="readonly">{{ frozen }}</div>
</template>
