import axios, { type AxiosError, type AxiosInstance } from 'axios'
import type { DocId, IntegerId } from '@/shared/types/common'
import type { AssetDetailItemDto, AssetSearchListItemDto, DamAssetTypeType } from '@/domains/dam/types/Asset'
import { type UploadQueueItem, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { HTTP_STATUS_OK } from '@/shared/statusCodes'
import { cloneDeep, isNull, isUndefined } from '@/shared/utils/common'
import {
  customDataOf,
  type DamMetadataOnServer,
  metadataOfAsset,
  metadataOnServer,
  rebaseCustomData,
  sameMetadataValue,
  setMetadataOnServer,
} from '@/domains/dam/api/damMetadataOnServer'
import {
  AnzuApiValidationError,
  type AnzuApiValidationResponseData,
  isAnzuApiValidationError,
  type ValidationError,
} from '@/shared/error/AnzuApiValidationError'
import { useAlerts } from '@/domains/system/composables/alerts'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import { DAM_END_POINT_CMS_ASSET } from '@/domains/dam/api/damEndPoints'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiCommand, useApiRequest } from '@/domains/api/composables/useApiRequest'
import { useApiFetchItems } from '@/domains/api/composables/useApiFetchItems'
import type { DamMediaFromDam } from '@/domains/dam/types/MediaAware'
import { commonT } from '@/plugins/i18n'
import { customDataFormElementName } from '@/domains/customDataForm/utils/customDataFormElementName'
import { isDamSourceEnabled } from '@/domains/dam/author/composables/damSourceConfig'

const BULK_METADATA_LIMIT = 10
export const ENTITY = 'asset'
const FETCH_BY_IDS_MAX_LIMIT = 50

export interface AssetMetadataBulkItem {
  id: DocId
  keywords: DocId[]
  authors: DocId[]
  sources?: DocId[]
  described: boolean
  customData: AssetCustomData
  // Left out for a copy, which keeps the flag of the asset it was copied from.
  mainFileSingleUse?: boolean | null
  mainFileInternal: boolean | null
  mainFileOverrideInternal: boolean | null
}

// What a save sends. Whether the main file is internal is set in the DAM itself.
// A save from here leaves those two fields unchanged and reads them from the answer.
// A field left out is one the save does not change: the DAM keeps it as it is.
type AssetMetadataBulkItemBody = Pick<AssetMetadataBulkItem, 'id' | 'described'> &
  Partial<Pick<AssetMetadataBulkItem, 'keywords' | 'authors' | 'sources' | 'customData' | 'mainFileSingleUse'>>

export declare type AssetCustomData = Record<string, any>

export const useFetchAssetList = (client: () => AxiosInstance, endPoint: string, licenceId: IntegerId) =>
  useApiFetchList<AssetSearchListItemDto>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint + '/licence/:licenceId',
    urlParams: { licenceId },
  })

/**
 * Assets of several licences in one search, the licences in the filter `licences`. DAM requires them to share an ext
 * system (LicenceCollectionSingleExtSystem). Not every endpoint has it: the UGC proxy of core-dam lists only one licence.
 */
export const useFetchAssetListByLicences = (client: () => AxiosInstance, endPoint: string) =>
  useApiFetchList<AssetSearchListItemDto>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    // No '/search' here: useApiFetchList appends it for an elastic filter config.
    urlTemplate: endPoint + '/licence',
  })

/**
 * `options.report: false` keeps a failure of this read out of the api error logger.
 * Used by the upload queue, which polls the same asset repeatedly and reports only the first failure of a streak.
 */
export const fetchAsset = (
  client: () => AxiosInstance,
  endPoint: string,
  id: DocId,
  options: { report?: boolean } = {}
) => {
  const { execute } = useApiRequest<AssetDetailItemDto, null>({
    client,
    method: 'GET',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint + '/:id',
  })

  return execute({ urlParams: { id }, report: options.report })
}

/** `endPoint`: as configured (`endPointCmsAsset`). Defaults to `/adm/v1/cms/asset`. */
export const fetchAssetAsCmsMedia = <T extends DamMediaFromDam>(
  client: () => AxiosInstance,
  id: DocId,
  endPoint: string = DAM_END_POINT_CMS_ASSET
) => {
  const { execute } = useApiRequest<T, null>({
    client,
    method: 'GET',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint + '/:id',
  })

  return execute({ urlParams: { id } })
}

