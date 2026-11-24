import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { VCard } from 'vuetify/components'

import ALiveListingPill from '@/domains/filters/datatable/components/ALiveListingPill.vue'

describe('ALiveListingPill', () => {
  it('lets a card around the list clip without becoming the box the pill sticks in', () => {
    const wrapper = mount(
      { render: () => h(VCard, null, () => h(ALiveListingPill, { count: 2 })) },
      { attachTo: document.body }
    )
    expect(getComputedStyle(wrapper.find('.v-card').element).overflow).toBe('clip')
    expect(getComputedStyle(wrapper.find('.a-live-listing-pill').element).position).toBe('sticky')
    wrapper.unmount()
  })

  it('shows nothing without new records', () => {
    const wrapper = mount(ALiveListingPill, { props: { count: 0 } })
    expect(wrapper.find('.a-live-listing-pill__item').exists()).toBe(false)
    wrapper.unmount()
  })

  it('counts in the plural form of the number, and as max+ above max', async () => {
    const wrapper = mount(ALiveListingPill, { props: { count: 1 } })
    expect(wrapper.text()).toBe('1 new record')
    await wrapper.setProps({ count: 3 })
    expect(wrapper.text()).toBe('3 new records')
    await wrapper.setProps({ count: 10 })
    expect(wrapper.text()).toBe('9+ new records')
    wrapper.unmount()
  })

  it('emits the click', async () => {
    const wrapper = mount(ALiveListingPill, { props: { count: 2 } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
    wrapper.unmount()
  })

  it('tells a failed probe when nothing is offered, and keeps an offered reload clickable after it', async () => {
    const wrapper = mount(ALiveListingPill, { props: { count: 0, failed: true } })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toBe('The list could not be refreshed. Trying again.')
    await wrapper.setProps({ changed: true })
    expect(wrapper.text()).toBe('Load changes')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
    await wrapper.setProps({ count: 2 })
    expect(wrapper.text()).toBe('2 new records')
    wrapper.unmount()
  })

  it('offers to load changes while nothing new is counted, and emits the click', async () => {
    const wrapper = mount(ALiveListingPill, { props: { count: 0, changed: true } })
    expect(wrapper.text()).toBe('Load changes')
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
    await wrapper.setProps({ count: 2 })
    expect(wrapper.text()).toBe('2 new records')
    wrapper.unmount()
  })

  it('tells of degraded updates only when there is nothing to show', async () => {
    const wrapper = mount(ALiveListingPill, { props: { count: 0, degraded: true } })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toBe('Instant updates are down; the list is checked every few seconds.')
    await wrapper.setProps({ count: 1 })
    expect(wrapper.text()).toBe('1 new record')
    wrapper.unmount()
  })
})
