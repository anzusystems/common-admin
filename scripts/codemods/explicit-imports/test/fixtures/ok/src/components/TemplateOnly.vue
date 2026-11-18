<script setup lang="ts">
const value = 1
</script>

<template>
  <div :data-system="SYSTEM_CMS">{{ isUndefined(value) ? '' : value }}</div>
</template>
