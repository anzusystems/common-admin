<script lang="ts" setup>
import { onMounted } from 'vue'

const props = withDefaults(
  defineProps<{
    logoutUrl?: undefined | (() => string)
  }>(),
  {
    logoutUrl: undefined,
  }
)

// The sign-out address replaces the admin's `/logout` in browser history. Otherwise
// Back after the next sign-in reaches `/logout` and signs the user out at once.
onMounted(() => {
  if (!props.logoutUrl) return
  window.location.replace(props.logoutUrl())
})
</script>

<template>
  <div />
</template>
