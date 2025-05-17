import type { AxiosInstance } from 'axios'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'
import type { IdsGroupedByLicences } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { ENTITY, fetchAssetListByIds, SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { apiAnyRequest } from '@/services/api/apiAnyRequest'

const MAX_LIMIT = 20

export const fetchAssetListByFileIdsMultipleLicences = async (
  client: () => AxiosInstance,
  groupedIds: IdsGroupedByLicences
) => {
  const batchedRequests = Array.from(groupedIds.entries()).flatMap(([licenceId, docIds]) => {
    return chunkArray(docIds, MAX_LIMIT).map(chunk =>
      fetchAssetListByFileIdsMultipleLicencesWithLimit(client, new Map([[licenceId, chunk]]))
    )
  })

  // Execute all requests in parallel, failing fast if any request fails
  const assetsResponses = await Promise.all(batchedRequests)

  return assetsResponses.flat()
}

const fetchAssetListByFileIdsMultipleLicencesWithLimit = async (
  client: () => AxiosInstance,
  groupedIds: IdsGroupedByLicences
) => {
  const searchResults = await Promise.all(
    Array.from(groupedIds.entries()).map(([licenceId, docIds]) =>
      apiAnyRequest<object, { data: AssetSearchListItemDto[] }>(
        client,
        'GET',
        `/adm/v1/asset/licence/:licenceId/search?assetAndMainFileIds=${docIds.join(',')}&limit=${docIds.length}`,
        { licenceId },
        {},
        SYSTEM_CORE_DAM,
        ENTITY
      )
    )
  )

  const groupedSearchResults: IdsGroupedByLicences = new Map()
  searchResults.forEach(res => {
    res.data.forEach(item => {
      if (!groupedSearchResults.has(item.licence)) {
        groupedSearchResults.set(item.licence, [])
      }
      groupedSearchResults.get(item.licence)!.push(item.id)
    })
  })

  const finalResults = await Promise.all(
    Array.from(groupedSearchResults.entries()).map(([licenceId, docIds]) =>
      fetchAssetListByIds(client, docIds, licenceId)
    )
  )

  return finalResults.flat()
}

const chunkArray = <T>(arr: T[], size: number): T[][] => {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, index) =>
    arr.slice(index * size, index * size + size)
  )
}
