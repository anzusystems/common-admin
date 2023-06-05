<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted } from 'vue'
import { useActionbar } from '@/views/system/actionbar'

const { mounted, unMounted } = useActionbar()

onMounted(async () => {
  await nextTick()
  mounted()
})

onBeforeUnmount(() => {
  unMounted()
})
</script>

<template>
  <div
    id="anzu-actionbar"
    class="d-flex w-100 align-center justify-space-between min-width-0"
  />
</template>
