<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// Reorder-mode header status pill. Emits `.a-le-toolbar-status` on its root,
// caller adds the `--pending` modifier via class binding. inheritAttrs stays
// default so additional classes (e.g. the --pending modifier) stick to the
// root div.

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
  <div class="a-le-toolbar-status">
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
