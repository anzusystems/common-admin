import { reactive } from 'vue'
import type { DocId, DocIdNullable, IntegerId } from '@/shared/types/common'
import { type AssetDetailItemDto, DamAssetStatus, DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import {
  type AssetFile,
  AssetFileFailReason,
  type AssetFileFailReasonType,
  type AssetFileLink,
  AssetFileLinkType,
  type AssetFileNullable,
  type AssetFileProcessStatusType,
} from '@/domains/dam/types/AssetFile'
import {
  type UploadQueue,
  type UploadQueueItem,
  UploadQueueItemStatus,
  UploadQueueItemType,
  type UploadQueueKey,
} from '@/domains/dam/types/UploadQueue'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import {
  type UploadReadOptions,
  UploadRowRole,
  type UploadRowRoleType,
  type UploadSettlementProfile,
  type UploadSettlementTarget,
  type UploadSettlePolicy,
} from '@/domains/dam/uploadQueue/settlement/uploadSettlementTypes'
import { isNull } from '@/shared/utils/common'

// Nothing of the library is replaced. The settlement gets a
// profile that holds everything it reaches the outside through.
// Here are the two store profiles, over a server that records what it was asked.

let rowSequence = 0

export const queueRow = (overrides: Partial<UploadQueueItem> = {}): UploadQueueItem => ({
  ...useUploadQueueItemFactory().createDefault(
    'row_' + ++rowSequence,
    UploadQueueItemType.File,
    UploadQueueItemStatus.Processing,
    DamAssetType.Image,
    1024,
    1
  ),
  assetId: 'asset-1',
  fileId: 'file-1',
  ...overrides,
})

export const emptyQueue = (): UploadQueue => ({
  items: [],
  totalCount: 0,
  processedCount: 0,
  fileInputKey: 0,
  suggestions: { newKeywordNames: new Set<string>(), newAuthorNames: new Set<string>() },
})

export const previewOf = (fileId: DocId): AssetFileLink => ({
  width: 800,
  height: 600,
  requestedWidth: 800,
  requestedHeight: 600,
  url: 'https://image.test/' + fileId + '/detail.jpg',
  title: '',
  type: AssetFileLinkType.Image,
})

/** Without a status the file has no `fileAttributes` at all, as in some store fixtures. */
export const damFile = (
  id: DocId,
  status?: AssetFileProcessStatusType,
  overrides: {
    failReason?: AssetFileFailReasonType
    originAssetFile?: DocIdNullable
    asset?: DocId
    singleUse?: boolean
  } = {}
) =>
  ({
    id,
    asset: overrides.asset ?? 'asset-1',
    ...(status ? { fileAttributes: { status, failReason: overrides.failReason ?? AssetFileFailReason.None } } : {}),
    originAssetFile: overrides.originAssetFile ?? null,
    links: { image_detail: previewOf(id) },
    flags: { public: true, singleUse: overrides.singleUse ?? false, overrideInternal: false, internal: false },
    _resourceName: 'imageFile',
  }) as unknown as AssetFile

const nobody = {} as unknown as string[]
export const serverMetadata = {
  keywords: ['keyword-1'],
  authors: ['author-1'],
  metadata: {
    customData: { title: 'from the server', description: 'described' },
    authorSuggestions: { 'New Author': nobody, 'Ambiguous Author': ['author-2', 'author-3'] },
    keywordSuggestions: { 'new keyword': nobody },
  },
  mainFileSingleUse: true,
  mainFileInternal: true,
}
export const loadedMetadata = {
  keywords: ['keyword-1'],
  authors: ['author-1'],
  customData: { title: 'from the server', description: 'described' },
  authorConflicts: ['author-2', 'author-3'],
  mainFileSingleUse: true,
  mainFileInternal: true,
  canEditMetadata: true,
}
export const noMetadata = { keywords: [], authors: [], customData: {}, authorConflicts: [], canEditMetadata: false }

export const damAsset = (
  id: DocId,
  mainFile: AssetFile | null,
  overrides: Partial<AssetDetailItemDto> = {}
): AssetDetailItemDto =>
  ({
    id,
    licence: 1,
    attributes: {
      assetType: DamAssetType.Image,
      assetStatus: mainFile ? DamAssetStatus.WithFile : DamAssetStatus.Draft,
    },
    mainFile,
    ...structuredClone(serverMetadata),
    ...overrides,
  }) as unknown as AssetDetailItemDto

type RequestKind = 'asset' | 'assets' | 'slots' | 'originAsset' | 'originFile'

export function fakeDamServer() {
  const assets = new Map<DocId, AssetDetailItemDto>()
  const slots = new Map<DocId, AssetFileNullable[]>()
  const originAssets = new Map<DocId, AssetDetailItemDto>()
  const originFiles = new Map<DocId, AssetFile>()
  const failing = new Set<RequestKind>()
  const failingLicences = new Set<IntegerId>()
  const failingAssets = new Set<DocId>()
  const requests: Array<{ kind: RequestKind; ids: DocId[]; licenceId?: IntegerId }> = []
  const told: Array<{
    kind: RequestKind
    ids: DocId[]
    report: boolean | undefined
    queueKey: UploadQueueKey | undefined
  }> = []
  const waiting: Array<() => void> = []
  let held = false
  let running = 0
  let mostRunning = 0
  const garbledLicences = new Set<IntegerId>()

  const answer = async <T>(
    kind: RequestKind,
    ids: DocId[],
    licenceId: IntegerId | undefined,
    compute: () => T,
    options?: Partial<UploadReadOptions>
  ) => {
    requests.push(licenceId === undefined ? { kind, ids } : { kind, ids, licenceId })
    told.push({ kind, ids, report: options?.report, queueKey: options?.queueKey })
    mostRunning = Math.max(mostRunning, ++running)
    try {
      const fails =
        failing.has(kind) ||
        (licenceId !== undefined && failingLicences.has(licenceId)) ||
        ids.some((id) => failingAssets.has(id))
      const value = fails ? undefined : compute()
      if (held) await new Promise<void>((resolve) => waiting.push(resolve))
      if (fails) throw new Error('fakeDamServer: the ' + kind + ' request fails')
      return value as T
    } finally {
      running--
    }
  }

  const readers = {
    asset: (assetId: DocId, options?: UploadReadOptions) =>
      answer(
        'asset',
        [assetId],
        undefined,
        () => {
          const asset = assets.get(assetId)
          return asset ? structuredClone(asset) : null
        },
        options
      ),
    assets: (licenceId: IntegerId, assetIds: DocId[], options?: UploadReadOptions) =>
      answer(
        'assets',
        assetIds,
        licenceId,
        () => {
          if (garbledLicences.has(licenceId)) return { totalCount: 0 } as unknown as AssetDetailItemDto[]
          return assetIds.flatMap((assetId) => {
            const asset = assets.get(assetId)
            return asset && asset.licence === licenceId ? [structuredClone(asset)] : []
          })
        },
        options
      ),
    slotFiles: (assetId: DocId, options?: UploadReadOptions) =>
      answer('slots', [assetId], undefined, () => structuredClone(slots.get(assetId) ?? []), options),
    duplicateOriginAsset: (originFileId: DocId, options?: Pick<UploadReadOptions, 'queueKey'>) =>
      answer(
        'originAsset',
        [originFileId],
        undefined,
        () => {
          const origin = originAssets.get(originFileId)
          if (!origin) throw new Error('fakeDamServer: no asset of the file ' + originFileId)
          return structuredClone(origin)
        },
        options
      ),
    duplicateOriginFile: (originFileId: DocId, _assetType: DamAssetTypeType) =>
      answer('originFile', [originFileId], undefined, () => {
        const origin = originFiles.get(originFileId)
        return origin ? structuredClone(origin) : null
      }),
  }

  return {
    assets,
    slots,
    originAssets,
    originFiles,
    requests,
    readers,
    fileBecomes: (
      assetId: DocId,
      status: AssetFileProcessStatusType,
      file: Parameters<typeof damFile>[2] = {},
      overrides: Partial<AssetDetailItemDto> = {}
    ) => {
      const known = assets.get(assetId)
      const fileId = known?.mainFile?.id ?? assetId.replace('asset', 'file')
      assets.set(
        assetId,
        damAsset(assetId, damFile(fileId, status, { asset: assetId, ...file }), {
          ...(known ? { licence: known.licence } : {}),
          ...overrides,
        })
      )
    },
    fail: (...kinds: RequestKind[]) => kinds.forEach((kind) => failing.add(kind)),
    recover: () => {
      failing.clear()
      failingLicences.clear()
      failingAssets.clear()
      garbledLicences.clear()
    },
    failLicence: (licenceId: IntegerId) => failingLicences.add(licenceId),
    failAsset: (assetId: DocId) => failingAssets.add(assetId),
    letReport: (only?: RequestKind | { asset: DocId }) =>
      told
        .filter((one) => one.kind === 'asset' || one.kind === 'assets' || one.kind === 'slots')
        .filter((one) => {
          if (only === undefined) return true
          return typeof only === 'string' ? one.kind === only : one.ids.includes(only.asset)
        })
        .map((one) => one.report),
    queuesOf: (kind: RequestKind) => told.filter((one) => one.kind === kind).map((one) => one.queueKey),
    garbleList: (licenceId: IntegerId) => garbledLicences.add(licenceId),
    hold: () => (held = true),
    release: () => {
      held = false
      waiting.splice(0).forEach((resolve) => resolve())
    },
    mostRunning: () => mostRunning,
    asked: (kind: RequestKind) => requests.filter((request) => request.kind === kind),
  }
}

export type FakeDamServer = ReturnType<typeof fakeDamServer>

export function fakeConnection(alive = false) {
  const listeners = new Set<() => void>()
  let state = alive
  return {
    isPushAlive: () => state,
    onChange: (callback: () => void) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    set: (next: boolean) => {
      if (state === next) return
      state = next
      listeners.forEach((callback) => callback())
    },
    listeners: () => listeners.size,
  }
}

export function fakeVisibility() {
  const listeners = new Set<() => void>()
  let visible = true
  return {
    isVisible: () => visible,
    onChange: (callback: () => void) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    set: (next: boolean) => {
      visible = next
      listeners.forEach((callback) => callback())
    },
    listeners: () => listeners.size,
  }
}

const recorder = () => {
  const calls = {
    final: [] as string[],
    // What the store was told of a refresh: the row key, with `+` when a refresh may help and `-` when not.
    refreshMayHelp: [] as string[],
    processedSeen: [] as string[],
    metadataLoaded: [] as string[],
    assetsRead: [] as DocId[],
    authorsAdded: [] as DocId[],
    keywordsAdded: [] as DocId[],
    authorsFetched: 0,
    keywordsFetched: 0,
  }
  const caches: UploadSettlementProfile['caches'] = {
    addAuthors: (ids) => calls.authorsAdded.push(...ids),
    addKeywords: (ids) => calls.keywordsAdded.push(...ids),
    fetchAuthors: () => calls.authorsFetched++,
    fetchKeywords: () => calls.keywordsFetched++,
  }
  const hooks: Required<UploadSettlementProfile['hooks']> = {
    onRowFinal: (_queueKey, row) => calls.final.push(row.key),
    onAssetRead: (asset) => calls.assetsRead.push(asset.id),
    onProcessedSeen: (_queueKey, row) => calls.processedSeen.push(row.key),
    afterMetadataLoaded: (_queueKey, row) => calls.metadataLoaded.push(row.key),
    onRefreshMayHelp: (_queueKey, row, mayHelp) => calls.refreshMayHelp.push((mayHelp ? '+' : '-') + row.key),
  }
  return { calls, caches, hooks }
}

export const TEXT = {
  tooLong: 'processing takes too long',
  tooLongSlot: 'processing of the slot takes too long',
  readFailed: 'data could not be loaded',
  missing: 'unknown error',
}

export function libProfile(server: FakeDamServer) {
  const queues = reactive(new Map<UploadQueueKey, UploadQueue>())
  const connection = fakeConnection()
  const { calls, caches, hooks } = recorder()
  const profile: UploadSettlementProfile = {
    queues: () => queues.entries(),
    roleOf: (row) => (row.type === UploadQueueItemType.Asset ? UploadRowRole.Copy : UploadRowRole.Upload),
    policyFor: () => ({ reader: 'asset', settleOn: 'read', duplicate: 'becomeOriginal', metadata: 'load' }),
    matches: (row, target) => row.assetId === target.assetId,
    readers: {
      asset: server.readers.asset,
      assets: server.readers.assets,
      duplicateOriginAsset: server.readers.duplicateOriginAsset,
    },
    caches,
    messages: {
      processingTooLong: () => TEXT.tooLong,
      readFailed: () => TEXT.readFailed,
      assetMissing: () => TEXT.missing,
    },
    hooks: {
      onRowFinal: hooks.onRowFinal,
      afterMetadataLoaded: hooks.afterMetadataLoaded,
      onAssetRead: hooks.onAssetRead,
      onRefreshMayHelp: hooks.onRefreshMayHelp,
    },
    connection,
  }
  const add = (queueKey: UploadQueueKey, row: UploadQueueItem) => {
    if (!queues.has(queueKey)) queues.set(queueKey, emptyQueue())
    const items = queues.get(queueKey)!.items
    items.push(row)
    return items[items.length - 1]
  }
  return { profile, queues, connection, calls, add }
}

const DAM_POLICIES: Record<UploadRowRoleType, UploadSettlePolicy> = {
  [UploadRowRole.Upload]: { reader: 'asset', settleOn: 'event', duplicate: 'markDuplicate', metadata: 'load' },
  [UploadRowRole.ExternalImport]: { reader: 'asset', settleOn: 'event', duplicate: 'markDuplicate', metadata: 'load' },
  [UploadRowRole.Slot]: { reader: 'slots', settleOn: 'event', duplicate: 'markDuplicate', metadata: 'none' },
  [UploadRowRole.MassEdit]: { reader: 'none', settleOn: 'never', duplicate: 'markDuplicate', metadata: 'load' },
  [UploadRowRole.Copy]: { reader: 'asset', settleOn: 'read', duplicate: 'becomeOriginal', metadata: 'load' },
}

const damNotificationMatches = (
  row: UploadQueueItem,
  assetId: DocId,
  fileId: DocIdNullable,
  matchAssetWithoutFile: boolean
) => {
  if (row.assetId !== assetId) return false
  if (row.status === UploadQueueItemStatus.Loading) return false
  if (row.type === UploadQueueItemType.SlotFile) return !isNull(fileId) && row.fileId === fileId
  if (row.type === UploadQueueItemType.Asset && isNull(row.fileId)) return matchAssetWithoutFile

  return isNull(fileId) || row.fileId === fileId
}

export function damProfile(server: FakeDamServer) {
  const queues = reactive<Record<UploadQueueKey, UploadQueue>>({})
  const connection = fakeConnection()
  const { calls, caches, hooks } = recorder()
  const gateOpen = new Set<string>()
  const profile: UploadSettlementProfile = {
    queues: () => Object.entries(queues),
    roleOf: (row) => {
      if (row.type === UploadQueueItemType.SlotFile) return UploadRowRole.Slot
      if (row.type === UploadQueueItemType.Asset) return UploadRowRole.MassEdit
      if (row.type === UploadQueueItemType.ExternalProviderAsset) return UploadRowRole.ExternalImport
      return UploadRowRole.Upload
    },
    policyFor: (role) => DAM_POLICIES[role],
    matches: (row: UploadQueueItem, target: UploadSettlementTarget, purpose) =>
      purpose === 'metadata'
        ? row.assetId === target.assetId
        : damNotificationMatches(row, target.assetId, target.fileId, purpose === 'decorate'),
    readers: {
      asset: server.readers.asset,
      assets: server.readers.assets,
      slotFiles: server.readers.slotFiles,
      duplicateOriginFile: server.readers.duplicateOriginFile,
    },
    caches,
    messages: {
      processingTooLong: (row) => (row.type === UploadQueueItemType.SlotFile ? TEXT.tooLongSlot : TEXT.tooLong),
      readFailed: () => TEXT.readFailed,
      assetMissing: () => TEXT.missing,
    },
    metadataGate: (_queueKey, row) => (gateOpen.has(row.key) ? 'load' : undefined),
    hooks,
    connection,
  }
  const add = (queueKey: UploadQueueKey, row: UploadQueueItem) => {
    if (!(queueKey in queues)) queues[queueKey] = emptyQueue()
    const items = queues[queueKey]!.items
    items.push(row)
    return items[items.length - 1]
  }
  return { profile, queues, connection, calls, gateOpen, add }
}

export const settledState = (row: UploadQueueItem) => ({
  status: row.status,
  isDuplicate: row.isDuplicate,
  assetId: row.assetId,
  fileId: row.fileId,
  duplicateAssetId: row.duplicateAssetId,
  uploadedAssetId: row.uploadedAssetId,
  assetStatus: row.assetStatus,
  imagePreview: row.imagePreview,
  canEditMetadata: row.canEditMetadata,
  keywords: [...row.keywords],
  authors: [...row.authors],
  customData: { ...row.customData },
  authorConflicts: [...row.authorConflicts],
  mainFileSingleUse: row.mainFileSingleUse,
  mainFileInternal: row.mainFileInternal,
  error: { ...row.error },
})
