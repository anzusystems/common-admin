<script lang="ts" setup>
import { useTheme } from '@/domains/system/composables/themeSettings'

const { theme } = useTheme()
</script>

<template>
  <VApp :theme="theme">
    <VMain class="d-flex w-100 h-100 align-center justify-center">
      <VProgressCircular
        indeterminate
        color="primary"
      />
    </VMain>
  </VApp>
</template>
