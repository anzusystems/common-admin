<script lang="ts" setup>
import { computed } from 'vue'
import { useDamCachedAuthors } from '@/components/damImage/uploadQueue/author/cachedAuthors'
import { useUploadQueuesStore } from '@/components/damImage/uploadQueue/composables/uploadQueuesStore'
import { isNull, isUndefined } from '@/utils/common'
import type { DocId } from '@/types/common'
import { useI18n } from 'vue-i18n'
import { useCachedItem } from '@/composables/system/useCachedItem'

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
  }>(),
  {
    queueId: undefined,
    title: '',
    forceRounded: false,
    textOnly: false,
    size: 'small',
    containerClass: 'd-inline-flex',
    forceReviewed: undefined,
  },
)

const { getCachedAuthor } = useDamCachedAuthors()
const uploadQueuesStore = useUploadQueuesStore()

const { cached, loaded } = useCachedItem(() => getCachedAuthor(props.id))

const displayNewIcon = computed(() => {
  if (!props.queueId) return undefined
  const queue = uploadQueuesStore.getQueue(props.queueId)
  if (!queue || !cached.value) return undefined
  if (queue.suggestions.newAuthorNames.has(cached.value.name)) return 'mdi-new-box'
  return undefined
})

const displayTitle = computed(() => {
  if (props.title.length > 0) return props.title
  if (cached.value) {
    return (
      cached.value.name +
      (cached.value.identifier?.length > 0 ? ` (${cached.value.identifier})` : '')
    )
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
    <div v-else-if="textOnly">
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
      :size="size"
      :append-icon="displayNewIcon"
      :label="forceRounded ? undefined : true"
      :title="displayReviewed ? t('common.damImage.author.model.flags.reviewed') : undefined"
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
        class="text-success ml-1"
        size="small"
        :title="t('common.damImage.author.model.flags.reviewed')"
      />
    </VChip>
  </div>
</template>
