import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter, NavigationFailureType, type Router } from 'vue-router'
import AActionSaveButton from '@/domains/ui/buttons/action/components/AActionSaveButton.vue'
import AActionDeleteButton from '@/domains/ui/buttons/action/components/AActionDeleteButton.vue'
import AActionEditButton from '@/domains/ui/buttons/action/components/AActionEditButton.vue'
import AActionCreateButton from '@/domains/ui/buttons/action/components/AActionCreateButton.vue'
import AActionCloseButtonHistory from '@/domains/ui/buttons/action/components/AActionCloseButtonHistory.vue'
import { useRouteHistory } from '@/domains/system/composables/routeHistory'
import { useDatatablePageStore } from '@/domains/system/store/datatablePageStore'
import { useCommonVuetifyPlugins } from '@/test/support/commonVuetify'

const Empty = defineComponent(() => () => null)
let router: Router

useCommonVuetifyPlugins()

beforeEach(async () => {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Empty },
      { path: '/articles', name: 'articleList', component: Empty },
      { path: '/articles/new', name: 'articleCreate', component: Empty },
      { path: '/articles/:id', name: 'articleDetail', component: Empty },
      { path: '/articles/:id/edit', name: 'articleEdit', component: Empty },
      { path: '/sites/:siteId/articles/:id/edit', name: 'siteArticleEdit', component: Empty },
    ],
  })
  await router.push('/')
  await router.isReady()
})

const wrappers: VueWrapper[] = []
const track = <T extends VueWrapper>(w: T) => {
  wrappers.push(w)
  return w
}
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  document.body.innerHTML = ''
})

/** Mounts `component` inside a parent that records clicks reaching it. */
const mountInParent = (
  component: unknown,
  props: Record<string, unknown> = {},
  attrs: Record<string, unknown> = {}
) => {
  const parentClick = vi.fn()
  const wrapper = track(
    mount(
      defineComponent({
        setup: () => () => h('div', { onClick: parentClick }, [h(component as never, { ...props, ...attrs })]),
      }),
      { attachTo: document.body, global: { plugins: [router] } }
    )
  )
  return { wrapper, parentClick, child: wrapper.findComponent(component as never) as VueWrapper<any> }
}

const icon = (w: VueWrapper) =>
  w
    .find('.v-icon')
    .classes()
    .find((c) => c.startsWith('mdi-'))

describe('AActionSaveButton', () => {
  it('emits saveRecord once and stops the click', async () => {
    const { child, parentClick } = mountInParent(AActionSaveButton)
    expect(child.text()).toBe('Save')
    await child.find('button').trigger('click')
    expect(child.emitted('saveRecord')).toHaveLength(1)
    expect(parentClick).not.toHaveBeenCalled()
  })

  it('does not emit when disabled', async () => {
    const { child } = mountInParent(AActionSaveButton, { disabled: true })
    await child.find('button').trigger('click')
    expect(child.emitted('saveRecord')).toBeUndefined()
  })

  it('blurs itself so Enter does not press it again', async () => {
    const { child } = mountInParent(AActionSaveButton)
    const button = child.find('button').element as HTMLButtonElement
    button.focus()
    button.click()
    await nextTick()
    expect(document.activeElement).not.toBe(button)
  })

  it('maps the variants to Vuetify variants', () => {
    const cases: Array<[string, string]> = [
      ['primary', 'v-btn--variant-flat'],
      ['secondary', 'v-btn--variant-outlined'],
      ['tertiary', 'v-btn--variant-text'],
      ['icon', 'v-btn--variant-text'],
    ]
    for (const [variant, cls] of cases) {
      const { child } = mountInParent(AActionSaveButton, { variant })
      expect(child.find('.v-btn').classes(), variant).toContain(cls)
    }
  })

  it('renders a save icon for the icon variant and a custom label', () => {
    const { child } = mountInParent(AActionSaveButton, { variant: 'icon', dataCy: 'x' })
    expect(icon(child)).toBe('mdi-content-save')
    expect(child.find('[data-cy="x"]').exists()).toBe(true)
    const custom = mountInParent(AActionSaveButton, { buttonT: 'common.button.close' })
    expect(custom.child.text()).toBe('Close')
  })
})

