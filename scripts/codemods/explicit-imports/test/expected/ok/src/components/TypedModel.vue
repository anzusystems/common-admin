<script setup lang="ts">
import type { IntegerId } from '@/types/ids'
import { useI18n } from 'vue-i18n'

const modelValue = defineModel<IntegerId | null>({ required: true })
const { t } = useI18n()
</script>

<template>
  <div :title="t('x')">{{ modelValue }}</div>
</template>
