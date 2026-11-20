<script lang="ts" setup>
import { useEventListener } from '@vueuse/core'
import { nextTick, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    /** Whether the panel shows; `isOpen` of `useDatatableSidePanel`. */
    open: boolean
    /** Panel width in px; `width` of `useDatatableSidePanel`. */
    width: number
    /** The shown record; when it changes, its text scrolls back to the top. */
    itemKey?: unknown
    /** The selected row in the list, scrolled into view when the panel narrows the list. */
    selectedRowSelector?: string
  }>(),
  {
    itemKey: undefined,
    selectedRowSelector: '.tr--selected',
  }
)
const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()

const listRef = useTemplateRef<HTMLElement>('listRef')
const bodyRef = useTemplateRef<HTMLElement>('bodyRef')

const revealSelectedRow = async () => {
  await nextTick()
  listRef.value?.querySelector(props.selectedRowSelector)?.scrollIntoView({ block: 'nearest' })
}

watch(
  () => props.itemKey,
  async () => {
    if (!props.open) return
    await nextTick()
    bodyRef.value?.scrollTo({ top: 0 })
    await revealSelectedRow()
  }
)

watch(
  () => props.open,
  (open) => {
    if (open) void revealSelectedRow()
  }
)

// Esc closes the panel, unless it closes a dialog or a menu first: that overlay is still active when the key reaches the document.
useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (!props.open || event.key !== 'Escape' || event.defaultPrevented) return
  if (document.querySelector('.v-dialog.v-overlay--active, .v-menu.v-overlay--active')) return
  emit('close')
})
</script>

<template>
  <div class="a-datatable-side-panel">
    <div
      ref="listRef"
      class="a-datatable-side-panel__list"
    >
      <slot />
    </div>
    <aside
      v-if="open"
      class="a-datatable-side-panel__panel"
      :style="{ width: `${width}px`, flexBasis: `${width}px` }"
    >
      <div class="a-datatable-side-panel__header">
        <div class="a-datatable-side-panel__header-content">
          <slot name="header" />
        </div>
        <VBtn
          v-tooltip="t('common.button.close')"
          icon="mdi-close"
          variant="text"
          size="small"
          class="a-datatable-side-panel__close"
          @click.stop="emit('close')"
        />
      </div>
      <div
        ref="bodyRef"
        class="a-datatable-side-panel__body"
      >
        <slot name="panel" />
      </div>
    </aside>
  </div>
</template>

<style lang="scss">
// The list narrows next to the panel; the panel stays in the window while the list scrolls,
// and only its body scrolls, so the header with the actions stays in view.
.a-datatable-side-panel {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  min-width: 0;

  &__list {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__panel {
    position: sticky;
    top: var(--v-layout-top, 0);
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    height: calc(100dvh - var(--v-layout-top, 0px) - var(--v-layout-bottom, 0px));
    border-left: thin solid rgb(var(--v-border-color), var(--v-border-opacity));
  }

  &__header {
    flex: 0 0 auto;
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem 0.5rem 0.75rem 1rem;
    border-bottom: thin solid rgb(var(--v-border-color), var(--v-border-opacity));
  }

  &__header-content {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__close {
    flex: 0 0 auto;
  }

  &__body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 1rem;
  }
}
</style>
