import { computed, onScopeDispose, shallowRef, toValue, watchEffect, type MaybeRefOrGetter } from 'vue'
import type { Breadcrumbs } from '@/domains/system/composables/breadcrumbs'

export interface BrowserTitleFavicon {
  /** The `<link>` in the page head whose icon gets the dot, e.g. `link[rel="icon"][sizes="32x32"]`. */
  selector: string
  /** The same icon with the dot. */
  href: string
}

export interface BrowserTitleOptions {
  /** Put in front of every title with a colon, e.g. the environment ("Stage"); empty on production. */
  prefix?: MaybeRefOrGetter<string>
  /** Put after a page title: "Articles · Anzu". */
  appName: MaybeRefOrGetter<string>
  /** The title of a page without its own. */
  fallback: MaybeRefOrGetter<string>
  /** Which breadcrumb names the page, negative from the end. Default `-1`, the last one. */
  breadcrumbIndex?: number
  /** Icons with a dot, shown while a page reports new records. Browsers without favicon swapping show the count only. */
  favicons?: BrowserTitleFavicon[]
}

type Entry<T> = { token: symbol; value: T }

// The latest registration wins: a page that mounts before the previous one unmounts takes over at once.
const pageTitles = shallowRef<Entry<() => string>[]>([])
const badges = shallowRef<Entry<() => string>[]>([])
let breadcrumbIndex = -1

const register = (list: typeof pageTitles, value: () => string) => {
  const token = Symbol()
  list.value = [...list.value, { token, value }]
  return () => {
    list.value = list.value.filter((entry) => entry.token !== token)
  }
}

const breadcrumbTitle = (breadcrumbs: Breadcrumbs) => () => {
  const own = breadcrumbs.options.browserTitle
  if (typeof own === 'string') return own
  if (typeof own === 'function') return own()
  const index = typeof own === 'number' ? own : breadcrumbIndex
  return breadcrumbs.items.value.at(index)?.title ?? ''
}

/**
 * Names the browser tab after the page the breadcrumbs of the app bar's `AActionbar` lead to.
 * Used by `AActionbar`; returns the unregister call.
 */
export function registerBrowserTitleBreadcrumbs(breadcrumbs: Breadcrumbs) {
  return register(pageTitles, breadcrumbTitle(breadcrumbs))
}

/** Names the browser tab of a page that has no breadcrumbs in the app bar, for as long as the caller lives. */
export function useBrowserTitlePage(title: MaybeRefOrGetter<string>) {
  onScopeDispose(register(pageTitles, () => toValue(title)))
}

/**
 * Puts a count in front of the browser tab title, "(3) Articles · Anzu", and the dot on the favicon,
 * for as long as the caller lives. An empty label shows neither.
 */
export function useBrowserTitleBadge(label: MaybeRefOrGetter<string>) {
  onScopeDispose(register(badges, () => toValue(label)))
}

export const browserTitleBadge = computed(() => badges.value.at(-1)?.value() ?? '')

export const browserPageTitle = computed(() => pageTitles.value.at(-1)?.value() ?? '')

/** Builds the title the browser tab shows: `{prefix}: ({badge}) {page} · {appName}`. */
export function formatBrowserTitle(parts: {
  prefix: string
  badge: string
  page: string
  appName: string
  fallback: string
}) {
  const body = parts.page ? `${parts.page} · ${parts.appName}` : parts.fallback
  const withBadge = parts.badge ? `(${parts.badge}) ${body}` : body
  return parts.prefix ? `${parts.prefix}: ${withBadge}` : withBadge
}

/**
 * Keeps `document.title` and the favicon in line with the current page. Called once, in the admin's `App.vue`.
 */
export function useBrowserTitle(options: BrowserTitleOptions) {
  breadcrumbIndex = options.breadcrumbIndex ?? -1
  const originalHrefs = new Map<string, string>()

  watchEffect(() => {
    document.title = formatBrowserTitle({
      prefix: toValue(options.prefix) ?? '',
      badge: browserTitleBadge.value,
      page: browserPageTitle.value,
      appName: toValue(options.appName),
      fallback: toValue(options.fallback),
    })
  })

  watchEffect(() => {
    const withDot = browserTitleBadge.value !== ''
    for (const favicon of options.favicons ?? []) {
      const link = document.querySelector<HTMLLinkElement>(favicon.selector)
      if (!link) continue
      if (!originalHrefs.has(favicon.selector)) originalHrefs.set(favicon.selector, link.href)
      // `link.href` reads back absolute, so a relative href is resolved before comparing; otherwise every change of
      // the count would set the icon again and the browser load it again.
      const href = new URL(withDot ? favicon.href : originalHrefs.get(favicon.selector)!, document.baseURI).href
      if (link.href !== href) link.href = href
    }
  })
}
