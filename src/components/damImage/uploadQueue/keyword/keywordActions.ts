import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { isUndefined } from '@/utils/common'
import type { DamKeyword, DamKeywordMinimal } from '@/components/damImage/uploadQueue/keyword/DamKeyword'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { fetchKeywordList, fetchKeywordListByIds } from '@/components/damImage/uploadQueue/api/keywordApi'
import type { IntegerId } from '@/types/common'

export const useKeywordSelectActions = (extSystem: IntegerId) => {
  const { damClient } = useCommonAdminCoreDamOptions()
  const { getDamConfigExtSystem } = useDamConfigState()

  const configExtSystem = getDamConfigExtSystem(extSystem)
  if (isUndefined(configExtSystem)) {
    throw new Error('Ext system must be initialised.')
  }

  const mapToValueObject = (keyword: DamKeyword): ValueObjectOption<string> => ({
    title: keyword.name,
    value: keyword.id,
  })

  const mapToMinimal = (keyword: DamKeyword): DamKeywordMinimal => ({
    id: keyword.id,
    name: keyword.name,
  })

  const mapToValueObjects = (keywords: DamKeyword[]): ValueObjectOption<string>[] => {
    return keywords.map((keyword: DamKeyword) => mapToValueObject(keyword))
  }

  const mapToMinimals = (keywords: DamKeyword[]): DamKeywordMinimal[] => {
    return keywords.map((keyword: DamKeyword) => mapToMinimal(keyword))
  }

  const fetchItems = async (pagination: Pagination, filterBag: FilterBag) => {
    return mapToValueObjects(await fetchKeywordList(damClient, extSystem, pagination, filterBag))
  }

  const fetchItemsMinimal = async (pagination: Pagination, filterBag: FilterBag) => {
    return mapToMinimals(await fetchKeywordList(damClient, extSystem, pagination, filterBag))
  }

  const fetchItemsByIds = async (ids: string[]) => {
    return mapToValueObjects(await fetchKeywordListByIds(damClient, extSystem, ids))
  }

  return {
    mapToValueObject,
    fetchItems,
    fetchItemsByIds,
    fetchItemsMinimal,
  }
}
