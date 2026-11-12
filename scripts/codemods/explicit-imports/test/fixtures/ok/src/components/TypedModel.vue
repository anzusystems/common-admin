<script setup lang="ts">
const modelValue = defineModel<IntegerId | null>({ required: true })
const { t } = useI18n()
</script>

<template>
  <div :title="t('x')">{{ modelValue }}</div>
</template>
