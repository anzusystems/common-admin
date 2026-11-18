import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'
import { createFakeDam, damAsset, type FakeDam, type FakeDamRule } from '@/domains/dam/__tests__/support/fakeDam'
import { alertText, forgetAlerts, shownAlerts } from '@/domains/dam/__tests__/support/uploadUi'
import {
  bulkUpdateAssetsAuthors,
  bulkUpdateAssetsMetadata,
  showMetadataSaveError,
  updateAssetAuthors,
  updateAssetMetadata,
} from '@/domains/dam/api/damAssetApi'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { mapUploadMetadataToImages } from '@/domains/dam/imageWidget/utils/metadataToImageMap'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { type UploadQueueItem, UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import type { CustomDataFormElement } from '@/domains/customDataForm/types/CustomDataForm'
import { AnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { AnzuApiForbiddenError } from '@/shared/error/AnzuApiForbiddenError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { AnzuApiTimeoutError } from '@/shared/error/AnzuApiTimeoutError'
import { AnzuApiValidationError } from '@/shared/error/AnzuApiValidationError'

// Whether the main file is internal is not the library's decision.
// The request carries neither `internal` field, and the DAM's answer about them is read.

const ASSET = '/ugc/v1/asset'

let dam: FakeDam
beforeEach(() => {
  dam = createFakeDam({ asset: ASSET, image: '/ugc/v1/image' })
})

const row = (asset: string | null, parts: Partial<UploadQueueItem> = {}) => {
  const item = useUploadQueueItemFactory().createDefault(
    `file_${asset}`,
    UploadQueueItemType.File,
    UploadQueueItemStatus.Uploaded,
    DamAssetType.Image,
    1024,
    1
  )
  item.assetId = asset
  item.canEditMetadata = true
  return Object.assign(item, parts)
}
const saves = () => dam.sentTo('PATCH', dam.routes.bulkMetadata)
const sent = (index = 0) => dam.body(saves()[index]) as Array<Record<string, unknown>>

describe('the bulk save of the metadata of a queue', () => {
  it('sends what the row holds for its asset, and marks the asset described', async () => {
    const item = row('asset-1', {
      keywords: ['keyword-1'],
      authors: ['author-1', 'author-2'],
      customData: { title: 'typed', description: '' },
      mainFileSingleUse: true,
    })

    const answer = await bulkUpdateAssetsMetadata(dam.client, ASSET, [item])

    expect(saves().map((request) => `${request.method} ${request.url}`)).toEqual([
      'PATCH /ugc/v1/asset/metadata-bulk-update',
    ])
    expect(sent()).toEqual([
      {
        id: 'asset-1',
        keywords: ['keyword-1'],
        authors: ['author-1', 'author-2'],
        described: true,
        customData: { title: 'typed', description: '' },
        mainFileSingleUse: true,
      },
    ])
    expect(answer).toEqual(sent())
  })

  it.each([
    ['is internal', true, true],
    ['is not', false, false],
    ['is unknown', null, false],
  ])('hands on that the main file %s, for the image built from the row', async (_what, mainFileInternal, internal) => {
    dam.reply((request) =>
      request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url)
        ? {
            status: 200,
            data: (dam.body(request) as object[]).map((one) => ({
              ...one,
              mainFileInternal,
              mainFileOverrideInternal: false,
            })),
          }
        : undefined
    )
    const item = row('asset-1', { fileId: 'file-1', customData: { description: 'typed' } })

    const answer = await bulkUpdateAssetsMetadata(dam.client, ASSET, [item])
    const images = await mapUploadMetadataToImages([item], answer, dam.client, 4, 1, '/ugc/v1/author')

    expect(sent()[0]).not.toHaveProperty('mainFileInternal')
    expect(sent()[0]).not.toHaveProperty('mainFileOverrideInternal')
    expect(answer[0]).toHaveProperty('mainFileInternal', mainFileInternal)
    expect(images).toHaveLength(1)
    expect(images[0].dam).toEqual({ damId: 'file-1', regionPosition: 0, licenceId: 1, internal })
    expect(images[0].flags).toEqual({ showSource: true, internal: false, overrideInternal: false })
  })

  // Never null (finding 36): the DAM treats null as "off", and both queue dialogs send the same.
  it.each([
    ['is not known yet, as off', null, false],
    ['is switched off', false, false],
    ['is switched on', true, true],
  ])('sends the single-use switch of a row also when it %s', async (_what, mainFileSingleUse, sentAs) => {
    await bulkUpdateAssetsMetadata(dam.client, ASSET, [row('asset-1', { mainFileSingleUse })])

    expect(sent()[0]).toHaveProperty('mainFileSingleUse', sentAs)
  })

  it.each([true, false])(
    'sends the single-use switch the caller gives (%s) in place of that of each row',
    async (given) => {
      const rows = [row('asset-1', { mainFileSingleUse: !given }), row('asset-2', { mainFileSingleUse: null })]

      await bulkUpdateAssetsMetadata(dam.client, ASSET, rows, given)

      expect(sent().map((one) => one.mainFileSingleUse)).toEqual([given, given])
    }
  )

  it('leaves out a row without an asset and a row whose metadata cannot be edited', async () => {
    const rows = [
      row('asset-editable'),
      row(null),
      row('asset-failed', { status: UploadQueueItemStatus.Failed, canEditMetadata: false }),
      row('asset-waiting-for-metadata', { canEditMetadata: false }),
      // A row still waiting for its file is saved once it has its form. The form decides, not the status.
      row('asset-also-editable', { status: UploadQueueItemStatus.Processing }),
    ]

    await bulkUpdateAssetsMetadata(dam.client, ASSET, rows)

    expect(sent().map((one) => one.id)).toEqual(['asset-editable', 'asset-also-editable'])
  })

  it('sends ten assets a request, one request after the other, and answers with all of them', async () => {
    const rows = Array.from({ length: 23 }, (_, index) => row(`asset-${index}`))
    const holding = dam.hold('PATCH', dam.routes.bulkMetadata)

    const saving = bulkUpdateAssetsMetadata(dam.client, ASSET, rows)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(saves()).toHaveLength(1)
    holding.release()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(saves()).toHaveLength(2)
    holding.release()
    await new Promise((resolve) => setTimeout(resolve, 50))
    holding.release()
    const answer = await saving

    expect([0, 1, 2].map((index) => sent(index).length)).toEqual([10, 10, 3])
    expect(answer.map((one) => one.id)).toEqual(rows.map((one) => one.assetId))
  })

  it('asks for nothing and answers with nothing when no row is to be saved', async () => {
    const answer = await bulkUpdateAssetsMetadata(dam.client, ASSET, [
      row(null),
      row('asset-1', { canEditMetadata: false }),
    ])

    expect(answer).toEqual([])
    expect(dam.requests).toEqual([])
  })

  it.each([201, 204, 422, 500])('is refused when a request is answered with %s', async (status) => {
    dam.reply(() => ({ status, data: [] }))

    const outcome = await bulkUpdateAssetsMetadata(dam.client, ASSET, [row('asset-1')]).then(
      () => 'resolved',
      () => 'rejected'
    )

    expect(outcome).toBe('rejected')
  })

  it('stops at the request that fails: the rows after it are not sent', async () => {
    const rows = Array.from({ length: 23 }, (_, index) => row(`asset-${index}`))
    let request = 0
    dam.reply(() => (++request === 2 ? { status: 500 } : undefined))

    const outcome = await bulkUpdateAssetsMetadata(dam.client, ASSET, rows).then(
      () => 'resolved',
      () => 'rejected'
    )

    expect(outcome).toBe('rejected')
    expect(saves()).toHaveLength(2)
  })
})

describe('the save of the metadata of one asset', () => {
  it('sends the asset in the shape of the bulk save, as a list of one', async () => {
    const asset = damAsset('asset-1', {
      keywords: ['keyword-1'],
      authors: ['author-1'],
      metadata: { customData: { title: 'typed' }, authorSuggestions: {}, keywordSuggestions: {} },
      mainFileSingleUse: false,
      mainFileInternal: true,
      mainFileOverrideInternal: true,
    })

    await updateAssetMetadata(dam.client, ASSET, asset, 4, true)

    expect(saves().map((request) => request.url)).toEqual(['/ugc/v1/asset/metadata-bulk-update'])
    expect(sent()).toEqual([
      {
        id: 'asset-1',
        keywords: ['keyword-1'],
        authors: ['author-1'],
        described: true,
        customData: { title: 'typed' },
        mainFileSingleUse: true,
      },
    ])
  })

  it('sends the single-use switch also when the caller does not know it', async () => {
    await updateAssetMetadata(dam.client, ASSET, damAsset('asset-1'), 4, null)

    expect(sent()[0]).toHaveProperty('mainFileSingleUse', null)
  })
})

// The request must stay identical to the one before the save went through the shared helper: method, path and body.
describe('the save of the authors of one asset', () => {
  const asset = () =>
    damAsset('asset-1', {
      keywords: ['keyword-1'],
      authors: ['author-1', 'author-2'],
      metadata: { customData: { title: 'typed' }, authorSuggestions: {}, keywordSuggestions: {} },
      mainFileSingleUse: true,
    })
  const settled = (save: Promise<unknown>) =>
    Promise.race([
      save.then(
        () => 'resolved',
        (error: unknown) => error
      ),
      new Promise((resolve) => setTimeout(() => resolve('never settled'), 500)),
    ])

  beforeEach(() => {
    setActivePinia(createPinia())
    forgetAlerts()
    setApiErrorLogger(null)
  })
  afterEach(() => setApiErrorLogger(defaultApiErrorLogger))

  it('sends the id and the authors of the asset alone, as a list of one, and marks the asset described', async () => {
    await updateAssetAuthors(dam.client, ASSET, asset())

    expect(saves().map((request) => `${request.method} ${request.url}`)).toEqual([
      'PATCH /ugc/v1/asset/metadata-bulk-update',
    ])
    expect(saves()[0].data).toBe('[{"id":"asset-1","authors":["author-1","author-2"],"described":true}]')
  })

  // The save used to report a refusal itself, and the widget reported it again.
  // With no custom form loaded for the ext system, it threw while reporting.
  // The promise never settled and "Confirm" of the dialog spun forever.
  it.each([
    ['with the custom forms of the ext system loaded', true],
    ['with no custom form loaded', false],
  ])('refused by validation, is an error for its caller to say, and says nothing itself: %s', async (_what, loaded) => {
    if (loaded) {
      useDamConfigStore().damConfigAssetCustomFormElements.set(4, {
        [DamAssetType.Image]: [],
        [DamAssetType.Video]: [],
        [DamAssetType.Audio]: [],
        [DamAssetType.Document]: [],
      })
    }
    dam.reply(() => ({
      status: 422,
      data: { contextId: 'context', error: 'validation_failed', fields: { '[0].authors': ['error_field_empty'] } },
    }))

    const failure = await settled(updateAssetAuthors(dam.client, ASSET, asset()))

    expect(failure).toBeInstanceOf(AnzuApiValidationError)
    expect(shownAlerts()).toEqual([])
    showMetadataSaveError(failure, 4, 'default')
    expect(shownAlerts()).toHaveLength(1)
    const [, ...lines] = (shownAlerts()[0]![1] as string).split('\n')
    expect(lines.map((line) => line.split(': ')[0])).toEqual([alertText('common.damImage.asset.model.authors')])
  })
})

// A failed save is turned into an error of a kind the alert of errors knows. Only unplanned
// failures are converted, not nobody signed in, a user without permission, or a validation refusal.
// The bulk save of a queue builds on the answer. The other two read nothing from it.
describe.each([
  ['the bulk save of a queue', () => bulkUpdateAssetsMetadata(dam.client, ASSET, [row('asset-1')]), true],
  [
    'the save of the metadata of one asset',
    () => updateAssetMetadata(dam.client, ASSET, damAsset('asset-1'), 4, null),
    false,
  ],
  [
    'the save of the authors of a gallery',
    () => bulkUpdateAssetsAuthors(dam.client, ASSET, [{ id: 'asset-1', authors: ['author-1'] }]),
    false,
  ],
  [
    'the save of the authors of one asset',
    () => updateAssetAuthors(dam.client, ASSET, damAsset('asset-1', { authors: ['author-1'] })),
    false,
  ],
])('%s that fails', (_name, save: () => Promise<unknown>, readsTheAnswer) => {
  const refusal = {
    contextId: 'context',
    error: 'validation_failed',
    fields: { '[0].customData.title': ['error_field_empty'] },
  }
  const failureOf = (rule: FakeDamRule) => {
    dam.reply((request) =>
      request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url) ? rule(request) : undefined
    )

    return save().then(
      () => undefined,
      (error: unknown) => error
    )
  }

  beforeEach(() => setApiErrorLogger(null))
  afterEach(() => setApiErrorLogger(defaultApiErrorLogger))

  type Refusal = [string, FakeDamRule, new (...args: never[]) => Error]
  const noList: Refusal = [
    'is answered with 200 and no list',
    () => ({ status: 200, data: {} }),
    AnzuApiResponseCodeError,
  ]

  it.each<Refusal>([
    ['is answered with 403', () => ({ status: 403 }), AnzuApiForbiddenError],
    ['is refused by validation', () => ({ status: 422, data: refusal }), AnzuApiValidationError],
    ['is answered with 500', () => ({ status: 500 }), AnzuApiAxiosError],
    // Only a 200 carries the saved assets.
    ['is answered with 201', () => ({ status: 201, data: [] }), AnzuApiAxiosError],
    ['is answered with 204', () => ({ status: 204 }), AnzuApiAxiosError],
    ...(readsTheAnswer ? [noList] : []),
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
  ])('is an error the alert of errors knows when its request %s', async (_what, rule, kind) => {
    expect(await failureOf(rule)).toBeInstanceOf(kind)
  })

  if (!readsTheAnswer) {
    it('is no failure when its request is answered with 200 and no list: nothing reads the answer', async () => {
      expect(await failureOf(() => ({ status: 200, data: {} }))).toBeUndefined()
      expect(saves()).toHaveLength(1)
    })
  }

  it.each([
    ['is written down', { status: 500 }, 1],
    ['is not written down when nobody is signed in', { status: 401 }, 0],
    ['is not written down when the user may not', { status: 403 }, 0],
    ['is not written down when the server says what to fix', { status: 422, data: refusal }, 0],
  ])('%s', async (_what, answer, written) => {
    const logged = vi.fn()
    setApiErrorLogger(logged)

    const failure = await failureOf(() => answer)

    expect(saves()).toHaveLength(1)
    expect(failure).toBeInstanceOf(Error)
    expect(logged).toHaveBeenCalledTimes(written)
    if (written) {
      expect(logged.mock.calls[0]![1]).toMatchObject({
        system: 'coreDam',
        entity: 'asset',
        url: `${ASSET}/metadata-bulk-update`,
        status: 500,
      })
    }
  })
})

