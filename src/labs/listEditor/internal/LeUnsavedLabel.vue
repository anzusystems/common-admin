<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// Small "unsaved" pill (warning dot + translated label). Emits the shared
// `.a-le-unsaved-label` class directly — the flat `.a-le-*` namespace means
// every variant shares the same selector, no per-variant BEM prefix needed.

export interface Props {
  label?: string | null
}

withDefaults(defineProps<Props>(), {
  label: null,
})

const { t } = useI18n()
</script>

<template>
  <span class="a-le-unsaved-label">
    <VIcon
      icon="mdi-circle-medium"
      size="12"
    />
    {{ label ?? t('common.sortable.unsaved') }}
  </span>
</template>
