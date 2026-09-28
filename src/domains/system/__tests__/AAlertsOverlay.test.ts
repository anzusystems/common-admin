import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { page, userEvent } from 'vitest/browser'
import { defineComponent, h, ref } from 'vue'
import { VApp, VBtn, VCard, VDialog } from 'vuetify/components'
import AAlerts from '@/domains/system/components/AAlerts.vue'
import AActionDeleteButton from '@/domains/ui/buttons/action/components/AActionDeleteButton.vue'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'

// Alerts are snackbars, which Vuetify puts on its overlay stack: an alert raised while a dialog is open
// made the alert the top overlay, so Esc no longer reached the dialog, and a dialog opened after an
// alert covered it (the old notifications sat at z-index 5000, above everything).

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  useAlertsQueue().value = []
  document.body.innerHTML = ''
})

const visibleAlerts = () => [...document.querySelectorAll<HTMLElement>('.v-alert')].filter((a) => a.checkVisibility())
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const mountWith = (children: () => unknown[]) =>
  (wrapper = mount(defineComponent({ setup: () => () => h(VApp, () => children()) }), {
    attachTo: document.body,
    global: { stubs: { transition: false, 'transition-group': false } },
  }))

describe('alerts and other overlays', () => {
  it('Esc still cancels a confirm dialog while an alert raised in it is visible', async () => {
    mountWith(() => [h(AAlerts), h(AActionDeleteButton, { variant: 'icon' })])
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect.element(page.getByRole('dialog')).toBeVisible()
    useAlerts().showError('Delete failed')
    await expect.poll(() => visibleAlerts().length).toBe(1)
    await sleep(300)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => document.querySelector('[data-cy="delete-panel"]'), { timeout: 2000 }).toBeNull()
  })

  it('Esc still closes a non-persistent dialog while an alert is visible', async () => {
    const open = ref(true)
    mountWith(() => [
      h(AAlerts),
      h(
        VDialog,
        { modelValue: open.value, 'onUpdate:modelValue': (v: boolean) => (open.value = v), persistent: false },
        () => h(VCard, { 'data-cy': 'plain-dialog' }, () => h(VBtn, () => 'inside'))
      ),
    ])
    await expect.poll(() => !!document.querySelector('[data-cy="plain-dialog"]')).toBe(true)
    await sleep(400)
    useAlerts().showSuccess('Saved')
    await expect.poll(() => visibleAlerts().length).toBe(1)
    await sleep(300)
    await userEvent.keyboard('{Escape}')
    await expect.poll(() => open.value, { timeout: 2000 }).toBe(false)
  })

  it('stays above a dialog opened after it', async () => {
    const open = ref(false)
    mountWith(() => [
      h(AAlerts),
      h(
        VDialog,
        { modelValue: open.value, 'onUpdate:modelValue': (v: boolean) => (open.value = v), fullscreen: true },
        () => h(VCard, () => 'dialog')
      ),
    ])
    useAlerts().showError('Validation failed', -1)
    await expect.poll(() => visibleAlerts().length).toBe(1)
    open.value = true
    await sleep(800)
    const alert = visibleAlerts()[0]!
    const rect = alert.getBoundingClientRect()
    expect(alert.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2))).toBe(true)
  })
})
