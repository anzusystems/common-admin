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

// The sign-out address takes the place of the admin's own `/logout` in the browser history: left there, Back after
// the next sign-in came to `/logout`, and signed the user out at once. The page the user was on before stays.
onMounted(() => {
  if (!props.logoutUrl) return
  window.location.replace(props.logoutUrl())
})
</script>

<template>
  <div />
</template>
