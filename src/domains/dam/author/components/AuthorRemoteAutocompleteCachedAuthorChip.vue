<script lang="ts" setup>
import { computed, inject, ref, useTemplateRef } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import {
  libraryUploadQueueSuggestions,
  UploadQueueSuggestionsKey,
} from '@/domains/dam/uploadQueue/components/uploadQueueBindings'
import { isNull, isUndefined } from '@/shared/utils/common'
import type { DocId } from '@/shared/types/common'
import { useI18n } from 'vue-i18n'
import { useCachedItem } from '@/domains/cached/composables/useCachedItem'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

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
     * Props of the autocomplete's chip slot. With them, closing a closable chip
     * removes its value from the autocomplete, as Vuetify's own chip does.
     * Without them the close only hides the chip.
     */
    chipProps?: Record<string, unknown>
    /** DAM configuration for the names. Inherited when not given. */
    configName?: string
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
    configName: undefined,
  }
)

const { getCachedAuthor, addToCachedAuthors, fetchCachedAuthors, pinCachedAuthor, unpinCachedAuthor } =
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  useDamCachedAuthors(useDamConfigName(props.configName))
// Uses the application's queues when provided, else the library's store, created only when a chip needs it.
const suggestionsOf = inject(UploadQueueSuggestionsKey, null) ?? libraryUploadQueueSuggestions

const { cached, loaded, unresolved } = useCachedItem(() => getCachedAuthor(props.id), {
  // Pins the shown name in the cache. A chip given a title shows no cached name.
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

const nameElement = useTemplateRef<HTMLElement>('name')
const nameTruncated = ref(false)
useResizeObserver(nameElement, () => {
  if (!nameElement.value) return
  nameTruncated.value = nameElement.value.scrollWidth > nameElement.value.clientWidth
})

const displayReviewed = computed(() => {
  if (props.forceReviewed) return true
  if (cached.value?.reviewed) return true
  return false
})

const { t } = useI18n()
</script>

<template>
  <div :class="[containerClass, 'a-author-chip']">
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
      close-label="common.button.remove"
    >
      <span
        ref="name"
        class="text-truncate"
      >
        {{ displayTitle }}
      </span>
      <VTooltip
        v-if="unresolved || nameTruncated"
        activator="parent"
        location="bottom"
      >
        {{ unresolved ? t('common.model.cachedUnavailable') : displayTitle }}
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

<style lang="scss" scoped>
// A long author name must not push the chip over the field's clear and menu icons.
.a-author-chip {
  max-width: 100%;
}

.a-author-chip :deep(.v-chip__content) {
  min-width: 0;
}
</style>
