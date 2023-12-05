import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { isNull } from '@/utils/common'
import type { DamAuthor, DamAuthorMinimal } from '@/components/damImage/uploadQueue/author/DamAuthor'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { fetchAuthorList, fetchAuthorListByIds } from '@/components/damImage/uploadQueue/api/authorApi'
import type { ValueObjectOption } from '@/types/ValueObject'

export const useAuthorSelectActions = () => {
  const { damClient } = useCommonAdminCoreDamOptions()
  const { initialized } = useDamConfigState()

  const mapToMinimal = (author: DamAuthor): DamAuthorMinimal => ({
    id: author.id,
    name: author.name,
    identifier: author.identifier,
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

  const fetchItems = async (pagination: Pagination, filterBag: FilterBag) => {
    if (isNull(initialized.damConfigExtSystem)) {
      throw new Error('Ext system must be initialised.')
    }
    return mapToValueObjects(await fetchAuthorList(damClient, initialized.damConfigExtSystem, pagination, filterBag))
  }

  const fetchItemsMinimal = async (pagination: Pagination, filterBag: FilterBag) => {
    if (isNull(initialized.damConfigExtSystem)) {
      throw new Error('Ext system must be initialised.')
    }
    return mapToMinimals(await fetchAuthorList(damClient, initialized.damConfigExtSystem, pagination, filterBag))
  }

  const fetchItemsByIds = async (ids: string[]) => {
    if (isNull(initialized.damConfigExtSystem)) {
      throw new Error('Ext system must be initialised.')
    }
    return mapToValueObjects(await fetchAuthorListByIds(damClient, initialized.damConfigExtSystem, ids))
  }

  return {
    mapToValueObject,
    fetchItems,
    fetchItemsByIds,
    fetchItemsMinimal,
  }
}
