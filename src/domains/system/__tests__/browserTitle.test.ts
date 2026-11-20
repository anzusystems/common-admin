import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { defineBreadcrumbs } from '@/domains/system/composables/breadcrumbs'
import {
  formatBrowserTitle,
  registerBrowserTitleBreadcrumbs,
  useBrowserTitle,
  useBrowserTitleBadge,
  useBrowserTitlePage,
} from '@/domains/system/composables/browserTitle'

const scopes: ReturnType<typeof effectScope>[] = []
const cleanups: (() => void)[] = []
const run = (fn: () => void) => {
  const scope = effectScope()
  scope.run(fn)
  scopes.push(scope)
  return scope
}

afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  cleanups.splice(0).forEach((cleanup) => cleanup())
  document.head.querySelectorAll('link[data-test]').forEach((link) => link.remove())
})

const startApp = (prefix = '') => run(() => useBrowserTitle({ prefix, appName: 'Anzu', fallback: 'Anzu CMS admin' }))

describe('formatBrowserTitle', () => {
  it('puts the prefix, the count, the page and the app in this order', () => {
    expect(formatBrowserTitle({ prefix: 'Stage', badge: '3', page: 'News', appName: 'Anzu', fallback: 'x' })).toBe(
      'Stage: (3) News · Anzu'
    )
    expect(formatBrowserTitle({ prefix: '', badge: '9+', page: 'News', appName: 'Anzu', fallback: 'x' })).toBe(
      '(9+) News · Anzu'
    )
    expect(formatBrowserTitle({ prefix: '', badge: '', page: '', appName: 'Anzu', fallback: 'Anzu CMS admin' })).toBe(
      'Anzu CMS admin'
    )
  })
})

describe('useBrowserTitle', () => {
  it('names the tab after the last breadcrumb, or the page own title', async () => {
    startApp('Stage')
    await nextTick()
    expect(document.title).toBe('Stage: Anzu CMS admin')

    const headline = ref('Headline')
    cleanups.push(
      registerBrowserTitleBreadcrumbs(
        defineBreadcrumbs(() => [
          { title: 'Articles', routeName: 'list' },
          { title: headline.value, routeName: 'detail' },
        ])
      )
    )
    await nextTick()
    expect(document.title).toBe('Stage: Headline · Anzu')
    headline.value = 'Renamed'
    await nextTick()
    expect(document.title).toBe('Stage: Renamed · Anzu')

    cleanups.push(
      registerBrowserTitleBreadcrumbs(
        defineBreadcrumbs(() => [{ title: 'Settings', routeName: 'settings' }], { browserTitle: 'Own' })
      )
    )
    await nextTick()
    expect(document.title).toBe('Stage: Own · Anzu')
  })

  it('shows the count and the dot while a page reports one, and drops both when it leaves', async () => {
    const link = document.createElement('link')
    link.rel = 'icon'
    link.setAttribute('sizes', '32x32')
    link.dataset.test = ''
    link.href = '/favicon-32x32.png'
    document.head.appendChild(link)
    run(() =>
      useBrowserTitle({
        appName: 'Anzu',
        fallback: 'Anzu CMS admin',
        favicons: [{ selector: 'link[data-test][sizes="32x32"]', href: '/favicon-32x32-new.png' }],
      })
    )
    const label = ref('3')
    const page = run(() => {
      useBrowserTitlePage('News')
      useBrowserTitleBadge(label)
    })
    await nextTick()
    expect(document.title).toBe('(3) News · Anzu')
    expect(link.href).toMatch(/favicon-32x32-new\.png$/)

    // Another count keeps the icon: it is not set, and so not loaded, again.
    const hrefSet = vi.spyOn(link, 'href', 'set')
    label.value = '4'
    await nextTick()
    expect(hrefSet).not.toHaveBeenCalled()
    hrefSet.mockRestore()

    label.value = ''
    await nextTick()
    expect(document.title).toBe('News · Anzu')
    expect(link.href).toMatch(/favicon-32x32\.png$/)

    label.value = '9+'
    await nextTick()
    page.stop()
    await nextTick()
    expect(document.title).toBe('Anzu CMS admin')
    expect(link.href).toMatch(/favicon-32x32\.png$/)
  })
})
