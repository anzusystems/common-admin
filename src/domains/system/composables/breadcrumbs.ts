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
}

export const defaultOptions: BreadcrumbOptions = {
  linkLastItem: false,
}

/**
 * The breadcrumbs of a page for `AActionbar`. `items` is a getter, wrapped in a `computed` here: read only when
 * the actionbar renders and again when what it reads changes, as `computed(() => [...])` written by the page.
 * A `ComputedRef` the page already has is kept as it is.
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