export const fetchAssetByFileId = (client: () => AxiosInstance, endPoint: string, assetFileId: DocId) => {
  const { execute } = useApiRequest<AssetDetailItemDto, null>({
    client,
    method: 'GET',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint + '/asset-file/:id',
  })

  return execute({ urlParams: { id: assetFileId } })
}

/**
 * Saves the metadata of the queue items. Sources are sent only where `extSystem` has them
 * for the item's asset type in DAM configuration `configName`.
 * Every item is sent, so the answer holds each asset. Of an item whose metadata the DAM sent before,
 * only the fields changed since go, and changed custom data rebased onto the assets read right before
 * (`damMetadataOnServer`). Ten items per request. A failed request stops the later ones.
 */
export const bulkUpdateAssetsMetadata = async (
  client: () => AxiosInstance,
  endPoint: string,
  items: UploadQueueItem[],
  mainFileSingleUseOverride: boolean | undefined,
  extSystem: IntegerId,
  configName: string
) => {
  const saves = listItemsToMetadataBulkItems(
    items.filter(hasMetadataToSave),
    mainFileSingleUseOverride,
    extSystem,
    configName
  )
  const { execute } = useMetadataBulkUpdate<AssetMetadataBulkItemBody>(client, endPoint)
  const answers: AssetMetadataBulkItem[] = []
  for (let offset = 0; offset < saves.length; offset += BULK_METADATA_LIMIT) {
    const batch = saves.slice(offset, offset + BULK_METADATA_LIMIT)
    await rebaseOntoFreshRead(client, endPoint, batch)
    const [answer] = await saveMetadataInBatches(
      execute,
      batch.map(({ body }) => body),
      batch.map(({ item }) => item.assetType)
    )
    // Onto what the row knows now, not when the save began: a save in the asset detail may have
    // written its read into the row meanwhile, and going back to the older state sent its values again.
    batch.forEach(({ item, body, typed }) =>
      setMetadataOnServer(item, metadataAfterSave(metadataOnServer(item) ?? typed, typed, body))
    )
    answers.push(...(answer ?? []))
  }

  return answers
}

async function fetchAssetListByIdsSequence(
  client: () => AxiosInstance,
  endPoint: string,
  ids: DocId[],
  licenceId: number
) {
  if (ids.length === 0) return Promise.resolve([])
  const totalCalls = Math.ceil(ids.length / FETCH_BY_IDS_MAX_LIMIT)
  const responses = []

  for (let i = 0; i < totalCalls; i++) {
    const offset = i * FETCH_BY_IDS_MAX_LIMIT
    const reduced = ids.slice(offset, offset + FETCH_BY_IDS_MAX_LIMIT)
    const res = await client().get(endPoint + `/licence/${licenceId}/ids/${reduced.join(',')}`)
    responses.push(res)
  }
  return responses
}

export const fetchAssetListByIds: (
  client: () => AxiosInstance,
  endPoint: string,
  ids: DocId[],
  licenceId: number
) => Promise<AssetDetailItemDto[]> = (
  client: () => AxiosInstance,
  endPoint: string,
  ids: DocId[],
  licenceId: number
) => {
  return new Promise((resolve, reject) => {
    fetchAssetListByIdsSequence(client, endPoint, ids, licenceId)
      .then((responses) => {
        if (ids.length === 0) {
          return resolve([])
        } else if (responses.length === 0) {
          reject(responses)
        } else if (
          responses.every((res) => {
            return res.status === HTTP_STATUS_OK
          })
        ) {
          const final = []
          for (let i = 0; i < responses.length; i++) {
            const list = responses[i]!.data?.data
            // Reject instead of treating it as "none exist": the upload queue counts the assets missing from an answer.
            if (!Array.isArray(list)) return reject(responses)
            final.push(...list)
          }
          resolve(final as AssetDetailItemDto[])
        } else {
          reject(responses)
        }
      })
      .catch((err) => {
        //
        reject(err)
      })
  })
}

// Only a 200 is a save: any other answer is a save that failed, as before.
const metadataBulkUpdate = (client: () => AxiosInstance, endPoint: string) => ({
  client,
  method: 'PATCH' as const,
  system: SYSTEM_CORE_DAM,
  entity: ENTITY,
  urlTemplate: endPoint + '/metadata-bulk-update',
  options: { validateStatus: (status: number) => status === HTTP_STATUS_OK },
})

// For callers that build on the answer. It must be the list of saved assets.
const useMetadataBulkUpdate = <B>(client: () => AxiosInstance, endPoint: string) =>
  useApiFetchItems<AssetMetadataBulkItem, B[]>({ ...metadataBulkUpdate(client, endPoint), shape: 'array' })

