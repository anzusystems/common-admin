<script setup lang="ts">
import AAbout from './components/AAbout.vue'
import ABooleanValue from './components/ABooleanValue.vue'</script>

<template>
  <ABooleanValue :value="true" chip></ABooleanValue>
  <AAbout text="bla"></AAbout>
</template>
