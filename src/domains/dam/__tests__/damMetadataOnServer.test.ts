import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createFakeDam, damAsset, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { bulkUpdateAssetsMetadata, updateAssetMetadata } from '@/domains/dam/api/damAssetApi'
import {
  metadataOfAsset,
  metadataOnServer,
  rebaseCustomData,
  setMetadataOnServer,
} from '@/domains/dam/api/damMetadataOnServer'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { type UploadQueueItem, UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'

/*
 * Two editors save the same asset (#87746 DAM-B19, DAM-B25). The DAM keeps a field a save leaves out, but deletes a
 * custom field left out of the custom data. So a save sends only the fields changed against what the DAM had when
 * the row or the detail got its metadata, and changed custom data rebased onto the asset read right before.
 * A field both changed keeps the value of the later save.
 */

const ASSET = '/adm/v1/asset'

let dam: FakeDam
beforeEach(() => {
  setActivePinia(createPinia())
  dam = createFakeDam({ asset: ASSET, image: '/adm/v1/image' })
})

const onTheDam = (id: string, parts: Parameters<typeof damAsset>[1] = {}) => {
  const asset = damAsset(id, {
    flags: { described: true, visible: true },
    metadata: { customData: { title: 'first', note: 'first note' }, authorSuggestions: {}, keywordSuggestions: {} },
    ...parts,
  })
  dam.assets.set(id, asset)

  return structuredClone(asset)
}

/** Another editor saves: the DAM has these from now on. */
const savedElsewhere = (id: string, parts: { customData?: Record<string, unknown>; authors?: string[] }) => {
  const asset = dam.assets.get(id)!
  if (parts.customData) asset.metadata = { ...asset.metadata, customData: parts.customData }
  if (parts.authors) asset.authors = parts.authors
}

// A row as the queue holds it once the DAM sent its metadata.
const loadedRow = (id: string) => {
  const asset = onTheDam(id)
  const item = useUploadQueueItemFactory().createDefault(
    `file_${id}`,
    UploadQueueItemType.File,
    UploadQueueItemStatus.Uploaded,
    DamAssetType.Image,
    1024,
    1
  )
  Object.assign(item, {
    assetId: id,
    canEditMetadata: true,
    keywords: [...asset.keywords],
    authors: [...asset.authors],
    customData: { ...asset.metadata.customData },
    mainFileSingleUse: asset.mainFileSingleUse,
  })
  setMetadataOnServer(item, metadataOfAsset(asset))

  return item as UploadQueueItem
}

const saves = () => dam.sentTo('PATCH', dam.routes.bulkMetadata)
const sent = (index = 0) => dam.body(saves()[index]) as Array<Record<string, unknown>>
const reads = () => dam.sentTo('GET', dam.routes.byIds)
const saveRows = (rows: UploadQueueItem[]) => bulkUpdateAssetsMetadata(dam.client, ASSET, rows, undefined, 1, 'default')

describe('the bulk save of a queue, after another editor saved the asset', () => {
  it('keeps the custom fields the other editor filled in or changed, and saves the field typed in the row', async () => {
    const row = loadedRow('asset-1')
    savedElsewhere('asset-1', { customData: { title: 'first', note: 'their note', caption: 'their caption' } })

    row.customData = { ...row.customData, title: 'typed' }
    await saveRows([row])

    expect(dam.assets.get('asset-1')!.metadata.customData).toEqual({
      title: 'typed',
      note: 'their note',
      caption: 'their caption',
    })
    expect([reads().length, sent()]).toEqual([
      1,
      [
        {
          id: 'asset-1',
          described: true,
          customData: { title: 'typed', note: 'their note', caption: 'their caption' },
        },
      ],
    ])
  })

  it('saves the field typed in the row over the other editor’s change of it: the later save wins', async () => {
    const row = loadedRow('asset-1')
    savedElsewhere('asset-1', { customData: { title: 'theirs', note: 'first note' } })

    row.customData = { ...row.customData, title: 'typed' }
    await saveRows([row])

    expect(dam.assets.get('asset-1')!.metadata.customData).toEqual({ title: 'typed', note: 'first note' })
  })

  it('leaves the authors the other editor added, and reads nothing when no custom data go', async () => {
    const row = loadedRow('asset-1')
    savedElsewhere('asset-1', { authors: ['author-theirs'] })

    row.keywords = ['keyword-typed']
    await saveRows([row])

    expect(dam.assets.get('asset-1')!.authors).toEqual(['author-theirs'])
    expect([reads(), sent()]).toEqual([[], [{ id: 'asset-1', described: true, keywords: ['keyword-typed'] }]])
  })

  it('sends a row nobody changed with its asset marked described alone, and its answer is the asset as saved', async () => {
    const row = loadedRow('asset-1')

    const answer = await saveRows([row])

    expect(sent()).toEqual([{ id: 'asset-1', described: true }])
    expect(answer).toMatchObject([{ id: 'asset-1', customData: { title: 'first', note: 'first note' } }])
  })

  it('sends nothing of a row again after its save, until it is changed', async () => {
    const row = loadedRow('asset-1')
    row.customData = { ...row.customData, title: 'typed' }
    await saveRows([row])

    await saveRows([row])
    row.authors = ['author-typed']
    await saveRows([row])

    expect([sent(1), sent(2)]).toEqual([
      [{ id: 'asset-1', described: true }],
      [{ id: 'asset-1', described: true, authors: ['author-typed'] }],
    ])
  })

  it('reads the assets of a request of ten once, before that request', async () => {
    const rows = Array.from({ length: 12 }, (_value, index) => loadedRow(`asset-${index}`))

    rows.forEach((row) => (row.customData = { title: 'typed' }))
    await saveRows(rows)

    expect([reads().length, saves().map((request) => (dam.body(request) as unknown[]).length)]).toEqual([2, [10, 2]])
  })

  it('sends a row whole when it is not known what the DAM had', async () => {
    const row = loadedRow('asset-1')
    const unknown = Object.assign(
      useUploadQueueItemFactory().createDefault(
        'other',
        UploadQueueItemType.File,
        UploadQueueItemStatus.Uploaded,
        DamAssetType.Image,
        1024,
        1
      ),
      {
        assetId: 'asset-2',
        canEditMetadata: true,
        keywords: ['keyword-1'],
        customData: { title: 'x' },
      }
    )

    await saveRows([row, unknown])

    expect(sent()[1]).toEqual({
      id: 'asset-2',
      keywords: ['keyword-1'],
      authors: [],
      described: true,
      customData: { title: 'x' },
      mainFileSingleUse: false,
    })
    expect(metadataOnServer(unknown)).toMatchObject({ keywords: ['keyword-1'], customData: { title: 'x' } })
  })
})

describe('the save of the asset detail, after another editor saved the asset', () => {
  const formOf = (id: string) => {
    const asset = onTheDam(id)

    return { asset, known: metadataOfAsset(asset) }
  }
  const save = (asset: ReturnType<typeof damAsset>, singleUse: boolean | null, known = metadataOfAsset(asset)) =>
    updateAssetMetadata(dam.client, ASSET, asset, 1, singleUse, 'default', known)

  it('sends only what was changed in the form: the authors the other editor added stay', async () => {
    const { asset, known } = formOf('asset-1')
    savedElsewhere('asset-1', { authors: ['author-theirs'] })

    asset.metadata.customData = { ...asset.metadata.customData, title: 'typed' }
    await save(asset, null, known)

    expect(dam.assets.get('asset-1')!.authors).toEqual(['author-theirs'])
    expect(sent()).toEqual([{ id: 'asset-1', described: true, customData: { title: 'typed', note: 'first note' } }])
  })

  it('rebases changed custom data onto the asset read right before, and resolves to the form’s next known state', async () => {
    const { asset, known } = formOf('asset-1')
    savedElsewhere('asset-1', { customData: { title: 'first', note: 'their note' } })

    asset.metadata.customData = { ...asset.metadata.customData, title: 'typed' }
    const next = await save(asset, null, known)

    expect(dam.assets.get('asset-1')!.metadata.customData).toEqual({ title: 'typed', note: 'their note' })
    expect(dam.sentTo('GET', dam.routes.one).map((request) => request.url)).toEqual([`${ASSET}/asset-1`])
    // What the form shows: its next save sends nothing of this.
    expect(next).toEqual({ ...known, customData: { title: 'typed', note: 'first note' } })
  })

  it('sends the single-use switch only when it was changed: off and not known are the same', async () => {
    const { asset, known } = formOf('asset-1')

    await save(asset, false, known)
    await save(asset, true, known)

    expect([sent(0), sent(1)]).toEqual([
      [{ id: 'asset-1', described: true }],
      [{ id: 'asset-1', described: true, mainFileSingleUse: true }],
    ])
  })

  it('sends the form whole without what the DAM had, as before', async () => {
    const asset = onTheDam('asset-1')

    await updateAssetMetadata(dam.client, ASSET, asset, 1, null, 'default')

    expect(sent()).toEqual([
      {
        id: 'asset-1',
        keywords: [],
        authors: [],
        described: true,
        customData: { title: 'first', note: 'first note' },
        mainFileSingleUse: null,
      },
    ])
  })
})

describe('custom data rebased onto what the DAM has', () => {
  it('takes the keys changed against the base, and all others as the DAM has them, without empty ones', () => {
    expect(
      rebaseCustomData(
        { title: 'typed', note: 'first note', gone: undefined, cleared: null },
        { title: 'first', note: 'first note', cleared: 'was' },
        { title: 'theirs', note: 'their note', caption: 'their caption', cleared: 'was' }
      )
    ).toEqual({ title: 'typed', note: 'their note', caption: 'their caption', cleared: null })
  })
})