// For a caller that reads nothing of the answer.
const useMetadataBulkCommand = <B>(client: () => AxiosInstance, endPoint: string) =>
  useApiCommand<B[]>(metadataBulkUpdate(client, endPoint))

/**
 * A metadata save refused by validation. `fields` are as the helpers build them.
 * `requestFields` keep the request keys, such as `[0].customData.title`.
 * The index is the asset's position in its batch, not a screen row.
 * `assetTypes` are the types of that batch's assets, in order. A custom field is named by the form of its asset's type.
 */
class AssetMetadataValidationError extends AnzuApiValidationError {
  requestFields: ValidationError[]
  assetTypes: Array<DamAssetTypeType | undefined>

  constructor(axiosError: AxiosError<AnzuApiValidationResponseData>, assetTypes: Array<DamAssetTypeType | undefined>) {
    super(axiosError, SYSTEM_CORE_DAM, ENTITY, axiosError)
    this.requestFields = Object.entries(axiosError.response!.data.fields).map(([field, errors]) => ({ field, errors }))
    this.assetTypes = assetTypes
  }
}

/**
 * Ten at a time, sequentially. The server saves a batch whole or not at all.
 * A failing batch stops the later ones, earlier ones stay saved, and saving again is safe.
 */
const saveMetadataInBatches = async <B, R>(
  execute: (params: { body: B[] }) => Promise<R>,
  bodies: B[],
  assetTypes: Array<DamAssetTypeType | undefined>
) => {
  const answers: R[] = []
  for (let offset = 0; offset < bodies.length; offset += BULK_METADATA_LIMIT) {
    try {
      answers.push(await execute({ body: bodies.slice(offset, offset + BULK_METADATA_LIMIT) }))
    } catch (error) {
      // The helper builds the validation error from the axios error and keeps it as the cause.
      if (isAnzuApiValidationError(error) && axios.isAxiosError(error.cause)) {
        throw new AssetMetadataValidationError(error.cause, assetTypes.slice(offset, offset + BULK_METADATA_LIMIT))
      }
      throw error
    }
  }

  return answers
}

/** Items the bulk save sends: those with an asset whose metadata the user may edit. */
export const hasMetadataToSave = (item: UploadQueueItem): item is UploadQueueItem & { assetId: DocId } =>
  !isNull(item.assetId) && item.canEditMetadata

/** Authors, and the sources where the ext system has them for the asset type. */
function creditFields(
  assetType: DamAssetTypeType,
  extSystem: IntegerId,
  authors: DocId[],
  sources: DocId[],
  configName: string
): Pick<AssetMetadataBulkItem, 'authors' | 'sources'> {
  return isDamSourceEnabled(assetType, extSystem, configName) ? { authors, sources } : { authors }
}

/**
 * The single use flag a row saves. A copy into the upload licence (a row of an asset) keeps the flag of the asset it
 * was copied from, so it sends none, also under a mass override; its switch is not offered.
 */
function singleUseField(
  item: UploadQueueItem,
  override: boolean | undefined
): Pick<AssetMetadataBulkItem, 'mainFileSingleUse'> {
  if (item.type === UploadQueueItemType.Asset) return {}
  // Never null. A row whose switch is not known yet is saved as off, which is how the DAM treats null.
  return { mainFileSingleUse: override ?? item.mainFileSingleUse ?? false }
}

// The DAM treats a single use flag that is not set as off.
const sameSingleUse = (one: boolean | null | undefined, other: boolean | null | undefined) =>
  (one ?? false) === (other ?? false)

/**
 * The body of one asset's save: all of `typed` without `known`, otherwise the fields that differ from it.
 * `base`: the custom data the changes were made against, for rebasing them onto a fresh read before sending.
 */
function metadataBody(
  id: DocId,
  assetType: DamAssetTypeType,
  typed: DamMetadataOnServer,
  known: DamMetadataOnServer | undefined,
  singleUse: Pick<AssetMetadataBulkItem, 'mainFileSingleUse'>,
  singleUseForced: boolean,
  extSystem: IntegerId,
  configName: string
) {
  const credit = creditFields(assetType, extSystem, typed.authors, typed.sources, configName)
  if (!known) {
    const body: AssetMetadataBulkItemBody = {
      id,
      keywords: typed.keywords,
      ...credit,
      described: true,
      customData: typed.customData,
      ...singleUse,
    }
    return { body, base: undefined }
  }
  const body: AssetMetadataBulkItemBody = { id, described: true }
  if (!sameMetadataValue(typed.keywords, known.keywords)) body.keywords = typed.keywords
  if (!sameMetadataValue(typed.authors, known.authors)) body.authors = typed.authors
  if ('sources' in credit && !sameMetadataValue(typed.sources, known.sources)) body.sources = typed.sources
  if (
    'mainFileSingleUse' in singleUse &&
    (singleUseForced || !sameSingleUse(singleUse.mainFileSingleUse, known.mainFileSingleUse))
  ) {
    body.mainFileSingleUse = singleUse.mainFileSingleUse
  }
  if (sameMetadataValue(typed.customData, known.customData)) return { body, base: undefined }
  body.customData = typed.customData

  return { body, base: known.customData }
}

