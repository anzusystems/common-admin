<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DocId } from '@/shared/types/common'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import { useCachedItem } from '@/domains/cached/composables/useCachedItem'

const props = withDefaults(
  defineProps<{
    id: null | DocId | undefined
    queueId?: string | undefined
  }>(),
  {
    queueId: undefined,
  }
)
const emit = defineEmits<{
  (e: 'addAuthor', data: DocId | null | undefined): void
}>()

const clickClose = () => {
  emit('addAuthor', props.id)
}

const { getCachedAuthor } = useDamCachedAuthors()

// As the author chip reads it. An author the server did not return is settled too: it has only its id to show,
// until a later ask for it finds it.
const { cached, loaded, unresolved } = useCachedItem(() => getCachedAuthor(props.id))

const displayTitle = computed(() => {
  if (unresolved.value) return '#' + props.id
  if (cached.value) {
    return cached.value.name + (cached.value.identifier?.length > 0 ? ` (${cached.value.identifier})` : '')
  }
  return ''
})

const { t } = useI18n()
</script>

<template>
  <VChip
    size="small"
    closable
    close-icon="mdi-plus"
    @click:close="clickClose"
  >
    {{ displayTitle }}
    <VTooltip
      v-if="unresolved"
      activator="parent"
      location="bottom"
    >
      {{ t('common.model.cachedUnavailable') }}
    </VTooltip>
    <VProgressCircular
      v-if="!loaded"
      :size="12"
      :width="2"
      indeterminate
      class="mx-1"
    />
  </VChip>
</template>