describe('AActionDeleteButton', () => {
  const panel = () => document.querySelector('[data-cy="delete-panel"]')
  const confirm = () => document.querySelector('[data-cy="button-confirm-delete"]') as HTMLElement
  const cancel = () => document.querySelector('[data-cy="button-cancel"]') as HTMLElement

  const open = async (props: Record<string, unknown> = {}) => {
    const mounted = mountInParent(AActionDeleteButton, props)
    await mounted.child.find('button').trigger('click')
    await flushPromises()
    return mounted
  }

  it('asks before deleting', async () => {
    const { child, parentClick } = await open()
    expect(panel()?.textContent).toContain('Remove?')
    expect(child.emitted('deleteRecord')).toBeUndefined()
    expect(parentClick).not.toHaveBeenCalled()
  })

  it('renders the confirm buttons as real buttons', async () => {
    await open()
    expect(confirm()?.tagName).toBe('BUTTON')
    expect(cancel()?.tagName).toBe('BUTTON')
  })

  it('emits deleteRecord on confirm and closes', async () => {
    const { child } = await open()
    confirm().click()
    await flushPromises()
    expect(child.emitted('deleteRecord')).toHaveLength(1)
    expect(panel()).toBeNull()
  })

  it('closes without emitting on cancel', async () => {
    const { child } = await open()
    cancel().click()
    await flushPromises()
    expect(child.emitted('deleteRecord')).toBeUndefined()
    expect(panel()).toBeNull()
  })

  it('acknowledges the leave guard before emitting', async () => {
    const order: string[] = []
    const guard = { acknowledge: vi.fn(() => order.push('ack')) }
    const { child } = await open({ guard, onDeleteRecord: () => order.push('delete') })
    confirm().click()
    await flushPromises()
    expect(guard.acknowledge).toHaveBeenCalledOnce()
    expect(order).toEqual(['ack', 'delete'])
    expect(child.emitted('deleteRecord')).toHaveLength(1)
  })

  it('stays open with disableCloseAfterConfirm until closeDialog', async () => {
    const { child } = await open({ disableCloseAfterConfirm: true })
    confirm().click()
    await flushPromises()
    expect(panel()).not.toBeNull()
    child.vm.closeDialog()
    await flushPromises()
    expect(panel()).toBeNull()
  })

  it('does not open when disabled (icon variant)', async () => {
    await open({ disabled: true })
    expect(panel()).toBeNull()
  })

  // The text variants used to drop `disabled` and `loading`, so the button stayed active and opened
  // the dialog.
  it('does not open when disabled (text variants)', async () => {
    for (const variant of ['primary', 'secondary', 'tertiary']) {
      await open({ disabled: true, variant })
      expect(panel(), variant).toBeNull()
    }
  })

  it('shows loading on the text variants', () => {
    const { child } = mountInParent(AActionDeleteButton, { loading: true, variant: 'secondary' })
    expect(child.find('.v-btn').classes()).toContain('v-btn--loading')
  })
})

