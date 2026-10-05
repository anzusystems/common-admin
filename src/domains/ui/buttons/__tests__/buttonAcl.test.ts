import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, Fragment, nextTick } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import AActionCreateButton from '@/domains/ui/buttons/action/components/AActionCreateButton.vue'
import AActionDeleteButton from '@/domains/ui/buttons/action/components/AActionDeleteButton.vue'
import AActionEditButton from '@/domains/ui/buttons/action/components/AActionEditButton.vue'
import AActionSaveButton from '@/domains/ui/buttons/action/components/AActionSaveButton.vue'
import AActionSaveAndCloseButton from '@/domains/ui/buttons/action/components/AActionSaveAndCloseButton.vue'
import ATableEditButton from '@/domains/ui/buttons/table/components/ATableEditButton.vue'
import ATableDetailButton from '@/domains/ui/buttons/table/components/ATableDetailButton.vue'
import { useAuthStore } from '@/domains/auth/store/authStore'
import { defineAuth } from '@/domains/auth/composables/defineAuth'
import { Grant } from '@/domains/auth/valueObject/Grant'
import { useCommonVuetifyPlugins } from '@/test/support/commonVuetify'

// The shared buttons used to show to everyone unless the admin wrapped them; `acl` lets the button
// check itself, and without it nothing changes for the callers that pass none.

useCommonVuetifyPlugins()

const Empty = defineComponent(() => () => null)
let router: Router
const { useCurrentUser } = defineAuth<`${string}_${string}_${string}`>('brick')

const wrappers: VueWrapper[] = []
const mountButton = (component: unknown, props: Record<string, unknown>) => {
  const wrapper = mount(component as never, { props: props as never, global: { plugins: [router] } })
  wrappers.push(wrapper)
  return wrapper
}

const routeProps = { routeName: 'articleEdit', recordId: 1 }
const buttons: [string, unknown, Record<string, unknown>][] = [
  ['AActionCreateButton', AActionCreateButton, { routeName: 'articleCreate' }],
  ['AActionEditButton', AActionEditButton, routeProps],
  ['AActionDeleteButton', AActionDeleteButton, {}],
  ['AActionSaveButton', AActionSaveButton, {}],
  ['AActionSaveAndCloseButton', AActionSaveAndCloseButton, {}],
  ['ATableEditButton', ATableEditButton, routeProps],
  ['ATableDetailButton', ATableDetailButton, routeProps],
]

const setGrants = (resolvedPermissions: Record<string, number>) =>
  useCurrentUser('brick').setCurrentUser({ id: 1, roles: [], resolvedPermissions } as never)

beforeEach(async () => {
  useAuthStore().reset()
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Empty },
      { path: '/articles/new', name: 'articleCreate', component: Empty },
      { path: '/articles/:id/edit', name: 'articleEdit', component: Empty },
    ],
  })
  await router.push('/')
  await router.isReady()
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

// The delete button was a fragment before (button and dialog); the others were one element and must stay so.
const singleRootButtons = buttons.filter(([name]) => name !== 'AActionDeleteButton')

describe.each(singleRootButtons)('%s root', (_name, component, props) => {
  // A fragment root drops the caller's class, listeners and v-show in a production build; development hides it.
  it('stays a single element, so attributes and v-show reach the button', () => {
    const wrapper = mountButton(component, props)
    expect((wrapper.vm as unknown as { $: { subTree: { type: unknown } } }).$.subTree.type).not.toBe(Fragment)
  })
})

describe.each(buttons)('%s with acl', (_name, component, props) => {
  it('renders without acl, as before', () => {
    expect(mountButton(component, props).find('.v-btn').exists()).toBe(true)
  })

  it('hides itself while its system is not loaded, without throwing', () => {
    expect(
      mountButton(component, { ...props, acl: 'brick_menu_update' })
        .find('.v-btn')
        .exists()
    ).toBe(false)
  })

  it('follows the grant and reacts when the current user changes', async () => {
    const wrapper = mountButton(component, { ...props, acl: ['brick_menu_ui', 'brick_menu_update'] })
    expect(wrapper.find('.v-btn').exists()).toBe(false)

    setGrants({ brick_menu_ui: Grant.Allow, brick_menu_update: Grant.Deny })
    await nextTick()
    expect(wrapper.find('.v-btn').exists()).toBe(false)

    setGrants({ brick_menu_ui: Grant.Allow, brick_menu_update: Grant.Allow })
    await nextTick()
    expect(wrapper.find('.v-btn').exists()).toBe(true)
  })
})
