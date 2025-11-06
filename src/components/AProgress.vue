<script lang="ts" setup>
withDefaults(
  defineProps<{
    size?: 'small' | 'x-small' | 'default'
  }>(),
  {
    size: 'x-small',
  }
)
</script>

<template>
  <div
    class="w-100 d-flex align-center justify-center"
  >
    <VProgressCircular
      :size="size"
      indeterminate
    />
  </div>
</template>
