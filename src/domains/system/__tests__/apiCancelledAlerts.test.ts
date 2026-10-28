import { describe, expect, it, vi } from 'vitest'
import { AnzuApiCancelledError } from '@/shared/error/AnzuApiCancelledError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { useAlerts } from '@/domains/system/composables/alerts'

// `showErrorsDefault` used to fall through to `false` for a stopped request.
// Callers ending with `if (!showErrorsDefault(e)) showUnknownError()`, one of them in this
// library, then turned every superseded autocomplete request into an "unknown error" toast.

vi.mock('@/domains/system/composables/alertsQueue', () => ({ pushAlert: vi.fn() }))

describe('what the default error handling does with a stopped request', () => {
  it('treats it as handled, and shows nothing', async () => {
    const { pushAlert: notify } = await import('@/domains/system/composables/alertsQueue')
    const { showErrorsDefault } = useAlerts()

    expect(showErrorsDefault(new AnzuApiCancelledError(new Error('canceled')))).toBe(true)
    expect(notify).not.toHaveBeenCalled()
  })

  // The branch has to be narrow: everything else still has to reach its own message.
  it('still shows the failures that are failures', async () => {
    const { pushAlert: notify } = await import('@/domains/system/composables/alertsQueue')
    const { showErrorsDefault } = useAlerts()

    expect(showErrorsDefault(new AnzuApiResponseCodeError(500))).toBe(true)
    expect(notify).toHaveBeenCalled()
  })
})
