<script setup lang="ts">
const list = [1, 2]
</script>

<template>
  <ul>
    <li
      v-for="ref in list"
      :key="ref"
    >
      {{ ref }}
    </li>
  </ul>
  <Child>
    <template #default="{ computed }">{{ computed }}</template>
    <template #[dynamicName]="{ watch }">{{ watch }}</template>
  </Child>
</template>
