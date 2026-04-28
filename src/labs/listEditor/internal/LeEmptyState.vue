<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// Shared empty-state block used by all three list-editor variants. Since the
// refactor to a flat `.a-le-*` namespace, the block class no longer depends
// on the parent variant — the same three classes render inside any editor.

export interface Props {
  title: string
  text: string
  addLabel?: string | null
  canAdd?: boolean
}

withDefaults(defineProps<Props>(), {
  addLabel: null,
  canAdd: false,
})

defineEmits<{
  add: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="a-le-empty">
    <h3 class="a-le-empty-title">
      {{ title }}
    </h3>
    <p class="a-le-empty-text">
      {{ text }}
    </p>
    <VBtn
      v-if="addLabel && canAdd"
      color="primary"
      variant="flat"
      prepend-icon="mdi-plus"
      @click="$emit('add')"
    >
      {{ t('common.sortable.addFirst') }}
    </VBtn>
  </div>
</template>
