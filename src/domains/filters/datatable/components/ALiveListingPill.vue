<script lang="ts" setup>
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    count: number
    max?: number
    failed?: boolean
    /** Records already listed changed: the pill offers a reload while nothing new is counted. */
    changed?: boolean
    /** New records are looked for less promptly than usual, e.g. while backend signals are down. */
    degraded?: boolean
    /** Key with the plural forms `1 | 2–4 | 5+`; `{count}` is the number, or `max+` above `max`. */
    textKey?: string
    /** A smaller pill, 24px high with 11px text, for a narrow list. */
    compact?: boolean
  }>(),
  {
    max: 9,
    failed: false,
    changed: false,
    degraded: false,
    textKey: 'common.system.datatable.liveListing.newRecords',
    compact: false,
  }
)
const emit = defineEmits<{
  (e: 'click'): void
}>()

const { t } = useI18n()

const text = computed(() => {
  const overflow = props.count > props.max
  const count = overflow ? `${props.max}+` : props.count
  return t(props.textKey, { count }, overflow ? props.max + 1 : props.count)
})

const itemClass = computed(() => ['a-live-listing-pill__item', { 'a-live-listing-pill__item--compact': props.compact }])

const root = useTemplateRef<HTMLElement>('root')
// How far the list has scrolled past the place where the pill rests: the top of the element after it, as the pill
// takes no height. Above zero the pill is stuck over the rows.
const scrolledPast = () => {
  const el = root.value
  const next = el?.nextElementSibling
  if (!el || !next) return 0
  return el.getBoundingClientRect().top - next.getBoundingClientRect().top
}

// The box the pill sticks in: the nearest ancestor that scrolls (overflow other than visible or clip), else the window.
const scrollerOf = (el: HTMLElement) => {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY
    if (overflow !== 'visible' && overflow !== 'clip') return node
  }
  return window
}

// Where the pill rests the click only reloads; stuck over the rows it also scrolls the list back to that place.
const clickNew = () => {
  const by = scrolledPast()
  if (root.value && by > 1) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scrollerOf(root.value).scrollBy({ top: -by, behavior: reduce ? 'auto' : 'smooth' })
  }
  emit('click')
}
</script>

<template>
  <div
    ref="root"
    class="a-live-listing-pill"
  >
    <!-- An offered reload stays clickable after a failed probe: the click loads the list anyway. -->
    <VBtn
      v-if="count > 0"
      color="primary"
      size="small"
      rounded="pill"
      prepend-icon="mdi-arrow-up"
      :class="itemClass"
      @click.stop="clickNew"
    >
      {{ text }}
    </VBtn>
    <VBtn
      v-else-if="changed"
      color="primary"
      size="small"
      rounded="pill"
      prepend-icon="mdi-refresh"
      :class="itemClass"
      @click.stop="emit('click')"
    >
      {{ t('common.system.datatable.liveListing.changes') }}
    </VBtn>
    <VChip
      v-else-if="failed"
      color="warning"
      variant="flat"
      size="small"
      prepend-icon="mdi-alert-outline"
      :class="itemClass"
    >
      {{ t('common.system.datatable.liveListing.failed') }}
    </VChip>
    <VChip
      v-else-if="degraded"
      color="warning"
      variant="flat"
      size="small"
      prepend-icon="mdi-lan-disconnect"
      :class="itemClass"
    >
      {{ t('common.system.datatable.liveListing.degraded') }}
    </VChip>
  </div>
</template>

<style lang="scss">
// Floats over the top of the list and stays there while it scrolls; it takes no height, so no row moves.
.a-live-listing-pill {
  position: sticky;
  top: calc(var(--v-layout-top, 0px) + 0.25rem);
  z-index: 3;
  display: flex;
  justify-content: center;
  height: 0;
  overflow: visible;

  &__item {
    margin-top: 0.25rem;
  }

  // A message longer than the room wraps rather than reach past the list or what sits beside the pill. Stretched in
  // the pill, which has no height, the chip would keep only its minimum height.
  .v-chip.a-live-listing-pill__item {
    align-self: flex-start;
    height: auto;
    min-height: var(--v-chip-height);
    white-space: normal;
  }

  .v-btn.a-live-listing-pill__item--compact {
    --v-btn-height: 24px;
    --v-btn-size: 0.6875rem;

    padding: 0 0.625rem;
    font-size: 0.6875rem;
  }

  .v-chip.a-live-listing-pill__item--compact {
    --v-chip-height: 24px;
    --v-chip-size: 0.6875rem;

    padding-block: 0.0625rem;
    font-size: 0.6875rem;
    line-height: 0.8125rem;
  }
}

// A card clips its content with overflow: hidden, which also makes it the box the pill sticks in, so the pill would
// scroll away with the list; clip cuts the same edges and leaves the pill stuck to the window.
.v-card:has(.a-live-listing-pill) {
  overflow: clip;
}
</style>
