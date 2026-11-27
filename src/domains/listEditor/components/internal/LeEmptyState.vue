<script setup lang="ts">
import { useI18n } from 'vue-i18n'

export interface Props {
  title: string
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
    <VBtn
      v-if="addLabel && canAdd"
      color="primary"
      variant="flat"
      prepend-icon="mdi-plus"
      @click="$emit('add')"
    >
      {{ addLabel || t('common.sortable.addFirst') }}
    </VBtn>
  </div>
</template>
