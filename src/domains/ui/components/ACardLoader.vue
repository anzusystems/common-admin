<script lang="ts" setup>
withDefaults(
  defineProps<{
    zIndex: number
    loading?: boolean
  }>(),
  {
    loading: undefined,
  }
)
</script>

<template>
  <div
    v-show="loading"
    class="a-card-loader"
    :style="{ zIndex }"
  />
</template>

<style lang="scss">
// todo dark mode
.a-card-loader {
  position: absolute;
  inset: 0;
  background-color: rgb(0 0 0 / 10%);
}
</style>
