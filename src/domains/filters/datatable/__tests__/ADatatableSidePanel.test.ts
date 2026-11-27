import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { effectScope, h, nextTick, ref } from 'vue'
import { VCard } from 'vuetify/components'
import ADatatableSidePanel from '@/domains/filters/datatable/components/ADatatableSidePanel.vue'
import { useDatatableSidePanel } from '@/domains/filters/datatable/composables/useDatatableSidePanel'

let wrapper: VueWrapper<any> | null = null
const scopes: ReturnType<typeof effectScope>[] = []

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  scopes.splice(0).forEach((scope) => scope.stop())
  document.querySelectorAll('[data-test-overlay]').forEach((node) => node.remove())
})

const pressEsc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

describe('ADatatableSidePanel', () => {
  it('renders the panel next to the list only while open', async () => {
    wrapper = mount(ADatatableSidePanel, {
      props: { open: false, width: 420 },
      slots: { default: '<div class="list">rows</div>', header: 'Title', panel: 'Text' },
    })
    expect(wrapper.find('.a-datatable-side-panel__panel').exists()).toBe(false)
    expect(wrapper.find('.list').exists()).toBe(true)
    await wrapper.setProps({ open: true })
    const panel = wrapper.find('.a-datatable-side-panel__panel')
    expect(panel.attributes('style')).toContain('width: 420px')
    expect(panel.text()).toContain('Title')
    expect(panel.text()).toContain('Text')
  })

  it('lets a card around the list clip without becoming the box the panel sticks in', () => {
    wrapper = mount(
      { render: () => h(VCard, null, () => h(ADatatableSidePanel, { open: true, width: 360 })) },
      { attachTo: document.body }
    )
    expect(getComputedStyle(wrapper.find('.v-card').element).overflow).toBe('clip')
    expect(getComputedStyle(wrapper.find('.a-datatable-side-panel__panel').element).position).toBe('sticky')
  })

  it('closes on Esc and on the close button, but leaves Esc to an open dialog', async () => {
    wrapper = mount(ADatatableSidePanel, { props: { open: true, width: 360 } })
    pressEsc()
    expect(wrapper.emitted('close')).toHaveLength(1)

    const dialog = document.createElement('div')
    dialog.className = 'v-overlay v-dialog v-overlay--active'
    dialog.dataset.testOverlay = ''
    document.body.appendChild(dialog)
    pressEsc()
    expect(wrapper.emitted('close')).toHaveLength(1)

    await wrapper.find('.a-datatable-side-panel__close').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
  })

  it('scrolls the text back to the top for another record', async () => {
    wrapper = mount(ADatatableSidePanel, {
      props: { open: true, width: 360, itemKey: 1 },
      slots: { panel: '<div style="height: 5000px">long</div>' },
      attachTo: document.body,
    })
    const body = wrapper.find('.a-datatable-side-panel__body').element as HTMLElement
    body.style.height = '100px'
    body.scrollTop = 500
    expect(body.scrollTop).toBeGreaterThan(0)
    await wrapper.setProps({ itemKey: 2 })
    await nextTick()
    expect(body.scrollTop).toBe(0)
  })
})

describe('useDatatableSidePanel', () => {
  const setup = (options: Parameters<typeof useDatatableSidePanel>[0] = {}) => {
    const scope = effectScope()
    scopes.push(scope)
    return scope.run(() => useDatatableSidePanel(options))!
  }

  it('opens with a record and hides the given columns only while open', () => {
    const panel = setup()
    const columns = ref([{ key: 'title' }, { key: 'location' }, { key: 'source' }])
    const shown = panel.columnsWithPanel(columns, ['location'])
    expect(shown.value.map((column) => column.key)).toEqual(['title', 'location', 'source'])
    expect(panel.open(7)).toBe(window.innerWidth >= 1000)
    if (panel.isOpen.value) {
      expect(shown.value.map((column) => column.key)).toEqual(['title', 'source'])
    }
    panel.close()
    expect(panel.isOpen.value).toBe(false)
    expect(shown.value).toHaveLength(3)
  })

  it('takes the panel width from the window width', () => {
    const panel = setup()
    const expected = window.innerWidth >= 1800 ? 480 : window.innerWidth >= 1500 ? 420 : 360
    expect(panel.width.value).toBe(expected)
  })

  it('takes the default widths for an empty list of widths', () => {
    const panel = setup({ widths: [] })
    const expected = window.innerWidth >= 1800 ? 480 : window.innerWidth >= 1500 ? 420 : 360
    expect(panel.width.value).toBe(expected)
  })
})
