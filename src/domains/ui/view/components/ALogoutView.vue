<script lang="ts" setup>
import { onMounted } from 'vue'
import { broadcastSessionEnd } from '@/domains/auth/composables/sessionEnd'

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
// Every sign-out of the admins comes here, so the other tabs learn of it here.
onMounted(() => {
  if (!props.logoutUrl) return
  broadcastSessionEnd()
  window.location.replace(props.logoutUrl())
})
</script>

<template>
  <div />
</template>