/**
 * What the DAM has after a save that sent `body`, as far as the form or row knows: `before` with the sent fields.
 * Custom data are what the form or row held, which is what its next changes are made against.
 * The DAM also has the other editors' keys the save took, and the next rebase takes them again.
 */
const metadataAfterSave = (
  before: DamMetadataOnServer,
  typed: DamMetadataOnServer,
  body: AssetMetadataBulkItemBody
): DamMetadataOnServer => ({
  keywords: body.keywords ?? before.keywords,
  authors: body.authors ?? before.authors,
  sources: body.sources ?? before.sources,
  customData: isUndefined(body.customData) ? before.customData : typed.customData,
  mainFileSingleUse: isUndefined(body.mainFileSingleUse) ? before.mainFileSingleUse : body.mainFileSingleUse,
})

const typedOfRow = (item: UploadQueueItem): DamMetadataOnServer =>
  cloneDeep({
    keywords: item.keywords ?? [],
    authors: item.authors ?? [],
    sources: item.sources ?? [],
    customData: customDataOf(item.customData),
    mainFileSingleUse: item.mainFileSingleUse,
  })

function listItemsToMetadataBulkItems(
  items: Array<UploadQueueItem & { assetId: DocId }>,
  mainFileSingleUseOverride: boolean | undefined,
  extSystem: IntegerId,
  configName: string
) {
  return items.map((item) => {
    // Copied when the save starts: the row can be edited while its request waits for earlier ones.
    const typed = typedOfRow(item)
    const known = metadataOnServer(item)
    const singleUse = singleUseField(item, mainFileSingleUseOverride)
    const { body, base } = metadataBody(
      item.assetId,
      item.assetType,
      typed,
      known,
      singleUse,
      !isUndefined(mainFileSingleUseOverride),
      extSystem,
      configName
    )

    return { item, body, typed, base }
  })
}

/*
 * Rebases the changed custom data of a request onto the assets read right before it, one read per licence.
 * An asset the read does not find is sent as it is, and the DAM answers for it.
 */
const rebaseOntoFreshRead = async (
  client: () => AxiosInstance,
  endPoint: string,
  batch: ReturnType<typeof listItemsToMetadataBulkItems>
) => {
  const rebased = batch.filter(({ base }) => !isUndefined(base))
  if (rebased.length === 0) return
  const byLicence = new Map<IntegerId, DocId[]>()
  rebased.forEach(({ item }) => byLicence.set(item.licenceId, [...(byLicence.get(item.licenceId) ?? []), item.assetId]))
  const fresh = new Map<DocId, AssetDetailItemDto>()
  for (const [licenceId, ids] of byLicence) {
    for (const asset of await fetchAssetListByIds(client, endPoint, ids, licenceId)) fresh.set(asset.id, asset)
  }
  rebased.forEach(({ item, body, typed, base }) => {
    const asset = fresh.get(item.assetId)
    if (!asset || isUndefined(base)) return
    body.customData = rebaseCustomData(typed.customData, base, customDataOf(asset.metadata.customData))
  })
}

const { showErrorsDefault, showUnknownError, showApiValidationError } = useAlerts()

/** A field of a refused metadata save, named as the forms name it. */
const metadataFieldName = (
  key: string,
  assetTypes: Array<DamAssetTypeType | undefined>,
  extSystem: IntegerId,
  configName: string
) => {
  const indexed = key.match(/^\[(\d+)\]\.(.+)$/)
  const path = indexed ? indexed[2]! : key
  if (path === 'keywords') return commonT('common.damImage.asset.model.keywords')
  if (path === 'authors') return commonT('common.damImage.asset.model.authors')
  if (path === 'sources') return commonT('common.damImage.asset.model.sources')
  const property = path.split('.').at(-1)!
  const assetType = indexed ? assetTypes[Number(indexed[1])] : undefined
  if (path.startsWith('customData.') && !isUndefined(assetType)) {
    const { getDamConfigAssetCustomFormElements } = useDamConfigState(undefined, configName)
    const found = getDamConfigAssetCustomFormElements(extSystem)?.[assetType].find(
      (element) => element.property === property
    )
    if (found) return customDataFormElementName(found)
  }

  return property
}

