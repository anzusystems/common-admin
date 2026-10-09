import { beforeEach, describe, expect, it } from 'vitest'
import axios from 'axios'
import { createFakeDam, type FakeDam, type FakeDamRule } from '@/domains/dam/__tests__/support/fakeDam'
import { copyToLicence } from '@/domains/dam/api/damImageApi'
import type { DamImageCopyToLicenceRequest, DamImageCopyToLicenceResponseItem } from '@/domains/dam/types/Asset'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'
import { AnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { AnzuApiCancelledError } from '@/shared/error/AnzuApiCancelledError'
import { AnzuApiForbiddenError } from '@/shared/error/AnzuApiForbiddenError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { AnzuApiTimeoutError } from '@/shared/error/AnzuApiTimeoutError'

// The request that copies picked assets to the licence of a widget: how many assets a request, and what comes
// back for all of them. The rows of the upload queue are made from its answer.

const END_POINT = '/adm/v1/asset'
const COPY = /\/copy-to-licence$/

let dam: FakeDam
beforeEach(() => {
  dam = createFakeDam({ asset: END_POINT, image: '/adm/v1/image' })
  // The DAM answers each asset it was sent, copied.
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
/** What the copy of 45 assets rejects with when the second of its three requests is answered as told. */
const failureOf = (second: FakeDamRule) => {
  let request = 0
  dam.reply((asked) => (++request === 2 ? second(asked) : undefined))
  return copyToLicence(dam.client, END_POINT, picked(45)).then(
    () => undefined,
    (error: unknown) => error
  )
}
/** What the alert the widgets hand a failed copy to makes of it. */
const shown = (error: unknown) => {
  useAlerts().showErrorsDefault(error)
  return useAlertsQueue().value.map((alert) => alert.color)
}

describe('the copy of assets to a licence', () => {
  it('asks the copy path of the endpoint handed in, with the assets and their target licence', async () => {
    const answer = await copyToLicence(dam.client, END_POINT, picked(2))

    expect(dam.requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      'PATCH /adm/v1/asset/copy-to-licence',
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

  // An answer that is a success and not "ok" carries no list of what was copied. Taken for an empty answer, its
  // assets were missing from the result and nothing said so.
  it.each([201, 202, 204])(
    'is refused as a whole when one of its requests is answered with %i: a success that is not "ok"',
    async (status) => {
      const failure = await failureOf(() => ({ status }))

      // With the status, as the failure of a request the widgets hand to the user.
      expect(failure).toBeInstanceOf(AnzuApiResponseCodeError)
      expect((failure as AnzuApiResponseCodeError).code).toBe(status)
      expect(shown(failure)).toEqual(['error'])
    }
  )

  // Rejected with the bare error of axios, a failed copy passed the alert of the widgets without a word.
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
