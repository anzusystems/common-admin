<script lang="ts" setup>
// #region docs-props
withDefaults(
  defineProps<{
    loading?: boolean
  }>(),
  {
    loading: undefined,
  }
)
// #endregion docs-props
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
  inset: 0;
  background-color: rgb(0 0 0 / 10%);
  z-index: 5;
}
</style>