/**
 * The single place that tells the user about a failed metadata save, by kind of failure.
 * A validation refusal names its fields as the `extSystem` forms do in DAM
 * configuration `configName`. A field refused for several assets is listed once.
 */
export const showMetadataSaveError = (error: unknown, extSystem: IntegerId, configName: string) => {
  if (error instanceof AssetMetadataValidationError) {
    const named = new Map<string, Set<string>>()
    for (const { field, errors } of error.requestFields) {
      const name = metadataFieldName(field, error.assetTypes, extSystem, configName)
      named.set(name, new Set([...(named.get(name) ?? []), ...errors]))
    }
    showApiValidationError(
      Array.from(named, ([field, errors]) => ({ field, errors: [...errors] })),
      -1,
      true
    )
    return
  }
  if (!showErrorsDefault(error)) showUnknownError()
}

/**
 * Saves the asset detail form `asset`. Callers name the fields of a refusal through `showMetadataSaveError`.
 * Sources are sent only where `extSystem` has them for the asset type in DAM configuration `configName`.
 * With `known`, what the DAM had when the form was read or last saved, only the fields changed against it go,
 * and changed custom data rebased onto the asset read right before. Without it the form is sent whole.
 * Resolves to what the DAM has after the save as far as the form knows, the form's next `known`.
 */
export const updateAssetMetadata = async (
  client: () => AxiosInstance,
  endPoint: string,
  asset: AssetDetailItemDto,
  extSystem: IntegerId,
  mainFileSingleUse: boolean | null,
  configName: string,
  known?: DamMetadataOnServer
) => {
  const typed = cloneDeep({ ...metadataOfAsset(asset), mainFileSingleUse })
  const { body, base } = metadataBody(
    asset.id,
    asset.attributes.assetType,
    typed,
    known,
    { mainFileSingleUse },
    false,
    extSystem,
    configName
  )
  if (!isUndefined(base)) {
    const fresh = await fetchAsset(client, endPoint, asset.id)
    body.customData = rebaseCustomData(typed.customData, base, customDataOf(fresh.metadata.customData))
  }

  const { execute } = useMetadataBulkCommand<AssetMetadataBulkItemBody>(client, endPoint)
  await saveMetadataInBatches(execute, [body], [asset.attributes.assetType])

  return metadataAfterSave(known ?? typed, typed, body)
}

// Callers name the fields of a refusal through `showMetadataSaveError`.
// Writes the asset's authors, and its sources where `extSystem` has them in DAM configuration `configName`.
export const updateAssetAuthors = async (
  client: () => AxiosInstance,
  endPoint: string,
  asset: AssetDetailItemDto,
  extSystem: IntegerId,
  configName: string
) => {
  const data: Partial<AssetMetadataBulkItem> = {
    id: asset.id,
    ...creditFields(asset.attributes.assetType, extSystem, asset.authors, asset.sources, configName),
    described: true,
  }

  const { execute } = useMetadataBulkCommand<Partial<AssetMetadataBulkItem>>(client, endPoint)
  await saveMetadataInBatches(execute, [data], [asset.attributes.assetType])
}

export type IdsGroupedByLicences = Map<IntegerId, DocId[]>

export type AssetAuthorsItems = AssetAuthorsItem[]
export interface AssetAuthorsItem {
  id: DocId
  authors: DocId[]
  sources?: DocId[]
}

/** Writes authors of assets of `assetType`, and their sources where `extSystem` has them in DAM configuration `configName`. */
export const bulkUpdateAssetsAuthors = async (
  client: () => AxiosInstance,
  endPoint: string,
  assetType: DamAssetTypeType,
  extSystem: IntegerId,
  items: AssetAuthorsItems,
  configName: string
) => {
  const { execute } = useMetadataBulkCommand<Pick<AssetMetadataBulkItem, 'id' | 'authors' | 'sources'>>(
    client,
    endPoint
  )
  const dtoItems = items.map((item) => ({
    id: item.id,
    ...creditFields(assetType, extSystem, item.authors, item.sources ?? [], configName),
  }))
  await saveMetadataInBatches(execute, dtoItems, [])
}
