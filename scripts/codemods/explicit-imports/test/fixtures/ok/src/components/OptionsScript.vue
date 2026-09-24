<script lang="ts">
export default {
  setup() {
    return { count: ref(1) }
  },
}
</script>

<template>
  <div>{{ count }}</div>
</template>
