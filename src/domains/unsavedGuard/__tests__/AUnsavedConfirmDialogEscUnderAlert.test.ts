import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { userEvent } from 'vitest/browser'
import { defineComponent, h, ref } from 'vue'
import { VApp, VBtn, VCard, VDialog } from 'vuetify/components'
import AAlerts from '@/domains/system/components/AAlerts.vue'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'
import AUnsavedConfirmDialog from '@/domains/unsavedGuard/components/AUnsavedConfirmDialog.vue'

// Esc on the question about unsaved changes is "stay". An alert raised after the question had opened (the failure of
// a save, a notification) kept Esc from reaching it while the alert was shown: the question stayed, and only its
// buttons answered it.

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  useAlertsQueue().value = []
  document.body.innerHTML = ''
})

const visibleAlerts = () => [...document.querySelectorAll<HTMLElement>('.v-alert')].filter((a) => a.checkVisibility())
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('the question about unsaved changes', () => {
  it.each<[string, boolean, boolean]>([
    ['alone', false, false],
    ['over a dialog of the page', true, false],
    ['with its "stay" button focused', false, true],
  ])('%s: Esc answers "stay" while an alert raised after it opened is shown', async (_where, overDialog, focused) => {
    const question = ref(false)
    const answers: boolean[] = []
    wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(VApp, () => [
            h(AAlerts),
            overDialog
              ? h(VDialog, { modelValue: true, persistent: true }, () =>
                  h(VCard, { 'data-cy': 'page-dialog' }, () => h(VBtn, () => 'inside'))
                )
              : null,
            h(AUnsavedConfirmDialog, {
              modelValue: question.value,
              'onUpdate:modelValue': (value: boolean) => (question.value = value),
              onResolve: (discard: boolean) => {
                answers.push(discard)
                question.value = false
              },
            }),
          ]),
      }),
      { attachTo: document.body, global: { stubs: { transition: false, 'transition-group': false } } }
    )
    await sleep(300)
    question.value = true
    await expect.poll(() => document.querySelectorAll('.v-overlay--active .v-card').length).toBe(overDialog ? 2 : 1)
    await sleep(400)
    if (focused) {
      const stay = [...document.querySelectorAll<HTMLButtonElement>('.v-overlay--active .v-card button')].at(-2)!
      stay.focus()
      expect(document.activeElement).toBe(stay)
    }

    useAlerts().showError('The save failed')
    await expect.poll(() => visibleAlerts().length).toBe(1)
    await sleep(300)
    await userEvent.keyboard('{Escape}')

    await expect.poll(() => answers, { timeout: 2000 }).toEqual([false])
  })
})
