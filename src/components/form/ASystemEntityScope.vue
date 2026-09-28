<script lang="ts" setup>
import { provide } from 'vue'
import { SubjectScopeKey, SystemScopeKey } from '@/components/injectionKeys'

const props = withDefaults(
  defineProps<{
    system: string
    subject: string
  }>(),
  {}
)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
provide<string>(SystemScopeKey, props.system)
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
provide<string>(SubjectScopeKey, props.subject)
</script>

<template>
  <slot />
</template>
