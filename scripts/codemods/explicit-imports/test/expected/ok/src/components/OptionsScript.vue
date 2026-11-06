<script lang="ts">
import { ref } from 'vue'

export default {
  setup() {
    return { count: ref(1) }
  },
}
</script>

<template>
  <div>{{ count }}</div>
</template>
