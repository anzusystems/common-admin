<script lang="ts" setup>
import { computed, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    data: any
  }>(),
  {

  },
)

const computedData = computed(() => {
  return props.data
})

watch(
  computedData,
  (newValue) => {
    console.log(newValue)
  },
  { immediate: true },
)
</script>

<template />
