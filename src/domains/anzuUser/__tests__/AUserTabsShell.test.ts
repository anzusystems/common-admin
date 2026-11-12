import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router'
import type { AxiosInstance } from 'axios'
import AUserTabsShell from '@/domains/anzuUser/components/AUserTabsShell.vue'
import AUserSystemPanel from '@/domains/anzuUser/components/AUserSystemPanel.vue'
import AUnsavedConfirmDialog from '@/domains/unsavedGuard/components/AUnsavedConfirmDialog.vue'
import {
  defineUserSystemDescriptor,
  type AnyUserSystemDescriptor,
} from '@/domains/anzuUser/composables/userSystemDescriptor'
import { OTHER_SYSTEMS_TAB } from '@/domains/anzuUser/utils/userTabs'

// Every tab is a link to a page of its own. The shell only draws the bar and marks the page shown.

const descriptor = (system: string, label: string, request = vi.fn()): AnyUserSystemDescriptor =>
  defineUserSystemDescriptor({
    system,
    label,
    client: () => ({ request }) as unknown as AxiosInstance,
    entity: 'anzuUser',
    isEnabled: () => true,
    requiredMetadata: false,
    idInput: true,
    endpoints: {
      anzuUser: { get: '/adm/v1/anzu-user/:id', put: '/adm/v1/anzu-user/:id', post: '/adm/v1/anzu-user' },
      base: null,
      permissionGroup: '/adm/v1/permission-group',
      currentUser: '/adm/v1/anzu-user/current',
      list: '/adm/v1/anzu-user',
      probe: 'anzuUser',
    },
  })

const descriptors = [descriptor('cms', 'CMS'), descriptor('contentHub', 'Agentúry'), descriptor('dam', 'DAM')]

const detailTabs = [
  { system: 'cms', to: { name: 'cms', params: { id: '42' } } },
  { system: 'contentHub', to: { name: 'contentHub', params: { id: '42' } } },
]
const editTabs = [
  { system: 'cms', to: { name: 'cmsEdit', params: { id: '42' } } },
  { system: 'contentHub', to: { name: 'contentHubEdit', params: { id: '42' } } },
]
const otherSystemsTo = (from: string) => ({ name: 'otherSystems', params: { id: '42' }, query: { from } })

const Blank = { template: '<div />' }

let mounted: VueWrapper | null = null
let pinia = createPinia()
let router: Router

const mountShell = async (path: string, props: Record<string, unknown> = {}, slot = '<div class="page">page</div>') => {
  await router.replace(path)
  mounted = mount(AUserTabsShell, {
    global: { plugins: [router, pinia] },
    props: { tabs: detailTabs, otherSystemsTo: otherSystemsTo('cms'), active: 'cms', descriptors, ...props },
    slots: { default: slot },
  })
  await flushPromises()
  return mounted
}

const tab = (wrapper: VueWrapper, name: string) => wrapper.find(`[data-cy="user-tab-${name}"]`)

beforeEach(async () => {
  pinia = createPinia()
  setActivePinia(pinia)
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/users/:id', name: 'cms', component: Blank },
      { path: '/users/:id/edit', name: 'cmsEdit', component: Blank },
      { path: '/content-hub/users/:id', name: 'contentHub', component: Blank },
      { path: '/content-hub/users/:id/edit', name: 'contentHubEdit', component: Blank },
      { path: '/users/:id/other-systems', name: 'otherSystems', component: Blank },
    ],
  })
  await router.push('/users/42')
  await router.isReady()
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
})

