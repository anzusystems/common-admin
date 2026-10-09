import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { damText, uiText } from '@/domains/dam/__tests__/support/uploadUi'
import UploadQueueButtonStop from '@/domains/dam/uploadQueue/components/UploadQueueButtonStop.vue'

// The button that closes an upload dialog, as both dialogs of the library have it: a queue that is done is closed
// at once, one that still uploads only after the user says so.

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const mountButton = async (isUploading: boolean, props: Record<string, unknown> = {}) => {
  wrapper = mount(UploadQueueButtonStop, { attachTo: document.body, props: { isUploading, ...props } })
  await flushPromises()
  return wrapper
}
// The question is drawn into the body.
const question = () => document.body.querySelector<HTMLElement>('[data-cy="delete-panel"]')
const answer = (name: 'button-confirm' | 'button-cancel') =>
  question()!.querySelector<HTMLButtonElement>(`[data-cy="${name}"]`)!
const confirmed = () => wrapper!.emitted('confirm') ?? []

describe('the button that closes an upload dialog', () => {
  it('is named for what it does, and is found by the name the dialog gives it', async () => {
    await mountButton(false, { dataCy: 'button-close' })

    const button = wrapper!.find('button')
    expect(button.attributes('aria-label')).toBe(damText('upload.stop'))
    expect(button.attributes('data-cy')).toBe('button-close')
  })

  it('closes at once when nothing is being uploaded', async () => {
    await mountButton(false)

    await wrapper!.find('[data-cy="button-stop"]').trigger('click')
    await flushPromises()

    expect(confirmed()).toHaveLength(1)
    expect(question()).toBeNull()
  })

  it('asks first while the queue still uploads, and closes nothing by the click alone', async () => {
    await mountButton(true)

    await wrapper!.find('[data-cy="button-stop"]').trigger('click')
    await flushPromises()

    expect(confirmed()).toHaveLength(0)
    expect(question()!.textContent).toContain(damText('upload.stopConfirmQuestion'))
    expect(answer('button-confirm').textContent).toContain(damText('upload.stop'))
    expect(answer('button-cancel').textContent).toContain(uiText('common.button.cancel'))
  })

  it('closes once the user confirms, and the question goes', async () => {
    await mountButton(true)
    await wrapper!.find('[data-cy="button-stop"]').trigger('click')
    await flushPromises()

    answer('button-confirm').click()
    await flushPromises()

    expect(confirmed()).toHaveLength(1)
    await vi.waitFor(() => expect(question()).toBeNull())
  })

  it('closes nothing when the user cancels, and asks again on the next click', async () => {
    await mountButton(true)
    await wrapper!.find('[data-cy="button-stop"]').trigger('click')
    await flushPromises()

    answer('button-cancel').click()
    await flushPromises()

    expect(confirmed()).toHaveLength(0)
    await vi.waitFor(() => expect(question()).toBeNull())

    await wrapper!.find('[data-cy="button-stop"]').trigger('click')
    await flushPromises()
    expect(question()).not.toBeNull()
    expect(confirmed()).toHaveLength(0)
  })

  // The upload ended while the question was open: the answer is still the user's to give.
  it('still closes only on the confirmation when the upload ends while the question is open', async () => {
    await mountButton(true)
    await wrapper!.find('[data-cy="button-stop"]').trigger('click')
    await flushPromises()

    await wrapper!.setProps({ isUploading: false })
    expect(confirmed()).toHaveLength(0)
    expect(question()).not.toBeNull()

    answer('button-confirm').click()
    await flushPromises()
    expect(confirmed()).toHaveLength(1)
  })
})
