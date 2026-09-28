import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import AActionbar from '@/components/appShell/AActionbar.vue'
import AActionbarTarget from '@/components/appShell/AActionbarTarget.vue'
import ALayoutSwitch from '@/components/appShell/ALayoutSwitch.vue'
import { createTeleportSlot } from '@/components/appShell/teleportSlot'
import { defineBreadcrumbs, type BreadcrumbItem } from '@/composables/system/breadcrumbs'
import { useCommonVuetifyPlugins } from '@/test/support/commonVuetify'

const Empty = defineComponent(() => () => null)
let router: Router

useCommonVuetifyPlugins()

beforeEach(async () => {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: '/', component: Empty },
      { path: '/articles', name: '/articles', component: Empty, meta: { layout: 'Drawer' } },
      { path: '/articles/:id', name: '/articles/[id]', component: Empty, meta: { layout: 'Drawer' } },
      { path: '/sites/:siteId/articles/:id', name: '/sites/[siteId]/articles/[id]', component: Empty },
      { path: '/login', name: '/login', component: Empty, meta: { layout: 'Fullscreen' } },
      { path: '/broken', name: '/broken', component: Empty, meta: { layout: 'Nope' } },
    ],
  })
  await router.push('/')
  await router.isReady()
})

const wrappers: VueWrapper[] = []
afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount()
})
const mounted = (component: Parameters<typeof mount>[0]) => {
  const wrapper = mount(component, { global: { plugins: [router] }, attachTo: document.body })
  wrappers.push(wrapper)
  return wrapper
}

describe('createTeleportSlot', () => {
  it('renders nothing until a target is mounted, then renders into it, and stops when it goes', async () => {
    const slot = createTeleportSlot('Test')
    const showTarget = ref(false)
    const warn = vi.spyOn(console, 'warn')
    const wrapper = mounted(
      defineComponent(() => () => [
        h(slot.Source, null, { default: () => h('span', { class: 'teleported' }, 'x') }),
        showTarget.value ? h(slot.Target, { class: 'target' }) : null,
      ])
    )
    await nextTick()
    expect(document.querySelector('.teleported')).toBeNull()
    expect(slot.ready.value).toBe(false)

    showTarget.value = true
    await flushPromises()
    expect(slot.ready.value).toBe(true)
    expect(document.querySelector('.target .teleported')).not.toBeNull()

    showTarget.value = false
    await flushPromises()
    expect(slot.ready.value).toBe(false)
    expect(document.querySelector('.teleported')).toBeNull()
    expect(warn.mock.calls.filter(([message]) => String(message).includes('Teleport'))).toEqual([])
    wrapper.unmount()
  })
})

describe('AActionbar', () => {
  const trail = (items: BreadcrumbItem[], linkLastItem = false) =>
    defineBreadcrumbs(
      computed(() => items),
      { linkLastItem }
    )

  const render = async (props: Record<string, unknown>, slots: Record<string, () => unknown> = {}) => {
    mounted(defineComponent(() => () => [h(AActionbarTarget), h(AActionbar, props, slots)]))
    await flushPromises()
    return document.querySelector('.justify-space-between')!
  }

  const links = (root: Element) =>
    [...root.querySelectorAll('.v-breadcrumbs-item')].map((item) => [
      item.textContent?.trim(),
      item.closest('a')?.getAttribute('href') ??
        item.querySelector('a')?.getAttribute('href') ??
        item.getAttribute('href'),
    ])

  it('renders into the actionbar target and links every breadcrumb but the last', async () => {
    const root = await render(
      {
        breadcrumbs: trail([
          { title: 'Articles', routeName: '/articles' },
          { title: 'Article 5', routeName: '/articles/[id]', id: 5 },
          { title: 'Site article', routeName: '/sites/[siteId]/articles/[id]', routeParams: { siteId: 2, id: 7 } },
        ]),
      },
      { buttons: () => h('button', { class: 'save' }, 'Save') }
    )

    // The admins' e2e suites find the buttons under this id.
    expect(document.querySelector('#anzu-actionbar button.save')).not.toBeNull()
    expect(links(root)).toEqual([
      ['Articles', '/articles'],
      ['Article 5', '/articles/5'],
      ['Site article', null],
    ])
    expect(root.querySelector('button.save')).not.toBeNull()
  })

  it('links the last one too when the trail asks for it, through a resolver when given', async () => {
    const root = await render({
      breadcrumbs: trail([{ title: 'Article 5', routeName: '/articles/[id]', id: 5 }], true),
      resolveBreadcrumbRoute: (item: BreadcrumbItem) => ({ path: '/articles', query: { from: String(item.id) } }),
    })

    expect(links(root)).toEqual([['Article 5', '/articles?from=5']])
  })

  it('takes a trail of its own in the breadcrumbs slot', async () => {
    const root = await render({}, { breadcrumbs: () => h('span', { class: 'own-trail' }, 'own') })

    expect(root.querySelector('.own-trail')).not.toBeNull()
    expect(root.querySelector('.v-breadcrumbs')).toBeNull()
  })
})

describe('ALayoutSwitch', () => {
  const layout = (name: string) =>
    defineComponent({
      name,
      setup:
        (_, { slots }) =>
        () =>
          h('div', { class: `layout-${name}` }, slots.default?.()),
    })
  const layouts = { AppLayoutLoader: layout('Loader'), Drawer: layout('Drawer'), Fullscreen: layout('Fullscreen') }

  it('shows the default layout until a route says otherwise, and hosts the alerts once', async () => {
    const wrapper = mounted(
      defineComponent(() => () => h(ALayoutSwitch, { layouts }, { default: () => h('main', 'page') }))
    )
    await flushPromises()
    expect(wrapper.find('.layout-Loader main').exists()).toBe(true)
    expect(wrapper.findAllComponents({ name: 'AAlerts' })).toHaveLength(1)

    await router.push('/articles')
    await flushPromises()
    expect(wrapper.find('.layout-Drawer main').exists()).toBe(true)

    await router.push('/login')
    await flushPromises()
    expect(wrapper.find('.layout-Fullscreen main').exists()).toBe(true)
    expect(wrapper.findAllComponents({ name: 'AAlerts' })).toHaveLength(1)

    await router.push('/sites/2/articles/7')
    await flushPromises()
    expect(wrapper.find('.layout-Loader main').exists()).toBe(true)
  })

  it('renders the page without a layout for a name it does not know, and says so', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mounted(
      defineComponent(() => () => h(ALayoutSwitch, { layouts }, { default: () => h('main', 'page') }))
    )
    await router.push('/broken')
    await flushPromises()

    expect(wrapper.find('main').exists()).toBe(true)
    expect(wrapper.find('[class^="layout-"]').exists()).toBe(false)
    expect(error.mock.calls.some(([message]) => String(message).includes("Unknown layout 'Nope'"))).toBe(true)
    error.mockRestore()
  })
})
