<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DocId } from '@/shared/types/common'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import { useCachedItem } from '@/domains/cached/composables/useCachedItem'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

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

const { getCachedAuthor, addToCachedAuthors, fetchCachedAuthors, pinCachedAuthor, unpinCachedAuthor } =
  useDamCachedAuthors(useDamConfigName())

// An author the server did not return also counts as settled. It shows only its id until a later request finds it.
const { cached, loaded, unresolved } = useCachedItem(() => getCachedAuthor(props.id), {
  id: () => props.id,
  pin: pinCachedAuthor,
  unpin: unpinCachedAuthor,
  askFor: (id) => {
    addToCachedAuthors([id])
    fetchCachedAuthors()
  },
})

const displayTitle = computed(() => {
  if (unresolved.value) return '#' + props.id
  if (cached.value) {
    return cached.value.name + (cached.value.identifier?.length > 0 ? ` (${cached.value.identifier})` : '')
  }
  return ''
})

const { t } = useI18n()

// Labelled with the author name once loaded. Otherwise every "+" read only "Add author".
const addLabel = computed(() =>
  displayTitle.value.length > 0
    ? t('common.damImage.author.button.addConflictNamed', { name: displayTitle.value })
    : t('common.damImage.author.button.addConflict')
)
</script>

<template>
  <!--
    The "+" is drawn here because the chip labels its close with a key
    translated without parameters, so the author name cannot go in.
    The chip is not closable. The "+" is still labelled, as the library's chip rule requires.
  -->
  <VChip
    size="small"
    close-label="common.damImage.author.button.addConflict"
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
    <button
      class="v-chip__close"
      type="button"
      data-testid="close-chip"
      :aria-label="addLabel"
      @click.stop.prevent="clickClose"
    >
      <VIcon
        icon="mdi-plus"
        size="x-small"
      />
    </button>
  </VChip>
</template>
