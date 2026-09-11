<script lang="ts" setup>
import ACardLoader from '@/components/ACardLoader.vue'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    loading?: boolean
    title?: string
    blockInput?: boolean
  }>(),
  {
    loading: undefined,
    title: undefined,
    blockInput: false,
  },
)

const loadingComputed = computed(() => {
  return props.loading ? 'primary' : false
})
</script>

<template>
  <!-- Opt-in: the loader already blocks the mouse, and `inert` also drops focus without restoring
       it — a cost on cards whose filter sits under it. `|| undefined` because DOM without an
       `inert` property would take the attribute, and `inert="false"` still reads as inert. -->
  <VCard
    :title="title"
    variant="flat"
    :loading="loadingComputed"
    :inert="(loading && blockInput) || undefined"
  >
    <ACardLoader :loading="loading" />
    <slot />
  </VCard>
</template>
