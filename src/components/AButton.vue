<script lang="ts" setup>
import { ref } from 'vue'

const text = ref('Click me')
</script>

<template>
  <button v-bind="$attrs" @click="text = 'clicked!!!'">
    {{ text }}
  </button>
</template>
