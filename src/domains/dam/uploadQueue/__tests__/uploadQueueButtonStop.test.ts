import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { damText, uiText } from '@/domains/dam/__tests__/support/uploadUi'
import UploadQueueButtonStop from '@/domains/dam/uploadQueue/components/UploadQueueButtonStop.vue'
import cs from '@/locales/cs'
import en from '@/locales/en'
import sk from '@/locales/sk'

// The button that closes an upload dialog, as both dialogs of the library have it: a queue that is done is closed
// at once, one that still uploads only after the user says so.

const languages = createI18n({ legacy: false, locale: 'en', messages: { sk, en, cs } })

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
    expect(answer('button-confirm').textContent?.trim()).toBe(damText('upload.stopConfirm'))
    expect(answer('button-cancel').textContent).toContain(uiText('common.button.cancel'))
  })

  // Finding 43: the question had two "close", its answer and its cross. The answer says what it does; the cross and
  // the button that opens the question keep their name.
  it('names the answer of its question for what it does, and keeps "close" for its cross and for itself', async () => {
    await mountButton(true)

    await wrapper!.find('[data-cy="button-stop"]').trigger('click')
    await flushPromises()

    expect(answer('button-confirm').textContent?.trim()).toBe('Stop')
    expect(question()!.querySelector('[data-cy="button-close"]')!.getAttribute('aria-label')).toBe('Close')
    expect(wrapper!.find('[data-cy="button-stop"]').attributes('aria-label')).toBe('Close')
  })

  it.each([
    ['sk', 'Zastaviť', 'Zatvoriť'],
    ['en', 'Stop', 'Close'],
    ['cs', 'Zastavit', 'Zavřít'],
  ] as const)('has the answer and the name of the button in %s', (language, answerWord, buttonWord) => {
    const text = (key: string) => languages.global.t(key, {}, { locale: language })

    expect(text('common.damImage.upload.stopConfirm')).toBe(answerWord)
    expect(text('common.damImage.upload.stop')).toBe(buttonWord)
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
