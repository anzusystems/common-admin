<script lang="ts" setup>
import { computed, inject } from 'vue'
import type { DocId } from '@/shared/types/common'
import { useDamCachedKeywords } from '@/domains/dam/keyword/composables/cachedKeywords'
import {
  libraryUploadQueueSuggestions,
  UploadQueueSuggestionsKey,
} from '@/domains/dam/uploadQueue/components/uploadQueueBindings'
import { isNull, isUndefined } from '@/shared/utils/common'
import { useCachedItem } from '@/domains/cached/composables/useCachedItem'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    id: null | DocId | undefined
    title?: string
    queueId?: string | undefined
    forceRounded?: boolean
    textOnly?: boolean
    size?: string
    containerClass?: undefined | string
    /**
     * Props of the autocomplete's chip slot. With them, closing a closable chip
     * removes its value from the autocomplete, as Vuetify's own chip does.
     * Without them the close only hides the chip.
     */
    chipProps?: Record<string, unknown>
  }>(),
  {
    queueId: undefined,
    title: '',
    forceRounded: false,
    textOnly: false,
    size: 'small',
    containerClass: 'd-inline-flex',
    chipProps: undefined,
  }
)

const { getCachedKeyword, addToCachedKeywords, fetchCachedKeywords, pinCachedKeyword, unpinCachedKeyword } =
  useDamCachedKeywords(useDamConfigName())
// Uses the application's queues when provided, else the library's store, created only when a chip needs it.
const suggestionsOf = inject(UploadQueueSuggestionsKey, null) ?? libraryUploadQueueSuggestions

const { cached, loaded, unresolved } = useCachedItem(() => getCachedKeyword(props.id), {
  // Pins the shown name in the cache. A chip given a title shows no cached name.
  id: () => (props.title.length > 0 ? null : props.id),
  pin: pinCachedKeyword,
  unpin: unpinCachedKeyword,
  askFor: (id) => {
    addToCachedKeywords([id])
    fetchCachedKeywords()
  },
})

const displayNewIcon = computed(() => {
  if (!props.queueId || !cached.value) return undefined
  const suggestions = suggestionsOf(props.queueId)
  if (!suggestions) return undefined
  if (suggestions.newKeywordNames.has(cached.value.name)) return 'mdi-new-box'
  return undefined
})

const displayTitle = computed(() => {
  if (props.title.length > 0) return props.title
  // A keyword the server did not return has only its id to show.
  if (unresolved.value) return '#' + props.id
  if (cached.value) {
    return cached.value.name
  }
  return ''
})

const { t } = useI18n()
</script>

<template>
  <div :class="containerClass">
    <template v-if="isNull(id) || isUndefined(id)">
      <slot name="empty">-</slot>
    </template>
    <div
      v-else-if="textOnly"
      :title="unresolved ? t('common.model.cachedUnavailable') : undefined"
    >
      {{ displayTitle }}
      <VProgressCircular
        v-if="!loaded && title.length === 0"
        :size="12"
        :width="2"
        indeterminate
        class="mx-1"
      />
    </div>
    <VChip
      v-else
      v-bind="chipProps"
      :size="size"
      :append-icon="displayNewIcon"
      :label="forceRounded ? undefined : true"
      close-label="common.button.remove"
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
        v-if="!loaded && title.length === 0"
        :size="12"
        :width="2"
        indeterminate
        class="mx-1"
      />
    </VChip>
  </div>
</template>
