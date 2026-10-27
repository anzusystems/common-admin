import axios, { type AxiosError, type AxiosInstance } from 'axios'
import type { DocId, IntegerId } from '@/shared/types/common'
import type { AssetDetailItemDto, AssetSearchListItemDto, DamAssetTypeType } from '@/domains/dam/types/Asset'
import type { UploadQueueItem } from '@/domains/dam/types/UploadQueue'
import { HTTP_STATUS_OK } from '@/shared/statusCodes'
import { isNull, isUndefined } from '@/shared/utils/common'
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

const BULK_METADATA_LIMIT = 10
export const ENTITY = 'asset'
const FETCH_BY_IDS_MAX_LIMIT = 50

export interface AssetMetadataBulkItem {
  id: DocId
  keywords: DocId[]
  authors: DocId[]
  described: boolean
  customData: AssetCustomData
  mainFileSingleUse: boolean | null
  mainFileInternal: boolean | null
  mainFileOverrideInternal: boolean | null
}

// What a save sends. Whether the main file is internal is set in the DAM itself.
// A save from here leaves those two fields unchanged and reads them from the answer.
type AssetMetadataBulkItemBody = Omit<AssetMetadataBulkItem, 'mainFileInternal' | 'mainFileOverrideInternal'>

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

/**
 * `endPoint`: as configured (`endPointCmsAsset`). Defaults to `/adm/v1/cms/asset`.
 */
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

export const bulkUpdateAssetsMetadata = async (
  client: () => AxiosInstance,
  endPoint: string,
  items: UploadQueueItem[],
  mainFileSingleUseOverride: boolean | undefined = undefined
) => {
  const sent = items.filter(hasMetadataToSave)
  const { execute } = useMetadataBulkUpdate<AssetMetadataBulkItemBody>(client, endPoint)
  const answers = await saveMetadataInBatches(
    execute,
    listItemsToMetadataBulkItems(sent, mainFileSingleUseOverride),
    sent.map((item) => item.assetType)
  )

  return answers.flat()
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

/**
 * Items the bulk save sends: those with an asset whose metadata the user may edit.
 */
export const hasMetadataToSave = (item: UploadQueueItem): item is UploadQueueItem & { assetId: DocId } =>
  !isNull(item.assetId) && item.canEditMetadata

function listItemsToMetadataBulkItems(
  items: UploadQueueItem[],
  mainFileSingleUseOverride: boolean | undefined = undefined
) {
  const dtoItems: AssetMetadataBulkItemBody[] = []
  items.forEach((item) => {
    if (hasMetadataToSave(item)) {
      dtoItems.push({
        id: item.assetId,
        keywords: item.keywords,
        authors: item.authors,
        described: true,
        customData: item.customData,
        // Never null. A row whose switch is not known yet is saved as off, which is how the DAM treats null.
        mainFileSingleUse: mainFileSingleUseOverride ?? item.mainFileSingleUse ?? false,
      })
    }
  })

  return dtoItems
}

const { showErrorsDefault, showUnknownError, showApiValidationError } = useAlerts()

/**
 * A field of a refused metadata save, named as the forms name it.
 */
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
  const property = path.split('.').at(-1)!
  const assetType = indexed ? assetTypes[Number(indexed[1])] : undefined
  if (path.startsWith('customData.') && !isUndefined(assetType)) {
    const { getDamConfigAssetCustomFormElements } = useDamConfigState(undefined, configName)
    const found = getDamConfigAssetCustomFormElements(extSystem)?.[assetType].find(
      (element) => element.property === property
    )
    if (found) return found.name
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

// Callers name the fields of a refusal through `showMetadataSaveError`, so `extSystem` is not needed here.
export const updateAssetMetadata = async (
  client: () => AxiosInstance,
  endPoint: string,
  asset: AssetDetailItemDto,
  extSystem: IntegerId,
  mainFileSingleUse: boolean | null
) => {
  const data: AssetMetadataBulkItemBody = {
    id: asset.id,
    keywords: asset.keywords,
    authors: asset.authors,
    described: true,
    customData: asset.metadata.customData,
    mainFileSingleUse: mainFileSingleUse,
  }

  const { execute } = useMetadataBulkCommand<AssetMetadataBulkItemBody>(client, endPoint)
  await saveMetadataInBatches(execute, [data], [asset.attributes.assetType])
}

// Callers name the fields of a refusal through `showMetadataSaveError`.
export const updateAssetAuthors = async (client: () => AxiosInstance, endPoint: string, asset: AssetDetailItemDto) => {
  const data: Partial<AssetMetadataBulkItem> = {
    id: asset.id,
    authors: asset.authors,
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
}

export const bulkUpdateAssetsAuthors = async (
  client: () => AxiosInstance,
  endPoint: string,
  items: AssetAuthorsItems
) => {
  const { execute } = useMetadataBulkCommand<AssetAuthorsItem>(client, endPoint)
  await saveMetadataInBatches(execute, items, [])
}
