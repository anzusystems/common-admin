<script
  lang="ts"
  setup
>
withDefaults(
  defineProps<{
    sourceEnabled: boolean
    authorEnabled?: boolean
  }>(),
  {
    authorEnabled: true,
  },
)
</script>

<template>
  <VRow
    v-if="sourceEnabled || authorEnabled"
    density="comfortable"
    class="align-center"
  >
    <VCol v-if="sourceEnabled">
      <slot name="sources" />
    </VCol>
    <VCol
      v-if="sourceEnabled && authorEnabled"
      cols="auto"
      class="px-0"
    >
      <VIcon icon="mdi-slash-forward" />
    </VCol>
    <VCol v-if="authorEnabled">
      <slot name="authors" />
    </VCol>
  </VRow>
</template>
