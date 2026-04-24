<script setup lang="ts">
// Drag-handle icon. The caller's legacy handle class
// (`.a-sortable-list-editor__drag-handle` / `.a-nested-list-editor__drag-handle`)
// reaches the root via Vue attrs fallthrough, so useSortable's `handle`
// selector keeps matching without change.
</script>

<template>
  <VIcon
    icon="mdi-drag"
    size="20"
  />
</template>
