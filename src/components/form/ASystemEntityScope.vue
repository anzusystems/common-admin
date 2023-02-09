<script lang="ts" setup>
import { provide } from 'vue'
import { SubjectScopeSymbol, SystemScopeSymbol } from '@/components/injectionKeys'

const props = withDefaults(
  defineProps<{
    system: string
    subject: string
  }>(),
  {}
)
provide<string>(SystemScopeSymbol, props.system)
provide<string>(SubjectScopeSymbol, props.subject)
</script>

<template>
  <slot />
</template>