describe('AUserTabsShell', () => {
  it('draws the tabs it was given, in order, plus the one for the rest', async () => {
    const wrapper = await mountShell('/users/42')

    const labels = wrapper.findAll('.v-tab').map((item) => item.text())
    expect(labels).toEqual(['CMS', 'Agentúry', 'Other systems'])
  })

  it('makes every tab a link to its page', async () => {
    const wrapper = await mountShell('/users/42')

    expect(tab(wrapper, 'cms').attributes('href')).toBe('/users/42')
    expect(tab(wrapper, 'contentHub').attributes('href')).toBe('/content-hub/users/42')
    expect(tab(wrapper, OTHER_SYSTEMS_TAB).attributes('href')).toBe('/users/42/other-systems?from=cms')
  })

  it('links the edit pages from an edit page', async () => {
    const wrapper = await mountShell('/users/42/edit', { tabs: editTabs })

    expect(tab(wrapper, 'cms').attributes('href')).toBe('/users/42/edit')
    expect(tab(wrapper, 'contentHub').attributes('href')).toBe('/content-hub/users/42/edit')
  })

  it('selects the tab of the page shown', async () => {
    const wrapper = await mountShell('/content-hub/users/42', {
      active: 'contentHub',
      otherSystemsTo: otherSystemsTo('contentHub'),
    })

    expect(tab(wrapper, 'contentHub').attributes('aria-selected')).toBe('true')
    expect(tab(wrapper, 'cms').attributes('aria-selected')).toBe('false')
  })

  it('selects the other-systems tab on its page', async () => {
    const wrapper = await mountShell('/users/42/other-systems?from=cms', { active: OTHER_SYSTEMS_TAB })

    expect(tab(wrapper, OTHER_SYSTEMS_TAB).attributes('aria-selected')).toBe('true')
    expect(tab(wrapper, 'cms').attributes('aria-selected')).toBe('false')
  })

  it('draws no other-systems tab without its link', async () => {
    const wrapper = await mountShell('/users/42', { otherSystemsTo: undefined })

    expect(tab(wrapper, OTHER_SYSTEMS_TAB).exists()).toBe(false)
  })

  it('shows the page below the tabs', async () => {
    const wrapper = await mountShell('/users/42')

    expect(wrapper.find('.page').exists()).toBe(true)
  })

  it('marks the active tab when the form holds unsaved work', async () => {
    const clean = await mountShell('/users/42/edit', { tabs: editTabs, unsavedChanges: false })
    expect(clean.find('[data-cy="user-tab-unsaved"]').exists()).toBe(false)
    clean.unmount()

    const dirty = await mountShell('/users/42/edit', { tabs: editTabs, unsavedChanges: true })
    expect(tab(dirty, 'cms').find('[data-cy="user-tab-unsaved"]').exists()).toBe(true)
    expect(tab(dirty, 'contentHub').find('[data-cy="user-tab-unsaved"]').exists()).toBe(false)
  })

  it('asks before a tab leaves a form with unsaved work', async () => {
    // A tab is real navigation now, so the shell's route-leave guard is what keeps the edits.
    const Page = defineComponent({
      setup: () => () =>
        h(
          AUserTabsShell,
          { tabs: editTabs, otherSystemsTo: otherSystemsTo('cms'), active: 'cms', descriptors, unsavedChanges: true },
          { default: () => h('div', 'form') }
        ),
    })
    router.addRoute({ path: '/guarded/:id/edit', name: 'guarded', component: Page })
    await router.replace('/guarded/42/edit')
    mounted = mount(defineComponent({ setup: () => () => h(RouterView) }), {
      global: { plugins: [router, pinia] },
      attachTo: document.body,
    })
    await flushPromises()

    ;(mounted.find('[data-cy="user-tab-contentHub"]').element as HTMLElement).click()
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/guarded/42/edit')
    const dialog = mounted.findComponent(AUnsavedConfirmDialog)
    expect(dialog.props('modelValue')).toBe(true)

    dialog.vm.$emit('resolve', true)
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/content-hub/users/42/edit')
  })

  it('hands the refresh hook to the panels on the page', async () => {
    // A first 401 may be an expired session. Only the app can refresh it, and the panels sit in the slot.
    const request = vi.fn().mockRejectedValue(
      Object.assign(new Error('failed'), {
        isAxiosError: true,
        config: { url: '/adm/v1/anzu-user/42' },
        response: { status: 401, data: {} },
      })
    )
    const refreshHook = vi.fn().mockResolvedValue(false)
    await router.replace('/users/42/other-systems')
    mounted = mount(AUserTabsShell, {
      global: { plugins: [router, pinia] },
      props: { tabs: detailTabs, active: OTHER_SYSTEMS_TAB, descriptors, refreshHook },
      slots: { default: () => h(AUserSystemPanel, { descriptor: descriptor('dam', 'DAM', request), userId: 42 }) },
    })
    await flushPromises()

    expect(refreshHook).toHaveBeenCalledWith('dam')
  })
})
