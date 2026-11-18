import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileFailReason, AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { type UploadQueueKey, UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import {
  type ManualScheduler,
  manualScheduler,
} from '@/domains/dam/uploadQueue/settlement/__tests__/support/manualScheduler'
import {
  damAsset,
  damFile,
  fakeDamServer,
  type FakeDamServer,
  fakeVisibility,
  libProfile,
  queueRow,
} from '@/domains/dam/uploadQueue/settlement/__tests__/support/settlementFixtures'
import { createUploadSettlement } from '@/domains/dam/uploadQueue/settlement/uploadSettlement'
import { uploadSettlementRuntime } from '@/domains/dam/uploadQueue/settlement/uploadSettlementRuntime'
import type {
  UploadSettlement,
  UploadSettlementProfile,
} from '@/domains/dam/uploadQueue/settlement/uploadSettlementTypes'

const S = 1000
const OF_DEFAULT = 'queue-of-default'
const OF_OWN = 'queue-of-own'
const { Processing, Uploaded, Failed } = UploadQueueItemStatus

const realRuntime = { ...uploadSettlementRuntime }
let clock: ManualScheduler
let servers: Record<'default' | 'own', FakeDamServer>
let settlement: UploadSettlement

beforeEach(() => {
  clock = manualScheduler()
  uploadSettlementRuntime.scheduler = clock
  uploadSettlementRuntime.visibility = fakeVisibility()
  servers = { default: fakeDamServer(), own: fakeDamServer() }
})

afterEach(() => {
  settlement?.dispose()
  uploadSettlementRuntime.scheduler = realRuntime.scheduler
  uploadSettlementRuntime.visibility = realRuntime.visibility
})

const configOf = (queueKey: UploadQueueKey) => (queueKey === OF_OWN ? 'own' : 'default')
const bothProcessed = () => {
  for (const name of ['default', 'own'] as const) {
    servers[name].assets.set(
      'asset-1',
      damAsset('asset-1', damFile(`file-${name}`, AssetFileProcessStatus.Processed), {
        keywords: [`keyword-${name}`],
        authors: [`author-${name}`],
        metadata: { customData: {}, authorSuggestions: {}, keywordSuggestions: {} },
      })
    )
  }
}

const twoQueues = (withConfigOf = true) => {
  const made = libProfile(servers.default)
  const serverOf = (queueKey?: UploadQueueKey) => servers[queueKey === undefined ? 'default' : configOf(queueKey)]
  const told: string[] = []
  const caches: UploadSettlementProfile['caches'] = {
    addAuthors: (...args) => told.push(`authors ${args.join(' ')}`),
    addKeywords: (...args) => told.push(`keywords ${args.join(' ')}`),
    fetchAuthors: (...args) => told.push(`fetch authors ${args.join(' ')}`.trim()),
    fetchKeywords: (...args) => told.push(`fetch keywords ${args.join(' ')}`.trim()),
  }
  const profile: UploadSettlementProfile = {
    ...made.profile,
    readers: {
      asset: (assetId, options) => serverOf(options?.queueKey).readers.asset(assetId, options),
      assets: (licenceId, assetIds, options) =>
        serverOf(options?.queueKey).readers.assets(licenceId, assetIds, options),
      duplicateOriginAsset: (fileId, options) =>
        serverOf(options?.queueKey).readers.duplicateOriginAsset(fileId, options),
    },
    caches,
    ...(withConfigOf ? { configOf } : {}),
  }
  settlement = createUploadSettlement(profile)
  const ofDefault = made.add(OF_DEFAULT, queueRow({ fileId: null }))
  const ofOwn = made.add(OF_OWN, queueRow({ fileId: null }))
  return { ofDefault, ofOwn, told, queues: made.queues }
}

describe('the settlement of rows of one asset id in the queues of two DAM configurations', () => {
  it('reads the asset once for each configuration an event names, by a queue of it, into its rows alone', async () => {
    const { ofDefault, ofOwn } = twoQueues()
    bothProcessed()

    const told = [
      settlement.notify({ kind: 'copied', assetId: 'asset-1', fileId: null, configNames: ['own'] }),
      settlement.notify({ kind: 'copied', assetId: 'asset-1', fileId: null, configNames: ['default'] }),
    ]
    await clock.advance(1 * S)
    await Promise.all(told)

    expect(servers.own.queuesOf('asset')).toEqual([OF_OWN])
    expect(servers.default.queuesOf('asset')).toEqual([OF_DEFAULT])
    expect(ofOwn).toMatchObject({ status: Uploaded, fileId: 'file-own', keywords: ['keyword-own'] })
    expect(ofDefault).toMatchObject({ status: Uploaded, fileId: 'file-default', keywords: ['keyword-default'] })
  })

  it('reads the asset of an event that names both configurations once for each', async () => {
    const { ofDefault, ofOwn } = twoQueues()
    bothProcessed()

    const told = settlement.notify({
      kind: 'copied',
      assetId: 'asset-1',
      fileId: null,
      configNames: ['default', 'own'],
    })
    await clock.advance(1 * S)
    await told

    expect(servers.own.queuesOf('asset')).toEqual([OF_OWN])
    expect(servers.default.queuesOf('asset')).toEqual([OF_DEFAULT])
    expect(ofOwn.fileId).toBe('file-own')
    expect(ofDefault.fileId).toBe('file-default')
  })

  it('settles by a refresh that names a configuration only its rows, read by a queue of it', async () => {
    const { ofDefault, ofOwn } = twoQueues()
    bothProcessed()

    const outcome = await settlement.refreshAsset({ assetId: 'asset-1', fileId: null, configNames: ['own'] })

    expect(outcome).toBe('settled')
    expect(servers.own.queuesOf('asset')).toEqual([OF_OWN])
    expect(servers.default.queuesOf('asset')).toEqual([])
    expect(ofOwn).toMatchObject({ status: Uploaded, fileId: 'file-own' })
    expect(ofDefault).toMatchObject({ status: Processing, fileId: null })
  })

  it('makes by a known duplicate that names a configuration only its rows the original, read by a queue of it', async () => {
    const { ofDefault, ofOwn } = twoQueues()
    servers.default.originAssets.set('original-file', damAsset('original-default', damFile('original-file')))

    await settlement.settleKnownDuplicate(
      { assetId: 'asset-1', fileId: null, configNames: ['default'] },
      'original-file',
      DamAssetType.Image
    )

    expect(servers.default.queuesOf('originAsset')).toEqual([OF_DEFAULT])
    expect(ofDefault).toMatchObject({ status: Uploaded, isDuplicate: true, assetId: 'original-default' })
    expect(ofOwn).toMatchObject({ status: Processing, isDuplicate: false, assetId: 'asset-1' })
  })

  it('fails by a known failure that names a configuration only its rows', () => {
    const { ofDefault, ofOwn } = twoQueues()

    settlement.settleKnownFailed(
      { assetId: 'asset-1', fileId: null, configNames: ['default'] },
      AssetFileFailReason.Unknown
    )

    expect([ofDefault.status, ofOwn.status]).toEqual([Failed, Processing])
  })

  it('asks no DAM for a refresh or a known processed file that names a configuration with no row of the asset', async () => {
    const { ofDefault, queues } = twoQueues()
    bothProcessed()
    queues.get(OF_OWN)!.items.splice(0)

    const outcome = await settlement.refreshAsset({ assetId: 'asset-1', fileId: null, configNames: ['own'] })
    await settlement.settleKnownProcessed(
      { assetId: 'asset-1', fileId: null, configNames: ['own'] },
      { withMetadata: true }
    )

    expect(outcome).toBe('settled')
    expect(servers.own.queuesOf('asset')).toEqual([])
    expect(servers.default.queuesOf('asset')).toEqual([])
    expect(ofDefault.status).toBe(Processing)
  })

  it('reads a refresh that names both configurations once for each, by a queue of it, into its rows alone', async () => {
    const { ofDefault, ofOwn } = twoQueues()
    bothProcessed()

    const outcome = await settlement.refreshAsset({
      assetId: 'asset-1',
      fileId: null,
      configNames: ['default', 'own'],
    })

    expect(outcome).toBe('settled')
    expect(servers.own.queuesOf('asset')).toEqual([OF_OWN])
    expect(servers.default.queuesOf('asset')).toEqual([OF_DEFAULT])
    expect(ofOwn).toMatchObject({ status: Uploaded, fileId: 'file-own', keywords: ['keyword-own'] })
    expect(ofDefault).toMatchObject({ status: Uploaded, fileId: 'file-default', keywords: ['keyword-default'] })
  })

  it('tells of a refresh of both configurations that failed for one of them that it failed', async () => {
    const { ofDefault, ofOwn } = twoQueues()
    bothProcessed()
    servers.own.fail('asset')

    const outcome = await settlement.refreshAsset({
      assetId: 'asset-1',
      fileId: null,
      configNames: ['default', 'own'],
    })

    expect(outcome).toBe('error')
    expect(ofOwn.status).toBe(Processing)
    expect(ofDefault).toMatchObject({ status: Uploaded, fileId: 'file-default' })
  })

  it('reads the original of a known duplicate that names both configurations once for each, into its rows alone', async () => {
    const { ofDefault, ofOwn } = twoQueues()
    servers.default.originAssets.set('original-file', damAsset('original-default', damFile('original-file')))
    servers.own.originAssets.set('original-file', damAsset('original-own', damFile('original-file')))

    await settlement.settleKnownDuplicate(
      { assetId: 'asset-1', fileId: null, configNames: ['default', 'own'] },
      'original-file',
      DamAssetType.Image
    )

    expect(servers.default.queuesOf('originAsset')).toEqual([OF_DEFAULT])
    expect(servers.own.queuesOf('originAsset')).toEqual([OF_OWN])
    expect(ofDefault).toMatchObject({ isDuplicate: true, assetId: 'original-default' })
    expect(ofOwn).toMatchObject({ isDuplicate: true, assetId: 'original-own' })
  })

  it('hands the names of a row to the caches with its queue, and has those of each queue fetched', async () => {
    const { told } = twoQueues()
    bothProcessed()

    await settlement.refreshAsset({ assetId: 'asset-1', fileId: null, configNames: ['own'] })

    expect(told).toEqual([
      `keywords keyword-own ${OF_OWN}`,
      `authors author-own ${OF_OWN}`,
      `authors  ${OF_OWN}`,
      `fetch authors ${OF_OWN}`,
      `fetch keywords ${OF_OWN}`,
    ])
  })

  it('hands the names of a row that became the original of its duplicate to the caches with its queue', async () => {
    const { told } = twoQueues()
    servers.own.originAssets.set(
      'original-file',
      damAsset('original-own', damFile('original-file'), {
        keywords: ['keyword-original'],
        authors: [],
        metadata: { customData: {}, authorSuggestions: {}, keywordSuggestions: {} },
      })
    )

    await settlement.settleKnownDuplicate(
      { assetId: 'asset-1', fileId: null, configNames: ['own'] },
      'original-file',
      DamAssetType.Image
    )

    expect(told).toEqual([
      `keywords keyword-original ${OF_OWN}`,
      `authors  ${OF_OWN}`,
      `authors  ${OF_OWN}`,
      `fetch authors ${OF_OWN}`,
      `fetch keywords ${OF_OWN}`,
    ])
  })
})

describe('the settlement of a store that does not say the configurations of its queues', () => {
  it('settles the rows of one asset id in two queues from one read, and tells its caches no queue', async () => {
    const { ofDefault, ofOwn, told } = twoQueues(false)
    bothProcessed()

    const notified = settlement.notify({ kind: 'copied', assetId: 'asset-1', fileId: null, configNames: ['own'] })
    await clock.advance(1 * S)
    await notified

    expect(servers.default.queuesOf('asset')).toEqual([OF_DEFAULT])
    expect(servers.own.queuesOf('asset')).toEqual([])
    expect(ofDefault).toMatchObject({ status: Uploaded, fileId: 'file-default' })
    expect(ofOwn).toMatchObject({ status: Uploaded, fileId: 'file-default' })
    expect(told).toEqual([
      'keywords keyword-default',
      'authors author-default',
      'authors ',
      'keywords keyword-default',
      'authors author-default',
      'authors ',
      'fetch authors',
      'fetch keywords',
    ])
  })

  it('fails the rows of one asset id in two queues by a failure that names a configuration', () => {
    const { ofDefault, ofOwn } = twoQueues(false)

    settlement.settleKnownFailed(
      { assetId: 'asset-1', fileId: null, configNames: ['own'] },
      AssetFileFailReason.Unknown
    )

    expect([ofDefault.status, ofOwn.status]).toEqual([Failed, Failed])
  })
})
