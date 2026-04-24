<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

// Shared empty-state block used by all three list-editor variants. The outer
// editor supplies the legacy BEM block name (`a-list-editor`,
// `a-sortable-list-editor`, `a-nested-list-editor`) via `blockClass` so the
// rendered `__empty`, `__empty-title`, `__empty-text` class suffixes match each
// editor's existing CSS without any selector churn.

export interface Props {
  title: string
  text: string
  blockClass: string
  addLabel?: string | null
  canAdd?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  addLabel: null,
  canAdd: false,
})

defineEmits<{
  add: []
}>()

const { t } = useI18n()

const emptyClass = computed(() => `${props.blockClass}__empty`)
const titleClass = computed(() => `${props.blockClass}__empty-title`)
const textClass = computed(() => `${props.blockClass}__empty-text`)
</script>

<template>
  <div :class="emptyClass">
    <h3 :class="titleClass">
      {{ title }}
    </h3>
    <p :class="textClass">
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
