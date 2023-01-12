<script setup lang="ts">
import ABooleanValue from '@/components/ABooleanValue.vue'
</script>

<template>
  <h1>ABooleanValue</h1>
  <div>Display boolean values.</div>
  <div>
    <h4>true / false</h4>
    <ABooleanValue :value="true"></ABooleanValue> /
    <ABooleanValue :value="false"></ABooleanValue>
  </div>
  <div>
    <h4>true / false chip</h4>
    <ABooleanValue :value="true" chip></ABooleanValue> /
    <ABooleanValue :value="false" chip></ABooleanValue>
  </div>
  <div>
    <h4>true / false chip invert-color</h4>
    <ABooleanValue :value="true" chip invert-color></ABooleanValue> /
    <ABooleanValue :value="false" chip invert-color></ABooleanValue>
  </div>
</template>
