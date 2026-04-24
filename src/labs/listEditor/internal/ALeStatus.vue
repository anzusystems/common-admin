<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// Reorder-mode header status pill. Legacy class (`.a-sortable-list-editor__toolbar-status`,
// `.a-nested-list-editor__toolbar-status`) is supplied by the parent via attrs
// fallthrough — inheritAttrs stays default so the class sticks to the root div.

export interface Props {
  hasPendingChanges: boolean
  pendingCount: number
  error?: string | null
}

withDefaults(defineProps<Props>(), {
  error: null,
})

const { t } = useI18n()
</script>

<template>
  <div>
    <VIcon
      v-if="hasPendingChanges"
      icon="mdi-circle-medium"
      color="warning"
      size="18"
    />
    <span
      v-if="error"
      class="text-body-small"
    >
      {{ error }}
    </span>
    <span
      v-else-if="hasPendingChanges"
      class="text-body-small"
    >
      {{ t('common.sortable.pendingChanges', { count: pendingCount }) }}
    </span>
    <span
      v-else
      class="text-body-small text-medium-emphasis"
    >
      {{ t('common.sortable.noPendingChanges') }}
    </span>
  </div>
</template>
