import { computed, type ComputedRef } from 'vue'
import type { DocId, IntegerId } from '@/shared/types/common'

export interface BreadcrumbItem {
  title: string
  routeName: string
  id?: IntegerId | DocId
  routeParams?: any
}

export interface Breadcrumbs {
  items: ComputedRef<Array<BreadcrumbItem>>
  options: BreadcrumbOptions
}

export interface BreadcrumbOptions {
  linkLastItem: boolean
  /**
   * What names the page in the browser tab: an item index (negative from the end), its own text, or a getter.
   * Default: the item `useBrowserTitle` is configured with, the last one unless set otherwise.
   */
  browserTitle?: number | string | (() => string)
}

export const defaultOptions: BreadcrumbOptions = {
  linkLastItem: false,
}

/**
 * Breadcrumbs of a page for `AActionbar`. A getter `items` is wrapped
 * in a `computed`, so it is read only when the actionbar renders.
 * An existing `ComputedRef` is kept as it is.
 */
export function defineBreadcrumbs(
  items: (() => Array<BreadcrumbItem>) | ComputedRef<Array<BreadcrumbItem>>,
  options: Partial<BreadcrumbOptions> = {}
): Breadcrumbs {
  return {
    items: typeof items === 'function' ? computed(items) : items,
    options: {
      ...defaultOptions,
      ...options,
    },
  }
}
