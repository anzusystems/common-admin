import type { AxiosInstance } from 'axios'
import type { AssetDetailItemDto, AssetSearchListItemDto } from '@/types/coreDam/Asset'
import type { IdsGroupedByLicences } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { ENTITY, fetchAssetListByIds, SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { apiAnyRequest } from '@/services/api/apiAnyRequest'

export const fetchAssetListByFileIdsMultipleLicences = async (
  client: () => AxiosInstance,
  groupedIds: IdsGroupedByLicences
) => {
  const resultsSearch: AssetSearchListItemDto[] = []

  for (const [key, value] of groupedIds) {
    const res = await apiAnyRequest<object ,{ data: AssetSearchListItemDto[] }>(
      client,
      'GET',
      '/adm/v1/asset/licence/:licenceId?assetAndMainFileIds=' + value.join(','),
      {
        licenceId: key,
      },
      {},
      SYSTEM_CORE_DAM,
      ENTITY
    )
    resultsSearch.push(...res.data)
  }

  const group2: IdsGroupedByLicences = new Map()
  resultsSearch.forEach((item) => {
    const group2Exist = group2.get(item.licence)
    if (group2Exist) {
      group2Exist.push(item.id)
    } else {
      group2.set(item.licence, [item.id])
    }
  })

  const finalResult: AssetDetailItemDto[] = []
  for (const [key, value] of group2) {
    const res = await fetchAssetListByIds(client, value, key)
    finalResult.push(...res)
  }

  return finalResult
}