describe('AActionEditButton', () => {
  it('navigates to the record and emits editRecord', async () => {
    const { child, parentClick } = mountInParent(AActionEditButton, { routeName: 'articleEdit', recordId: 5 })
    expect(child.text()).toBe('Edit')
    await child.find('button').trigger('click')
    await flushPromises()
    expect(child.emitted('editRecord')).toHaveLength(1)
    expect(router.currentRoute.value.fullPath).toBe('/articles/5/edit')
    expect(parentClick).not.toHaveBeenCalled()
  })

  it('prefers routeParams over recordId', async () => {
    const { child } = mountInParent(AActionEditButton, {
      routeName: 'siteArticleEdit',
      recordId: 1,
      routeParams: { siteId: 3, id: 9 },
    })
    await child.find('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/sites/3/articles/9/edit')
  })

  it('takes a DocId', async () => {
    const { child } = mountInParent(AActionEditButton, {
      routeName: 'articleEdit',
      recordId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    })
    await child.find('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.params.id).toBe('3f2504e0-4f89-11d3-9a0c-0305e82c3301')
  })

  // The icon variant was copied from the save button and kept its floppy-disk icon.
  it('shows an edit icon for the icon variant', () => {
    const { child } = mountInParent(AActionEditButton, { routeName: 'articleEdit', recordId: 1, variant: 'icon' })
    expect(icon(child)).toBe('mdi-pencil')
  })
})

describe('AActionCreateButton', () => {
  it('links to the create route', async () => {
    const { child } = mountInParent(AActionCreateButton, { routeName: 'articleCreate' })
    expect(child.text()).toBe('Create')
    const link = child.find('a')
    expect(link.attributes('href')).toBe('/articles/new')
    await link.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('articleCreate')
  })

  it('shows a create icon for the icon variant', () => {
    const { child } = mountInParent(AActionCreateButton, { routeName: 'articleCreate', variant: 'icon' })
    expect(icon(child)).toBe('mdi-plus')
  })
})

describe('AActionCloseButtonHistory', () => {
  const { addRoute, clearHistory } = useRouteHistory()
  const { consumeStoredPage, setStoredPage } = useDatatablePageStore()

  beforeEach(() => {
    clearHistory()
    consumeStoredPage('reset')
  })

  it('goes back to the listing it came from and preserves its page', async () => {
    await router.push('/articles?page=3')
    addRoute(router.currentRoute.value)
    await router.push('/articles/5')
    setStoredPage('cms_article', 3)
    const { child, parentClick } = mountInParent(AActionCloseButtonHistory, { fallbackRouteName: 'home' })
    await child.find('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/articles?page=3')
    expect(parentClick).not.toHaveBeenCalled()
    expect(consumeStoredPage('cms_article')).toBe(3)
  })

  it('skips the named routes and falls back when nothing is left', async () => {
    await router.push('/articles/new')
    addRoute(router.currentRoute.value)
    await router.push('/articles/5')
    const { child } = mountInParent(AActionCloseButtonHistory, {
      skipRouteNames: ['articleCreate'],
      fallbackRouteName: 'articleList',
    })
    await child.find('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('articleList')
  })

  // The page to restore belongs to the page Close lands on. Landing on a page without a list left the flag for the
  // next list, which a filtered link then opened on that page, possibly an empty one.
  it('keeps the page for the list it lands on only', async () => {
    await router.push('/')
    addRoute(router.currentRoute.value)
    await router.push('/articles/5')
    setStoredPage('cms_article', 3)
    const { child } = mountInParent(AActionCloseButtonHistory, { fallbackRouteName: 'articleList' })
    await child.find('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('home')

    await router.push('/articles#title=x~')
    expect(consumeStoredPage('cms_article')).toBeNull()
  })

  it('drops the page when its navigation is stopped', async () => {
    await router.push('/articles')
    addRoute(router.currentRoute.value)
    await router.push('/articles/5')
    setStoredPage('cms_article', 3)
    const stop = router.beforeEach((to) => to.name !== 'articleList')
    const { child } = mountInParent(AActionCloseButtonHistory, { fallbackRouteName: 'home' })
    await child.find('button').trigger('click')
    await flushPromises()
    stop()
    expect(router.currentRoute.value.name).toBe('articleDetail')
    // Dropped by the stopped navigation itself: a list on this page, a tab say, must not take it.
    expect(consumeStoredPage('cms_article')).toBeNull()
  })

  it('does not hand the page to another navigation that cancels the Close', async () => {
    await router.push('/articles')
    addRoute(router.currentRoute.value)
    await router.push('/articles/5')
    setStoredPage('cms_article', 3)
    let release = () => {}
    const stop = router.beforeEach((to) =>
      to.name === 'articleList' && to.hash === '' ? new Promise<void>((resolve) => (release = resolve)) : true
    )
    const { child } = mountInParent(AActionCloseButtonHistory, { fallbackRouteName: 'home' })
    await child.find('button').trigger('click')
    await router.push('/articles#title=x~')
    stop()
    release()
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/articles#title=x~')
    expect(consumeStoredPage('cms_article')).toBeNull()
  })

  it('keeps the page through a Close that lands on another Close', async () => {
    await router.push('/articles')
    addRoute(router.currentRoute.value)
    await router.push('/articles/5')
    addRoute(router.currentRoute.value)
    await router.push('/articles/5/edit')
    setStoredPage('cms_article', 3)
    const edit = mountInParent(AActionCloseButtonHistory, { fallbackRouteName: 'home' })
    await edit.child.find('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('articleDetail')

    const detail = mountInParent(AActionCloseButtonHistory, {
      skipRouteNames: ['articleEdit'],
      fallbackRouteName: 'home',
    })
    await detail.child.find('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('articleList')
    expect(consumeStoredPage('cms_article')).toBe(3)
  })

  it('keeps the page through a second click while the first Close is still under way', async () => {
    await router.push('/articles')
    addRoute(router.currentRoute.value)
    await router.push('/articles/5')
    setStoredPage('cms_article', 3)
    let release = () => {}
    const stop = router.beforeEach(() => new Promise<void>((resolve) => (release = resolve)))
    const { child } = mountInParent(AActionCloseButtonHistory, { fallbackRouteName: 'home' })
    await child.find('button').trigger('click')
    await child.find('button').trigger('click')
    stop()
    release()
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('articleList')
    expect(consumeStoredPage('cms_article')).toBe(3)
  })

  it('drops the page when its navigation fails', async () => {
    await router.push('/articles')
    addRoute(router.currentRoute.value)
    await router.push('/articles/5')
    setStoredPage('cms_article', 3)
    const stop = router.beforeEach((to) => {
      if (to.name === 'articleList') throw new Error('guard failed')
    })
    // `navigateBack` does not wait for its push; the rejection is what an app's error handler gets.
    const push = router.push.bind(router)
    router.push = (to) =>
      push(to).catch((error: Error) => (error.message === 'guard failed' ? undefined : Promise.reject(error)))
    const { child } = mountInParent(AActionCloseButtonHistory, { fallbackRouteName: 'home' })
    await child.find('button').trigger('click')
    await flushPromises()
    stop()
    expect(router.currentRoute.value.name).toBe('articleDetail')

    await router.push('/articles')
    expect(consumeStoredPage('cms_article')).toBeNull()
  })

  it('keeps the page when a guard redirects the Close onto the list', async () => {
    await router.push('/articles/new')
    addRoute(router.currentRoute.value)
    await router.push('/articles/5')
    setStoredPage('cms_article', 3)
    const stop = router.beforeEach((to) => (to.name === 'articleCreate' ? { name: 'articleList' } : true))
    const { child } = mountInParent(AActionCloseButtonHistory, { fallbackRouteName: 'home' })
    await child.find('button').trigger('click')
    await flushPromises()
    stop()
    expect(router.currentRoute.value.name).toBe('articleList')
    expect(consumeStoredPage('cms_article')).toBe(3)
  })

  it('drops the page on the navigation after a step back that landed without a list', async () => {
    await router.push('/articles/5')
    setStoredPage('cms_article', 3)
    // No route to go back to and no fallback: a step back in the browser's history, to `/`.
    const { child } = mountInParent(AActionCloseButtonHistory, {})
    await child.find('button').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 20))
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('home')

    await router.push('/articles#title=x~')
    expect(consumeStoredPage('cms_article')).toBeNull()
  })

  it('keeps the page when an older navigation still under way is stopped', async () => {
    await router.push('/articles')
    addRoute(router.currentRoute.value)
    await router.push('/articles/5')
    setStoredPage('cms_article', 3)
    let refuse = () => {}
    // The older one waits for its answer, the Close a little; refused while the Close still waits, the older one is
    // reported aborted, not cancelled.
    const stop = router.beforeEach((to) => {
      if (to.name === 'articleEdit') return new Promise<boolean>((resolve) => (refuse = () => resolve(false)))
      if (to.name === 'articleList') return new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 20))
      return true
    })
    const reported: string[] = []
    const off = router.afterEach(
      (to, _from, failure) => void reported.push(`${to.name as string} ${failure?.type ?? 0}`)
    )
    const older = router.push('/articles/5/edit')
    await flushPromises()
    const { child } = mountInParent(AActionCloseButtonHistory, { fallbackRouteName: 'home' })
    await child.find('button').trigger('click')
    refuse()
    await older
    await new Promise((resolve) => setTimeout(resolve, 40))
    await flushPromises()
    stop()
    off()
    expect(reported).toEqual([`articleEdit ${NavigationFailureType.aborted}`, 'articleList 0'])
    expect(router.currentRoute.value.name).toBe('articleList')
    expect(consumeStoredPage('cms_article')).toBe(3)
  })

  it('keeps the page when an older navigation still under way fails', async () => {
    await router.push('/articles')
    addRoute(router.currentRoute.value)
    await router.push('/articles/5')
    setStoredPage('cms_article', 3)
    let fail = () => {}
    const stop = router.beforeEach((to) => {
      if (to.name === 'articleEdit')
        return new Promise<boolean>((_, reject) => (fail = () => reject(new Error('older'))))
      if (to.name === 'articleList') return new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 20))
      return true
    })
    const older = router.push('/articles/5/edit').catch(() => undefined)
    await flushPromises()
    const { child } = mountInParent(AActionCloseButtonHistory, { fallbackRouteName: 'home' })
    await child.find('button').trigger('click')
    fail()
    await older
    await new Promise((resolve) => setTimeout(resolve, 40))
    await flushPromises()
    stop()
    expect(router.currentRoute.value.name).toBe('articleList')
    expect(consumeStoredPage('cms_article')).toBe(3)
  })

  it('leaves the errors of the navigations after its landing to vue-router', async () => {
    await router.push('/articles')
    addRoute(router.currentRoute.value)
    await router.push('/articles/5')
    const { child } = mountInParent(AActionCloseButtonHistory, { fallbackRouteName: 'home' })
    await child.find('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('articleList')

    // vue-router logs a navigation error only while nobody listens for it with `onError`.
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const stop = router.beforeEach(() => {
      throw new Error('guard failed')
    })
    await router.push('/articles/6').catch(() => undefined)
    stop()
    expect(logged).toHaveBeenCalled()
    logged.mockRestore()
  })

  it('does not stay on the route it sits on', async () => {
    await router.push('/articles/5')
    addRoute(router.currentRoute.value)
    const { child } = mountInParent(AActionCloseButtonHistory, { fallbackRouteName: 'articleList' })
    await child.find('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('articleList')
  })
})
