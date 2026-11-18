import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VDataTable } from 'vuetify/components/VDataTable'
import { CARD_LOADER_SELECTOR, NO_DATA_SELECTOR, NOT_FOUND_SELECTOR, ROW_SELECTOR } from '@/e2e/conventions.mjs'
import ACard from '@/domains/ui/components/ACard.vue'
import ANotFoundView from '@/domains/ui/view/components/ANotFoundView.vue'

// The route walk (src/e2e/routeWalk.mjs) finds a page's loaders, its 404 view and a listing's rows by these
// selectors. Renamed here, the walk would pass a loader that never ends or miss every record, and say nothing.

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const shown = (element: Element | null) => !!element && getComputedStyle(element).display !== 'none'

describe('the conventions of the route walk', () => {
  it("find ACard's loader while it loads, and not after", async () => {
    wrapper = mount(ACard, { props: { loading: true }, slots: { default: 'Content' }, attachTo: document.body })
    expect(shown(document.querySelector(CARD_LOADER_SELECTOR))).toBe(true)
    await wrapper.setProps({ loading: false })
    expect(shown(document.querySelector(CARD_LOADER_SELECTOR))).toBe(false)
  })

  it("find ANotFoundView's way back", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: '/', component: defineComponent(() => () => null) }],
    })
    wrapper = mount(ANotFoundView, {
      props: { returnRouteName: '/' },
      global: { plugins: [router] },
      attachTo: document.body,
    })
    await nextTick()
    expect(document.querySelectorAll(NOT_FOUND_SELECTOR)).toHaveLength(1)
  })

  it('find the rows of a listing in main, and the row of an empty one', async () => {
    const listing = (items: { id: number }[]) =>
      defineComponent(() => () => h('main', [h(VDataTable, { items, headers: [{ title: 'Id', key: 'id' }] })]))
    wrapper = mount(listing([{ id: 1 }, { id: 2 }]), { attachTo: document.body })
    await nextTick()
    expect(document.querySelectorAll(ROW_SELECTOR)).toHaveLength(2)
    expect(document.querySelector(NO_DATA_SELECTOR)).toBeNull()
    wrapper.unmount()

    wrapper = mount(listing([]), { attachTo: document.body })
    await nextTick()
    expect(document.querySelectorAll(ROW_SELECTOR)).toHaveLength(0)
    expect(shown(document.querySelector(NO_DATA_SELECTOR))).toBe(true)
  })
})