describe('a save refused by validation, as the user is told it', () => {
  const extSystem = 4
  const element = (property: string, name: string) => ({ property, name }) as CustomDataFormElement
  const refused = (key: string) => ({
    status: 422,
    data: { contextId: 'context', error: 'validation_failed', fields: { [key]: ['error_field_empty'] } },
  })
  const fieldsSaid = () => {
    expect(shownAlerts()).toHaveLength(1)
    const [[colour, text]] = shownAlerts() as Array<[string, string]>
    const [heading, ...lines] = text.split('\n')

    return { colour, heading, fields: lines.map((line) => line.split(': ')[0]) }
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    forgetAlerts()
    setApiErrorLogger(null)
    useDamConfigStore().damConfigAssetCustomFormElements.set(extSystem, {
      [DamAssetType.Image]: [element('description', 'Description of the image')],
      [DamAssetType.Video]: [element('description', 'Description of the video')],
      [DamAssetType.Audio]: [],
      [DamAssetType.Document]: [],
    })
  })
  afterEach(() => setApiErrorLogger(defaultApiErrorLogger))

  // The server names the position of the asset within the refused request. The second request starts again at 0.
  it('names a custom field by the form of the type of its asset, in the batch the server refused', async () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, index) => row(`image-${index}`)),
      row('video-1', { assetType: DamAssetType.Video }),
    ]
    let request = 0
    dam.reply((asked) =>
      asked.method === 'PATCH' && dam.routes.bulkMetadata.test(asked.url) && ++request === 2
        ? refused('[0].customData.description')
        : undefined
    )

    const failure = await bulkUpdateAssetsMetadata(dam.client, ASSET, rows).then(
      () => undefined,
      (error: unknown) => error
    )
    showMetadataSaveError(failure, extSystem, 'default')

    expect(saves().map((one) => (dam.body(one) as unknown[]).length)).toEqual([10, 1])
    expect(fieldsSaid()).toEqual({
      colour: 'error',
      heading: alertText('common.alert.fixApiValidationErrors'),
      fields: ['Description of the video'],
    })
  })
})
