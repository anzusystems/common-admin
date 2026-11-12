import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ALoginView from '@/domains/ui/view/components/ALoginView.vue'
import ALogoutView from '@/domains/ui/view/components/ALogoutView.vue'

// Guards history entries left by the sign-in and sign-out views.
// After a sign-in, Back from the admin showed `/login` to a signed-in user. After a
// sign-out and a new sign-in, Back reached `/logout` and signed the user out at once.
// Uses the real browser history of the test page, with addresses as fragments. The page of the test must stay.

const here = location.href.split('#')[0]!
let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const onEntry = (name: string) => history.pushState(null, '', `#${name}`)
const isAt = (name: string) => vi.waitFor(() => expect(location.hash).toBe(`#${name}`))
const back = async () => {
  const went = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }))
  history.back()
  await went
}

describe('ALogoutView', () => {
  // A 401 sends the admins to `/logout` from the page the user is on: that page stays, only `/logout` goes.
  it('leaves for the sign-out address in place of the entry of `/logout`: Back comes to the page the user was on', async () => {
    onEntry('page-before-the-sign-out')
    onEntry('logout')
    const entries = history.length

    wrapper = mount(ALogoutView, { props: { logoutUrl: () => `${here}#signed-out` } })
    await isAt('signed-out')

    expect(history.length).toBe(entries)
    await back()
    expect(location.hash).toBe('#page-before-the-sign-out')
  })
})

describe('ALoginView', () => {
  const mountView = () => {
    wrapper = mount(ALoginView, { attachTo: document.body, props: { loginUrl: () => `${here}#sign-in-page` } })
    return wrapper.find<HTMLAnchorElement>('[data-cy="button-login"]').element
  }

  it('is a link to the sign-in address, which a press leaves for in place of the entry of `/login`', async () => {
    onEntry('page-before-the-sign-in')
    onEntry('login')
    const entries = history.length
    const link = mountView()
    expect([link.tagName, link.href]).toEqual(['A', `${here}#sign-in-page`])

    link.click()
    await isAt('sign-in-page')

    expect(history.length).toBe(entries)
    await back()
    expect(location.hash).toBe('#page-before-the-sign-in')
  })

  // An admin whose configuration has no sign-in address yet: the button is not a link and a press does nothing.
  // It used to go to the address `undefined` of the admin.
  it.each<[string, string | undefined]>([
    ['an empty one', ''],
    ['none', undefined],
  ])('does nothing on a press when the sign-in address is %s', async (_what, address) => {
    onEntry('login-without-an-address')
    const entries = history.length
    wrapper = mount(ALoginView, { attachTo: document.body, props: { loginUrl: () => address as string } })
    const button = wrapper.find<HTMLElement>('[data-cy="button-login"]').element
    expect(button.tagName).toBe('BUTTON')
    let taken: boolean | undefined
    const browser = (event: Event) => (taken = event.defaultPrevented)
    document.addEventListener('click', browser)
    try {
      button.click()
    } finally {
      document.removeEventListener('click', browser)
    }

    expect(taken).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect([location.hash, history.length]).toEqual(['#login-without-an-address', entries])
  })

  // The link of a tab, a window or a download of its own: the browser opens it there, and the admin stays where it is.
  it.each<[string, MouseEventInit]>([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
    ['Shift', { shiftKey: true }],
    ['Alt', { altKey: true }],
  ])('leaves a press with %s to the browser, as a link', async (_key, init) => {
    onEntry('login-with-a-key')
    const link = mountView()
    let leftToTheBrowser: boolean | undefined
    // After the view has had the press: what it left of it, and the browser opens nothing in the test.
    const browser = (event: Event) => {
      leftToTheBrowser = !event.defaultPrevented
      event.preventDefault()
    }
    document.addEventListener('click', browser)
    try {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }))
    } finally {
      document.removeEventListener('click', browser)
    }

    expect(leftToTheBrowser).toBe(true)
    expect(location.hash).toBe('#login-with-a-key')
  })
})
