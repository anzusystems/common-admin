<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// Small "unsaved" pill (warning dot + translated label). Emits the shared
// `.a-le-unsaved-label` class directly — the flat `.a-le-*` namespace means
// every variant shares the same selector, no per-variant BEM prefix needed.
// `dotOnly` (chips mode) drops the label, leaving just the inline warning dot;
// the label is kept as a native title tooltip so the marker stays meaningful.

export interface Props {
  label?: string | null
  dotOnly?: boolean
}

withDefaults(defineProps<Props>(), {
  label: null,
  dotOnly: false,
})

const { t } = useI18n()
</script>

<template>
  <span
    class="a-le-unsaved-label"
    :class="{ 'a-le-unsaved-label--dot': dotOnly }"
    :title="dotOnly ? (label ?? t('common.sortable.unsaved')) : undefined"
  >
    <VIcon
      icon="mdi-circle-medium"
      size="12"
    />
    <template v-if="!dotOnly">
      {{ label ?? t('common.sortable.unsaved') }}
    </template>
  </span>
</template>
