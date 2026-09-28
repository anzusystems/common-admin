import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { VApp } from 'vuetify/components'
import AAlerts from '@/components/AAlerts.vue'
import { useAlerts } from '@/composables/system/alerts'
import { useAlertsQueue } from '@/composables/system/alertsQueue'

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  useAlertsQueue().value = []
  document.body.innerHTML = ''
})

const mountHost = () => {
  wrapper = mount(defineComponent({ setup: () => () => h(VApp, () => h(AAlerts)) }), { attachTo: document.body })
}
// A closed snackbar stays in the DOM, hidden: count what is visible.
const alerts = () => [...document.querySelectorAll<HTMLElement>('.v-alert')].filter((a) => a.checkVisibility())

describe('AAlerts', () => {
  it('shows an alert in the markup the admins select', async () => {
    mountHost()
    useAlerts().showError('Something failed')
    await expect.poll(() => alerts().map((a) => a.textContent?.trim())).toEqual(['Something failed'])
    const alert = alerts()[0]!
    expect(alert.getAttribute('data-cy')).toBe('page-title')
    expect(alert.classList.contains('text-error') || alert.className.includes('error')).toBe(true)
    expect(alert.querySelector('.v-alert__close')).not.toBeNull()
  })

  it('closes from the close icon', async () => {
    mountHost()
    useAlerts().showSuccess('Saved')
    await expect.poll(() => alerts().length).toBe(1)
    alerts()[0]!.querySelector<HTMLElement>('.v-alert__close .v-icon')!.click()
    await expect.poll(() => alerts().length, { timeout: 3000 }).toBe(0)
  })

  it('keeps the lines of an API validation error apart', async () => {
    mountHost()
    useAlerts().showApiValidationError([
      { field: 'title', errors: ['required'] },
      { field: 'slug', errors: ['required'] },
    ] as never)
    await expect.poll(() => alerts().length).toBe(1)
    const content = alerts()[0]!.querySelector<HTMLElement>('.v-alert__content')!
    expect(getComputedStyle(content).whiteSpace).toBe('pre-line')
    expect(content.textContent).toContain('\n')
  })

  it('shows an alert raised before any host was mounted', async () => {
    useAlerts().showWarning('Raised during start-up')
    mountHost()
    await expect.poll(() => alerts().map((a) => a.textContent?.trim())).toEqual(['Raised during start-up'])
  })
})
