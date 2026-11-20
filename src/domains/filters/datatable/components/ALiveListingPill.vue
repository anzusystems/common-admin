<script lang="ts" setup>
import { computed } from 'vue'
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
  }>(),
  {
    max: 9,
    failed: false,
    changed: false,
    degraded: false,
    textKey: 'common.system.datatable.liveListing.newRecords',
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
</script>

<template>
  <div class="a-live-listing-pill">
    <VChip
      v-if="failed"
      color="warning"
      variant="flat"
      size="small"
      prepend-icon="mdi-alert-outline"
      class="a-live-listing-pill__item"
    >
      {{ t('common.system.datatable.liveListing.failed') }}
    </VChip>
    <VBtn
      v-else-if="count > 0"
      color="primary"
      size="small"
      rounded="pill"
      prepend-icon="mdi-arrow-up"
      class="a-live-listing-pill__item"
      @click.stop="emit('click')"
    >
      {{ text }}
    </VBtn>
    <VBtn
      v-else-if="changed"
      color="primary"
      size="small"
      rounded="pill"
      prepend-icon="mdi-refresh"
      class="a-live-listing-pill__item"
      @click.stop="emit('click')"
    >
      {{ t('common.system.datatable.liveListing.changes') }}
    </VBtn>
    <VChip
      v-else-if="degraded"
      color="warning"
      variant="flat"
      size="small"
      prepend-icon="mdi-lan-disconnect"
      class="a-live-listing-pill__item"
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
}
</style>
