<script lang="ts" setup>
import { computed, inject } from 'vue'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import {
  libraryUploadQueueSuggestions,
  UploadQueueSuggestionsKey,
} from '@/domains/dam/uploadQueue/components/uploadQueueBindings'
import { isNull, isUndefined } from '@/shared/utils/common'
import type { DocId } from '@/shared/types/common'
import { useI18n } from 'vue-i18n'
import { useCachedItem } from '@/domains/cached/composables/useCachedItem'

const props = withDefaults(
  defineProps<{
    id: null | DocId | undefined
    title?: string
    queueId?: string | undefined
    forceRounded?: boolean
    textOnly?: boolean
    size?: string
    containerClass?: undefined | string
    forceReviewed?: undefined | boolean
    /**
     * The props of the chip slot of the autocomplete the chip is drawn in: with them, the close of a closable chip
     * takes its value out of the autocomplete, as Vuetify's own chip does. Without them it only hid the chip.
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
    forceReviewed: undefined,
    chipProps: undefined,
  }
)

const { getCachedAuthor, addToCachedAuthors, fetchCachedAuthors, pinCachedAuthor, unpinCachedAuthor } =
  useDamCachedAuthors()
// The application's queues where it provides them, else the library's store, asked for only when a chip needs it.
const suggestionsOf = inject(UploadQueueSuggestionsKey, null) ?? libraryUploadQueueSuggestions

const { cached, loaded, unresolved } = useCachedItem(() => getCachedAuthor(props.id), {
  // The name the chip shows stays in the cache while it shows it. A chip given its title shows no name.
  id: () => (props.title.length > 0 ? null : props.id),
  pin: pinCachedAuthor,
  unpin: unpinCachedAuthor,
  askFor: (id) => {
    addToCachedAuthors([id])
    fetchCachedAuthors()
  },
})

const displayNewIcon = computed(() => {
  if (!props.queueId || !cached.value) return undefined
  const suggestions = suggestionsOf(props.queueId)
  if (!suggestions) return undefined
  if (suggestions.newAuthorNames.has(cached.value.name)) return 'mdi-new-box'
  return undefined
})

const displayTitle = computed(() => {
  if (props.title.length > 0) return props.title
  // An author the server did not return has only its id to show.
  if (unresolved.value) return '#' + props.id
  if (cached.value) {
    return cached.value.name + (cached.value.identifier?.length > 0 ? ` (${cached.value.identifier})` : '')
  }
  return ''
})

const displayReviewed = computed(() => {
  if (props.forceReviewed) return true
  if (cached.value?.reviewed) return true
  return false
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
      <VIcon
        v-if="displayReviewed"
        icon="mdi-shield-check"
        size="small"
        class="text-success ml-1"
        :title="t('common.damImage.author.model.flags.reviewed')"
      />
    </div>
    <VChip
      v-else
      v-bind="chipProps"
      :size="size"
      :append-icon="displayNewIcon"
      :label="forceRounded ? undefined : true"
      :title="displayReviewed ? t('common.damImage.author.model.flags.reviewed') : undefined"
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
      <VIcon
        v-if="displayReviewed"
        icon="mdi-shield-check"
        class="text-success ml-1"
        size="small"
        :title="t('common.damImage.author.model.flags.reviewed')"
      />
    </VChip>
  </div>
</template>
