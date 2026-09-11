import { type Component, defineComponent, h, type PropType } from 'vue'
import ACachedChip from '@/components/ACachedChip.vue'
import type { DocId, IntegerId } from '@/types/common'

export type CachedChipId = null | undefined | IntegerId | DocId

export interface CreateCachedChipOptions {
  /**
   * Composable returning the per-id cache getter — invoked inside the chip's
   * setup so the backing cache store resolves in component scope. The `id`
   * param is `any` to match `ACachedChip` and accept both numeric- and
   * doc-id getters regardless of their exact parameter type.
   */
  useGetCachedFn: () => (id: any) => unknown
  /** Named route the chip links to (e.g. `'/(cms)/desks/[id]'`). */
  route: string
  /** Dot-path into the cached entity for the chip label (e.g. `'name'`). */
  displayTextPath: string
  /** Static props baked onto every instance (e.g. a fixed `textOnly`). */
  chipProps?: Record<string, unknown>
  /** Component name for devtools / warnings. */
  name?: string
}

/**
 * Builds a cached-entity chip from a domain's cache composable + route, so each
 * per-domain `CachedXChip.vue` collapses to a single factory call instead of a
 * full SFC re-binding `ACachedChip`. Caller-passed attributes (`size`, `color`,
 * `disable-click`, …) and slots fall through to `ACachedChip`.
 *
 * Use in an SFC's plain `<script lang="ts">` (not `setup`):
 * ```ts
 * export default createCachedChip({
 *   useGetCachedFn: () => useCachedDesks().getCachedDesk,
 *   route: '/(cms)/desks/[id]',
 *   displayTextPath: 'name',
 * })
 * ```
 */
export function createCachedChip(options: CreateCachedChipOptions): Component {
  return defineComponent({
    name: options.name ?? 'CachedChip',
    inheritAttrs: false,
    // Vue skips type validation for null/undefined on non-required props, so a
    // null id (the common "empty" case) won't warn despite the typed prop.
    props: {
      id: { type: [Number, String] as PropType<CachedChipId>, default: null },
    },
    setup(props, { attrs, slots }) {
      const getCachedFn = options.useGetCachedFn()
      return () =>
        h(
          ACachedChip,
          {
            id: props.id,
            getCachedFn,
            route: options.route,
            displayTextPath: options.displayTextPath,
            ...options.chipProps,
            ...attrs,
          },
          slots,
        )
    },
  })
}
