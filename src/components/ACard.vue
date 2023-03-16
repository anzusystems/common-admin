<script lang="ts" setup>
import ACardLoader from '@/components/ACardLoader.vue'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    loading?: boolean
    title?: string
  }>(),
  {
    loading: undefined,
    title: undefined,
  },
)

const loadingComputed = computed(() => {
  return props.loading ? 'primary' : false
})
</script>

<template>
  <VCard
    :title="title"
    variant="flat"
    :loading="loadingComputed"
  >
    <ACardLoader :loading="loading" />
    <slot />
  </VCard>
</template>

