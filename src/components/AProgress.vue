<script lang="ts" setup>
withDefaults(
  defineProps<{
    size?: 'small' | 'x-small' | 'default'
    fullscreen?: boolean
  }>(),
  {
    size: 'x-small',
    fullscreen: false,
  },
)
</script>

<template>
  <div
    v-if="fullscreen"
    class="a-progress-fullscreen"
  >
    <VProgressCircular
      :size="size"
      indeterminate
    />
  </div>
  <div
    v-else
    class="w-100 d-flex align-center justify-center"
  >
    <VProgressCircular
      :size="size"
      indeterminate
    />
  </div>
</template>

<style lang="scss" scoped>
.a-progress-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: all;

  .v-theme--light & {
    background: rgb(255 255 255 / 60%);
  }

  .v-theme--dark & {
    background: rgb(0 0 0 / 60%);
  }
}
</style>
