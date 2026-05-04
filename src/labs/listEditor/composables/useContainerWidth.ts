import { computed, type ComputedRef, type Ref } from 'vue'
import { useElementSize } from '@vueuse/core'

// Aligns JS-driven layout decisions (close button variant, mobile title icon)
// with the CSS `@container le-shell` queries which fire on the editor's own
// width rather than the viewport. Default threshold matches the 768/769 split
// in `_shared.scss` and per-component narrow-container blocks.
export function useContainerWidth(
  el: Ref<HTMLElement | null | undefined>,
  threshold = 769,
): { width: Ref<number>; isNarrow: ComputedRef<boolean> } {
  const { width } = useElementSize(el)
  const isNarrow = computed(() => width.value > 0 && width.value < threshold)
  return { width, isNarrow }
}
