<script lang="ts" setup>
import ACardLoader from '@/domains/ui/components/ACardLoader.vue'
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
  }
)

const loadingComputed = computed(() => {
  return props.loading ? 'primary' : false
})
</script>

<template>
  <!--
    Opt-in: the loader already blocks the mouse, and `inert` also drops
    focus without restoring it, which hurts cards with a filter under it.
    `|| undefined` because `inert="false"` still counts as inert in DOMs without an `inert` property.
  -->
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
