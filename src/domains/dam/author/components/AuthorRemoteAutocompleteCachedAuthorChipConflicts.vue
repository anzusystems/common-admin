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

const { getCachedAuthor, addToCachedAuthors, fetchCachedAuthors, pinCachedAuthor, unpinCachedAuthor } =
  useDamCachedAuthors()

// As the author chip reads it. An author the server did not return is settled too: it has only its id to show,
// until a later ask for it finds it.
const { cached, loaded, unresolved } = useCachedItem(() => getCachedAuthor(props.id), {
  // The name the chip shows stays in the cache while it shows it.
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

// Named by its author, once the name has come: every "+" of the conflicts was "Add author" alone.
const addLabel = computed(() =>
  displayTitle.value.length > 0
    ? t('common.damImage.author.button.addConflictNamed', { name: displayTitle.value })
    : t('common.damImage.author.button.addConflict')
)
</script>

<template>
  <!-- The "+" adds the author, and is named so, by the author. Drawn here as the chip draws its close: the chip names
       its close by a key it translates without parameters, and a name could not go into it. The chip is not closable;
       its close is named all the same, as the rule of the library for chips asks. -->
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
