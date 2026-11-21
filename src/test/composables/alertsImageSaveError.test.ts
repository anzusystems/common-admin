import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { notify } from '@kyvg/vue3-notification'
import { useAlerts } from '@/composables/system/alerts'
import { AnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'

vi.mock('@kyvg/vue3-notification', () => ({ notify: vi.fn() }))

const DAM_ID = '0d584443-2718-470a-b9b1-92d2d9c7447c'

const apiError = (data: Record<string, unknown>) =>
  new AnzuApiAxiosError(
    new AxiosError('Request failed with status code 422', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data,
    })
  )

const notifiedText = () => vi.mocked(notify).mock.calls[0]?.[0]

describe('showErrorsDefault', () => {
  beforeEach(() => {
    vi.mocked(notify).mockClear()
  })

  it('names the single use photo when a save that writes image rows is refused', () => {
    const { showErrorsDefault } = useAlerts()

    expect(
      showErrorsDefault(
        apiError({
          error: 'image_single_use_violation',
          reason: 'exclusivity_conflict',
          damId: DAM_ID,
          holderResourceName: 'articleKindStandard',
          holderResourceId: 'f17ede57-b5b8-4b1a-a5cd-c5f56660d3f9',
        })
      )
    ).toBe(true)
    expect(notifiedText()).toMatchObject({ type: 'error', text: 'common.damImage.image.error.singleUseViolation' })
  })

  it('keeps the unknown error for other API errors', () => {
    const { showErrorsDefault } = useAlerts()

    expect(showErrorsDefault(apiError({ error: 'something_else' }))).toBe(true)
    expect(notifiedText()).toMatchObject({ type: 'error', text: 'common.alert.unknownError' })
  })
})
