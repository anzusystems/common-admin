import type { AxiosInstance } from 'axios'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'
import type { IdsGroupedByLicences } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { ENTITY, fetchAssetListByIds, SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useApiRequest } from '@/labs/api/useApiRequest'

const MAX_LIMIT = 20

export const fetchAssetListByFileIdsMultipleLicences = async (
  client: () => AxiosInstance,
  endPoint: string,
  groupedIds: IdsGroupedByLicences
) => {
  const batchedRequests = Array.from(groupedIds.entries()).flatMap(([licenceId, docIds]) => {
    return chunkArray(docIds, MAX_LIMIT).map((chunk) =>
      fetchAssetListByFileIdsMultipleLicencesWithLimit(client, endPoint, new Map([[licenceId, chunk]]))
    )
  })

  const assetsResponses = await Promise.all(batchedRequests)
  return assetsResponses.flat()
}

export const fetchAssetAndCheckForSingleUseByFileIds = async (
  client: () => AxiosInstance,
  endPoint: string,
  groupedIds: IdsGroupedByLicences
) => {
  const batchedRequests = Array.from(groupedIds.entries()).flatMap(([licenceId, docIds]) => {
    return chunkArray(docIds, MAX_LIMIT).map((chunk) =>
      fetchAssetListByFileIdsMultipleLicencesWithLimit(client, endPoint, new Map([[licenceId, chunk]]), 1, true)
    )
  })

  const assetsResponses = await Promise.all(batchedRequests)
  return assetsResponses.some((batch) => batch.length > 0)
}

const fetchAssetListByFileIdsMultipleLicencesWithLimit = async (
  client: () => AxiosInstance,
  endPoint: string,
  groupedIds: IdsGroupedByLicences,
  forceLimit?: number,
  filterSingleUse?: boolean
) => {
  const searchResults = await Promise.all(
    Array.from(groupedIds.entries()).map(([licenceId, docIds]) => {
      const singleUseParam = filterSingleUse ? '&mainFileSingleUse=1' : ''
      // Response first, body second -- the old helper took them the other way round, and because
      // each of its type parameters defaulted to the other, writing them in the old order here
      // would still compile.
      const { execute } = useApiRequest<{ data: AssetSearchListItemDto[] }, object>({
        client,
        method: 'GET',
        system: SYSTEM_CORE_DAM,
        entity: ENTITY,
        urlTemplate:
          endPoint +
          '/licence/:licenceId/search?assetAndMainFileIds=' +
          `${docIds.join(',')}&limit=${forceLimit !== undefined ? forceLimit : docIds.length}${singleUseParam}`,
      })

      // `{}` on purpose: the old call passed it explicitly, so the request carried an empty body.
      return execute({ urlParams: { licenceId }, body: {} })
    })
  )

  const groupedSearchResults: IdsGroupedByLicences = new Map()
  searchResults.forEach((res) => {
    res.data.forEach((item) => {
      if (!groupedSearchResults.has(item.licence)) {
        groupedSearchResults.set(item.licence, [])
      }
      groupedSearchResults.get(item.licence)!.push(item.id)
    })
  })

  const finalResults = await Promise.all(
    Array.from(groupedSearchResults.entries()).map(([licenceId, docIds]) =>
      fetchAssetListByIds(client, endPoint, docIds, licenceId)
    )
  )

  return finalResults.flat()
}

const chunkArray = <T>(arr: T[], size: number): T[][] => {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, index) =>
    arr.slice(index * size, index * size + size)
  )
}
