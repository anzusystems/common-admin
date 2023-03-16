<script lang="ts" setup>
withDefaults(
  defineProps<{
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
  />
</template>

<style lang="scss">
// todo dark mode
.a-card-loader {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgb(0 0 0 / 10%);
  z-index: 5;
}
</style>
