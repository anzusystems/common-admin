<script setup lang="ts">
import { useDropZone } from '@vueuse/core'
import { ref } from 'vue'

const dropZoneRef = ref<HTMLDivElement>()

function onDrop(files: File[] | null) {
  // called when files are dropped on zone
  console.log(files)
}

const { isOverDropZone } = useDropZone(dropZoneRef, onDrop)
</script>

<template>
  <div v-if="isOverDropZone">
    isoverdropzone
  </div>
  <div ref="dropZoneRef">
    Drop files here
  </div>
</template>
