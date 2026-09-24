<script setup lang="ts">
import { toRaw } from 'vue'
</script>

<template>
  <div>{{ toRaw({ a: 1 }) }}</div>
</template>
