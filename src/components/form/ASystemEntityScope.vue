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
// eslint-disable-next-line vue/no-setup-props-destructure
provide<string>(SystemScopeSymbol, props.system)
// eslint-disable-next-line vue/no-setup-props-destructure
provide<string>(SubjectScopeSymbol, props.subject)
</script>

<template>
  <slot />
</template>
