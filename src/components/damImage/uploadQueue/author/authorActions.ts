import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { isUndefined } from '@/utils/common'
import type { DamAuthor, DamAuthorMinimal } from '@/components/damImage/uploadQueue/author/DamAuthor'
import type { Pagination } from '@/labs/filters/pagination'
import { fetchAuthorListByIds, useFetchAuthorList } from '@/components/damImage/uploadQueue/api/authorApi'
import type { ValueObjectOption } from '@/types/ValueObject'
import type { IntegerId } from '@/types/common'
import type { Ref } from 'vue'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'

export const useAuthorSelectActions = (extSystem: IntegerId) => {
  const { damClient } = useCommonAdminCoreDamOptions()
  const { getDamConfigExtSystem } = useDamConfigState()

  const configExtSystem = getDamConfigExtSystem(extSystem)
  if (isUndefined(configExtSystem)) {
    throw new Error('useAuthorSelectActions: Ext system must be initialised.')
  }

  const mapToMinimal = (author: DamAuthor): DamAuthorMinimal => ({
    id: author.id,
    name: author.name,
    identifier: author.identifier,
    reviewed: author.flags.reviewed,
  })

  const mapToValueObject = (author: DamAuthor): ValueObjectOption<string> => ({
    title: author.name + (author.identifier ? ` (${author.identifier})` : ''),
    value: author.id,
  })

  const mapToValueObjects = (authors: DamAuthor[]): ValueObjectOption<string>[] => {
    return authors.map((author: DamAuthor) => mapToValueObject(author))
  }

  const mapToMinimals = (authors: DamAuthor[]): DamAuthorMinimal[] => {
    return authors.map((author: DamAuthor) => mapToMinimal(author))
  }

  const { executeFetch } = useFetchAuthorList(damClient, extSystem)

  const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    return mapToValueObjects(await executeFetch(pagination, filterData, filterConfig))
  }

  const fetchItemsMinimal = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    return mapToMinimals(await executeFetch(pagination, filterData, filterConfig))
  }

  const fetchItemsByIds = async (ids: string[]) => {
    return mapToValueObjects(await fetchAuthorListByIds(damClient, extSystem, ids))
  }

  const fetchItemsMinimalByIds = async (ids: string[]) => {
    return mapToMinimals(await fetchAuthorListByIds(damClient, extSystem, ids))
  }

  return {
    mapToValueObject,
    fetchItems,
    fetchItemsByIds,
    fetchItemsMinimal,
    fetchItemsMinimalByIds,
  }
}
