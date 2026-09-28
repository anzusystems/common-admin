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

onMounted(() => {
  if (!props.logoutUrl) return
  window.location.href = props.logoutUrl()
})
</script>

<template>
  <div />
</template>
