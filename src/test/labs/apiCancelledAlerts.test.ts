import { describe, expect, it, vi } from 'vitest'
import { AnzuApiCancelledError } from '@/model/error/AnzuApiCancelledError'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { useAlerts } from '@/composables/system/alerts'

// The cancellation model is only additive if the fleet's error handling already knows what a stopped
// request is. It did not: `showErrorsDefault` fell through to `false`, and the callers that end with
// `if (!showErrorsDefault(e)) showUnknownError()` -- one of them in this library -- turned every
// superseded autocomplete request into an "unknown error" toast.

vi.mock('@kyvg/vue3-notification', () => ({ notify: vi.fn() }))

describe('what the default error handling does with a stopped request', () => {
  it('treats it as handled, and shows nothing', async () => {
    const { notify } = await import('@kyvg/vue3-notification')
    const { showErrorsDefault } = useAlerts()

    expect(showErrorsDefault(new AnzuApiCancelledError(new Error('canceled')))).toBe(true)
    expect(notify).not.toHaveBeenCalled()
  })

  // The branch has to be narrow: everything else still has to reach its own message.
  it('still shows the failures that are failures', async () => {
    const { notify } = await import('@kyvg/vue3-notification')
    const { showErrorsDefault } = useAlerts()

    expect(showErrorsDefault(new AnzuApiResponseCodeError(500))).toBe(true)
    expect(notify).toHaveBeenCalled()
  })
})
