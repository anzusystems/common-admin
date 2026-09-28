import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { isUndefined } from '@/shared/utils/common'
import type { DamAuthor, DamAuthorMinimal } from '@/domains/dam/author/types/DamAuthor'
import type { Pagination } from '@/domains/api/composables/pagination'
import { fetchAuthorListByIds, useFetchAuthorList } from '@/domains/dam/author/api/authorApi'
import type { ValueObjectOption } from '@/shared/types/ValueObject'
import type { IntegerId } from '@/shared/types/common'
import type { Ref } from 'vue'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'

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

  const { execute } = useFetchAuthorList(damClient, extSystem)

  const fetchItems = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    return mapToValueObjects(await execute(pagination, filterData, filterConfig))
  }

  const fetchItemsMinimal = async (pagination: Ref<Pagination>, filterData: FilterData, filterConfig: FilterConfig) => {
    return mapToMinimals(await execute(pagination, filterData, filterConfig))
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
