import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'
import { createFakeDam, type FakeDam, type FakeDamRule } from '@/domains/dam/__tests__/support/fakeDam'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import { copyToLicence } from '@/domains/dam/api/damImageApi'
import type { DamImageCopyToLicenceRequest, DamImageCopyToLicenceResponseItem } from '@/domains/dam/types/Asset'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'
import { AnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { AnzuApiCancelledError } from '@/shared/error/AnzuApiCancelledError'
import { AnzuApiForbiddenError } from '@/shared/error/AnzuApiForbiddenError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { AnzuApiTimeoutError } from '@/shared/error/AnzuApiTimeoutError'

const END_POINT = '/adm/v1/image'
const COPY = /\/copy-to-licence$/

let dam: FakeDam
beforeEach(() => {
  dam = createFakeDam({ asset: '/adm/v1/asset', image: END_POINT })
  dam.reply((request) =>
    request.method === 'PATCH' && COPY.test(request.url)
      ? { status: 200, data: (dam.body(request) as DamImageCopyToLicenceRequest).map(copied) }
      : undefined
  )
  useAlertsQueue().value = []
})

const copied = (item: DamImageCopyToLicenceRequest[number]): DamImageCopyToLicenceResponseItem => ({
  asset: item.asset,
  targetAsset: `copy-of-${item.asset}`,
  targetMainFile: `file-of-copy-of-${item.asset}`,
  targetAssetLicence: item.targetAssetLicence,
  result: 'copy',
  assetConflicts: [],
})
const picked = (count: number): DamImageCopyToLicenceRequest =>
  Array.from({ length: count }, (_, index) => ({ asset: `asset-${index}`, targetAssetLicence: 100001 }))
const sent = () => dam.requests.map((request) => dam.body(request) as DamImageCopyToLicenceRequest)
const failureOf = (second: FakeDamRule) => {
  let request = 0
  dam.reply((asked) => (++request === 2 ? second(asked) : undefined))
  return copyToLicence(dam.client, END_POINT, picked(45)).then(
    () => undefined,
    (error: unknown) => error
  )
}
const shown = (error: unknown) => {
  useAlerts().showErrorsDefault(error)
  return useAlertsQueue().value.map((alert) => alert.color)
}

describe('the copy of assets to a licence', () => {
  it('asks the copy path of the endpoint handed in, with the assets and their target licence', async () => {
    const answer = await copyToLicence(dam.client, END_POINT, picked(2))

    expect(dam.requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      'PATCH /adm/v1/image/copy-to-licence',
    ])
    expect(sent()).toEqual([picked(2)])
    expect(answer).toEqual(picked(2).map(copied))
  })

  it('sends twenty assets a request, and answers with all of them in the order they were picked', async () => {
    const answer = await copyToLicence(dam.client, END_POINT, picked(45))

    expect(sent().map((request) => request.length)).toEqual([20, 20, 5])
    expect(sent().flat()).toEqual(picked(45))
    expect(answer.map((one) => one.asset)).toEqual(picked(45).map((one) => one.asset))
  })

  it('takes fifty assets at most: more are refused before anything is asked', async () => {
    await expect(copyToLicence(dam.client, END_POINT, picked(50))).resolves.toHaveLength(50)
    const requests = dam.requests.length

    await expect(copyToLicence(dam.client, END_POINT, picked(51))).rejects.toBe('Exceeded max limit')
    expect(dam.requests).toHaveLength(requests)
  })

  it('is refused as a whole when one of its requests fails', async () => {
    let request = 0
    dam.reply(() => (++request === 2 ? { status: 500 } : undefined))

    const outcome = await copyToLicence(dam.client, END_POINT, picked(45)).then(
      () => 'resolved',
      () => 'rejected'
    )

    expect(outcome).toBe('rejected')
  })

  // A success status other than "ok" carries no list of copied assets.
  // It was taken for an empty answer, so assets went missing from the result without any error.
  it.each([201, 202, 204])(
    'is refused as a whole when one of its requests is answered with %i: a success that is not "ok"',
    async (status) => {
      const failure = await failureOf(() => ({ status }))

      expect(failure).toBeInstanceOf(AnzuApiResponseCodeError)
      expect((failure as AnzuApiResponseCodeError).code).toBe(status)
      expect(shown(failure)).toEqual(['error'])
    }
  )

  // Rejected with the bare axios error, a failed copy passed the widgets' alert without any message.
  it.each<[string, FakeDamRule, new (...args: never[]) => Error]>([
    ['is answered with 500', () => ({ status: 500 }), AnzuApiAxiosError],
    ['is answered with 404', () => ({ status: 404 }), AnzuApiAxiosError],
    ['is answered with 403', () => ({ status: 403 }), AnzuApiForbiddenError],
    [
      'never reaches the server',
      (asked) => {
        throw new axios.AxiosError('Network Error', axios.AxiosError.ERR_NETWORK, asked.config as never)
      },
      AnzuApiAxiosError,
    ],
    [
      'is not answered in time',
      (asked) => {
        throw new axios.AxiosError('timeout of 1ms exceeded', axios.AxiosError.ECONNABORTED, asked.config as never)
      },
      AnzuApiTimeoutError,
    ],
  ])('a request that %s is a failure the error alert knows, and shows once', async (_, second, failed) => {
    const failure = await failureOf(second)

    expect(failure).toBeInstanceOf(failed)
    expect(shown(failure)).toEqual(['error'])
  })

  it('a request that was stopped is a cancel, which the error alert keeps quiet about', async () => {
    const failure = await failureOf((asked) => {
      throw new axios.CanceledError(undefined, undefined, asked.config as never)
    })

    expect(failure).toBeInstanceOf(AnzuApiCancelledError)
    expect(shown(failure)).toEqual([])
  })
})

describe('the failure of a copy, for the api error logger', () => {
  afterEach(() => {
    // Module state shared by every file this worker runs.
    setApiErrorLogger(defaultApiErrorLogger)
  })

  it.each<[string, FakeDamRule, number]>([
    ['is handed a request answered with 500, with what was asked', () => ({ status: 500 }), 1],
    [
      'does not hear of a request that was stopped',
      (asked) => {
        throw new axios.CanceledError(undefined, undefined, asked.config as never)
      },
      0,
    ],
  ])('%s', async (_, second, times) => {
    const logged = vi.fn()
    setApiErrorLogger(logged)

    await failureOf(second)

    expect(logged).toHaveBeenCalledTimes(times)
    if (times) {
      expect(logged.mock.calls[0]![1]).toMatchObject({
        system: SYSTEM_CORE_DAM,
        entity: 'asset',
        url: expect.stringContaining('/adm/v1/image/copy-to-licence'),
        status: 500,
      })
    }
  })
})
