import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ALiveListingPill from '@/domains/filters/datatable/components/ALiveListingPill.vue'

describe('ALiveListingPill', () => {
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

  it('shows the failure in place of the count', () => {
    const wrapper = mount(ALiveListingPill, { props: { count: 2, failed: true } })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toBe('The list could not be refreshed. Trying again.')
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
