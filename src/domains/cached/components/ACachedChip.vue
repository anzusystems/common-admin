<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { DocId, IntegerId } from '@/shared/types/common'
import { objectGetValueByPath } from '@/shared/utils/object'
import { isNull, isUndefined } from '@/shared/utils/common'
import { COMMON_CONFIG } from '@/shared/commonConfig'
import { useCachedItem } from '@/domains/cached/composables/useCachedItem'

const props = withDefaults(
  defineProps<{
    id?: null | undefined | IntegerId | DocId
    title?: string
    containerClass?: undefined | string
    getCachedFn: (id: any) => any
    displayTextPath: string
    route: string
    disableClick?: boolean
    openInNew?: boolean
    size?: string
    forceRounded?: boolean
    textOnly?: boolean
    fallbackIdText?: boolean
    wrapText?: boolean
    closable?: boolean
    customTitleFn?: (
      cachedItem: any,
      defaultTitle: string,
      displayTextPath: string,
      fallbackIdText: boolean
    ) => string | undefined
  }>(),
  {
    id: null,
    title: '',
    containerClass: 'd-inline-flex',
    disableClick: false,
    openInNew: false,
    size: 'small',
    forceRounded: false,
    textOnly: false,
    fallbackIdText: false,
    wrapText: false,
    closable: false,
    customTitleFn: undefined,
  }
)

const emit = defineEmits<{
  (e: 'close', id: null | undefined | IntegerId | DocId): void
}>()

const { t } = useI18n()
const router = useRouter()
const { cached, loaded, unresolved } = useCachedItem(() => props.getCachedFn(props.id as any))

// An item the fetch could not resolve has only its placeholder to show: its id, and no link to a
// detail that would not load either.
const linkDisabled = computed(() => props.disableClick || unresolved.value)

const containerClassComputed = computed(() => {
  return props.wrapText ? props.containerClass + ' a-chip--wrap' : props.containerClass
})

// A title given by the caller still wins over the placeholder.
const showUnresolved = computed(() => unresolved.value && props.title.length === 0)

const displayTitle = computed(() => {
  if (showUnresolved.value) return '#' + props.id
  if (props.customTitleFn && cached.value) {
    const customTitle = props.customTitleFn(cached.value, props.title, props.displayTextPath, props.fallbackIdText)
    if (customTitle !== undefined) {
      return customTitle
    }
  }
  if (props.title.length > 0) return props.title
  if (cached.value) {
    return objectGetValueByPath(cached.value, props.displayTextPath)
  }
  return props.fallbackIdText ? props.id : ''
})

const onClick = () => {
  router.push({ name: props.route, params: { id: props.id } })
}
</script>

<template>
  <div :class="containerClassComputed">
    <template v-if="isNull(id) || isUndefined(id)">
      <slot name="empty">-</slot>
    </template>
    <div
      v-else-if="textOnly"
      :title="unresolved ? t('common.model.cachedUnavailable') : undefined"
    >
      <slot
        v-if="showUnresolved"
        :id="id"
        name="unresolved"
      >
        {{ displayTitle }}
      </slot>
      <template v-else>{{ displayTitle }}</template>
      <VProgressCircular
        v-if="!loaded && title.length === 0"
        :size="12"
        :width="2"
        indeterminate
        class="mx-1"
      />
    </div>
    <VChip
      v-else-if="linkDisabled"
      :size="size"
      :label="forceRounded ? undefined : true"
      :closable="closable"
      @click:close="() => emit('close', id)"
    >
      <slot
        v-if="showUnresolved"
        :id="id"
        name="unresolved"
      >
        {{ displayTitle }}
      </slot>
      <template v-else>{{ displayTitle }}</template>
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
    <VChip
      v-else
      :size="size"
      :append-icon="openInNew ? COMMON_CONFIG.CHIP.ICON.LINK_EXTERNAL : COMMON_CONFIG.CHIP.ICON.LINK"
      :label="forceRounded ? undefined : true"
      :closable="closable"
      @click.stop="onClick"
      @click:close="() => emit('close', id)"
    >
      {{ displayTitle }}
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

<style lang="scss">
.a-chip--wrap {
  .v-chip {
    height: auto !important;
  }

  .v-chip .v-chip__content {
    max-width: 100%;
    height: auto;
    min-height: 26px;
    white-space: pre-wrap;
  }
}
</style>
