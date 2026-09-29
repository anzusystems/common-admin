<script setup lang="ts">
import { SYSTEM_CMS } from '@/shared/systems'
import { isUndefined } from '@anzusystems/common-admin'

const value = 1
</script>

<template>
  <div :data-system="SYSTEM_CMS">{{ isUndefined(value) ? '' : value }}</div>
</template>
