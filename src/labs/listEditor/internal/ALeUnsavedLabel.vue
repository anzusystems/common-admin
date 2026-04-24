<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// Small "unsaved" pill (warning dot + translated label). Legacy class
// (`.a-list-editor__unsaved-label`, `.a-sortable-list-editor__unsaved-label`,
// `.a-nested-list-editor__unsaved-label`) reaches the root span via Vue's
// default attrs fallthrough, so existing CSS rules keep matching unchanged.

export interface Props {
  label?: string | null
}

withDefaults(defineProps<Props>(), {
  label: null,
})

const { t } = useI18n()
</script>

<template>
  <span>
    <VIcon
      icon="mdi-circle-medium"
      size="12"
    />
    {{ label ?? t('common.sortable.unsaved') }}
  </span>
</template>
