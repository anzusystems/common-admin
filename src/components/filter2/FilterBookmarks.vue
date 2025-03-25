<script lang="ts" setup></script>

<template>
  <VBtn
    v-for="shortcut in 10"
    :key="shortcut"
    class="shortcut-btn"
    size="small"
    text
    @click.stop=""
  >
    Bookmark lorem ipsum
  </VBtn>
</template>
