<script lang="ts" setup>
import AChip from './AChip.vue'
import AButton from './AButton.vue'

defineProps<{
  text: string
}>()
</script>

<template>
  <div>This is a compiled component. With prop text: {{ text }}</div>
  <hr>
  <AChip></AChip>
  <hr>
  <AButton></AButton>
  <div>
    <VSwitch label="switch"></VSwitch>
  </div>
</template>
