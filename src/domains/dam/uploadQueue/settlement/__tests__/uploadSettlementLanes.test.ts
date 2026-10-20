import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
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

// The reads of a store with queues of two DAM configurations, `default` and `own`, two DAMs: each configuration reads
// in a lane of its own, so a DAM that is slow to answer holds back no read of the other, and the failures of each are
// a streak of their own, reported as such. A store that does not say the configurations of its queues reads in one
// lane, as before. The poll of a queue asks whether notifications come for that queue.

const S = 1000
const OF_DEFAULT = 'lane-of-default'
const OF_OWN = 'lane-of-own'
const { Processing, Uploaded } = UploadQueueItemStatus

const realRuntime = { ...uploadSettlementRuntime }
let clock: ManualScheduler
let servers: Record<'default' | 'own', FakeDamServer>
let settlement: UploadSettlement

beforeEach(() => {
  clock = manualScheduler()
  uploadSettlementRuntime.scheduler = clock
  uploadSettlementRuntime.visibility = fakeVisibility()
  servers = { default: fakeDamServer(), own: fakeDamServer() }
  for (const name of ['default', 'own'] as const) {
    servers[name].assets.set('asset-1', damAsset('asset-1', damFile(`file-${name}`, AssetFileProcessStatus.Processed)))
  }
})

afterEach(() => {
  settlement?.dispose()
  uploadSettlementRuntime.scheduler = realRuntime.scheduler
  uploadSettlementRuntime.visibility = realRuntime.visibility
})

const configOf = (queueKey: UploadQueueKey) => (queueKey === OF_OWN ? 'own' : 'default')

/**
 * The library's profile, its readers asking the DAM of the queue they are given; with `configOf`, or without it as
 * admin-dam's. A copy row of `asset-1` in each queue. `pushAsked`: the queues the poll asked about notifications for.
 */
const twoQueues = (withConfigOf = true) => {
  const made = libProfile(servers.default)
  const serverOf = (queueKey?: UploadQueueKey) => servers[queueKey === undefined ? 'default' : configOf(queueKey)]
  const pushAsked: Array<UploadQueueKey | undefined> = []
  const profile: UploadSettlementProfile = {
    ...made.profile,
    readers: {
      asset: (assetId, options) => serverOf(options?.queueKey).readers.asset(assetId, options),
      assets: (licenceId, assetIds, options) =>
        serverOf(options?.queueKey).readers.assets(licenceId, assetIds, options),
    },
    connection: {
      isPushAlive: (queueKey) => {
        pushAsked.push(queueKey)
        return false
      },
      onChange: () => () => undefined,
    },
    ...(withConfigOf ? { configOf } : {}),
  }
  settlement = createUploadSettlement(profile)
  const ofDefault = made.add(OF_DEFAULT, queueRow({ fileId: null }))
  const ofOwn = made.add(OF_OWN, queueRow({ fileId: null }))
  return { ofDefault, ofOwn, pushAsked, add: made.add }
}

describe('the reads of two DAM configurations', () => {
  it('do not wait for one another: a refresh of default is answered while that of own is on its way', async () => {
    const { ofDefault, ofOwn } = twoQueues()
    servers.own.hold()

    const ofOwnRead = settlement.refreshAsset({ assetId: 'asset-1', fileId: null, configNames: ['own'] })
    let defaultOutcome: string | undefined
    void settlement
      .refreshAsset({ assetId: 'asset-1', fileId: null, configNames: ['default'] })
      .then((outcome) => (defaultOutcome = outcome))
    await clock.settle()

    expect(defaultOutcome).toBe('settled')
    expect(ofDefault.status).toBe(Uploaded)
    expect(ofOwn.status).toBe(Processing)
    servers.own.release()
    await expect(ofOwnRead).resolves.toBe('settled')
    expect(ofOwn.status).toBe(Uploaded)
  })

  it('have the first failure of each DAM reported, also while that of the other is', async () => {
    const { ofDefault, ofOwn } = twoQueues()
    settlement.track(OF_DEFAULT, ofDefault)
    settlement.track(OF_OWN, ofOwn)
    servers.default.fail('asset')
    servers.own.fail('asset')

    await clock.advance(5 * S)

    expect(servers.default.letReport()).toEqual([true])
    expect(servers.own.letReport()).toEqual([true])
  })

  it('end the streak of a DAM when its last queue is dropped, while another still polls', async () => {
    const { ofDefault, ofOwn, add } = twoQueues()
    servers.default.fileBecomes('asset-1', AssetFileProcessStatus.Uploading)
    settlement.track(OF_DEFAULT, ofDefault)
    settlement.track(OF_OWN, ofOwn)
    servers.own.fail('asset')
    await clock.advance(5 * S)
    expect(servers.own.letReport()).toEqual([true])

    settlement.dropQueue(OF_OWN)
    const again = add(OF_OWN, queueRow({ fileId: null, key: 'again' }))
    settlement.track(OF_OWN, again)
    await clock.advance(5 * S)

    expect(servers.own.letReport()).toEqual([true, true])
  })

  it('are asked by the poll of a queue whether notifications come for that queue', async () => {
    const { ofDefault, ofOwn, pushAsked } = twoQueues()
    settlement.track(OF_DEFAULT, ofDefault)
    settlement.track(OF_OWN, ofOwn)

    await clock.advance(5 * S)

    expect(pushAsked.length).toBeGreaterThan(0)
    expect(new Set(pushAsked)).toEqual(new Set([OF_DEFAULT, OF_OWN]))
  })
})

describe('the reads of a store that does not say the configurations of its queues', () => {
  it('go one after another, as before: a refresh waits for the one on its way', async () => {
    twoQueues(false)
    servers.default.hold()

    const first = settlement.refreshAsset({ assetId: 'asset-1', fileId: null, configNames: ['own'] })
    let secondOutcome: string | undefined
    void settlement
      .refreshAsset({ assetId: 'asset-1', fileId: null, configNames: ['default'] })
      .then((outcome) => (secondOutcome = outcome))
    await clock.settle()

    expect(secondOutcome).toBeUndefined()
    servers.default.release()
    await first
    await clock.settle()
    expect(secondOutcome).toBe('settled')
  })

  it('have only the first failure of a streak reported, whichever queue it is of', async () => {
    const { ofDefault, ofOwn } = twoQueues(false)
    settlement.track(OF_DEFAULT, ofDefault)
    settlement.track(OF_OWN, ofOwn)
    servers.default.fail('asset')
    servers.own.fail('asset')

    await clock.advance(5 * S)

    expect(servers.default.letReport()).toEqual([true])
    expect(servers.own.letReport()).toEqual([false])
  })
})
