import { type ComputedRef } from 'vue'
import type { DocId, IntegerId } from '@/types/common'

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

export function defineBreadcrumbs(items: ComputedRef<Array<BreadcrumbItem>>, options: Partial<BreadcrumbOptions> = {}) {
  return {
    items,
    options: {
      ...defaultOptions,
      ...options,
    },
  }
}
