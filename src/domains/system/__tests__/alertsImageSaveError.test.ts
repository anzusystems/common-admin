import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { useAlerts } from '@/domains/system/composables/alerts'
import { AnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { pushAlert } from '@/domains/system/composables/alertsQueue'

// Any save that writes image rows (an article, a gallery, a person) can be refused by core-cms for a single use photo.
// The default error handling names the photo and its holder instead of an unknown error.

vi.mock('@/domains/system/composables/alertsQueue', () => ({ pushAlert: vi.fn() }))

const DAM_ID = '0d584443-2718-470a-b9b1-92d2d9c7447c'

const axiosError = (data: Record<string, unknown>) =>
  new AxiosError('Request failed with status code 422', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 422,
    statusText: 'Unprocessable Entity',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data,
  })

const refusal = {
  error: 'image_single_use_violation',
  reason: 'exclusivity_conflict',
  damId: DAM_ID,
  holderResourceName: 'articleKindStandard',
  holderResourceId: 'f17ede57-b5b8-4b1a-a5cd-c5f56660d3f9',
}

const shown = () => vi.mocked(pushAlert).mock.calls[0]

describe('showErrorsDefault', () => {
  beforeEach(() => {
    vi.mocked(pushAlert).mockClear()
  })

  it('names the single use photo when a save that writes image rows is refused', () => {
    const { showErrorsDefault } = useAlerts()

    expect(showErrorsDefault(new AnzuApiAxiosError(axiosError(refusal)))).toBe(true)
    expect(shown()?.[0]).toBe('error')
    expect(shown()?.[1]).toBe('common.damImage.image.error.singleUseViolation')
  })

  // `bulkUpdateImages` rejects with the axios error itself, which the default handling otherwise does not show.
  it('names it also for the bare axios error of a gallery save', () => {
    const { showErrorsDefault } = useAlerts()

    expect(showErrorsDefault(axiosError(refusal))).toBe(true)
    expect(shown()?.[1]).toBe('common.damImage.image.error.singleUseViolation')
  })

  it('keeps the unknown error for other API errors', () => {
    const { showErrorsDefault } = useAlerts()

    expect(showErrorsDefault(new AnzuApiAxiosError(axiosError({ error: 'something_else' })))).toBe(true)
    expect(shown()?.[1]).toBe('common.alert.unknownError')
  })

  it('still leaves a bare axios error of something else to the caller', () => {
    const { showErrorsDefault } = useAlerts()

    expect(showErrorsDefault(axiosError({ error: 'something_else' }))).toBe(false)
    expect(pushAlert).not.toHaveBeenCalled()
  })
})
