import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { isNull } from '@/utils/common'
import type { DamKeyword, DamKeywordMinimal } from '@/components/damImage/uploadQueue/keyword/DamKeyword'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { fetchKeywordList, fetchKeywordListByIds } from '@/components/damImage/uploadQueue/api/keywordApi'

export const useKeywordSelectActions = () => {
  const { damClient } = useCommonAdminCoreDamOptions()
  const { initialized } = useDamConfigState()

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
    if (isNull(initialized.damConfigExtSystem)) {
      throw new Error('Ext system must be initialised.')
    }
    return mapToValueObjects(await fetchKeywordList(damClient, initialized.damConfigExtSystem, pagination, filterBag))
  }

  const fetchItemsMinimal = async (pagination: Pagination, filterBag: FilterBag) => {
    if (isNull(initialized.damConfigExtSystem)) {
      throw new Error('Ext system must be initialised.')
    }
    return mapToMinimals(await fetchKeywordList(damClient, initialized.damConfigExtSystem, pagination, filterBag))
  }

  const fetchItemsByIds = async (ids: string[]) => {
    if (isNull(initialized.damConfigExtSystem)) {
      throw new Error('Ext system must be initialised.')
    }
    return mapToValueObjects(await fetchKeywordListByIds(damClient, initialized.damConfigExtSystem, ids))
  }

  return {
    mapToValueObject,
    fetchItems,
    fetchItemsByIds,
    fetchItemsMinimal,
  }
}
