import { ref } from 'vue'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { isNull } from '@/utils/common'
import { useAlerts } from '@/composables/system/alerts'
import type { DamAuthor, DamAuthorMinimal } from '@/components/damImage/uploadQueue/author/DamAuthor'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { fetchAuthorList, fetchAuthorListByIds } from '@/components/damImage/uploadQueue/api/authorApi'
import type { ValueObjectOption } from '@/types/ValueObject'

const { showValidationError, showRecordWas, showErrorsDefault } = useAlerts()

const datatableHiddenColumns = ref<Array<string>>(['id'])
const listLoading = ref(false)
const detailLoading = ref(false)
const saveButtonLoading = ref(false)
const saveAndCloseButtonLoading = ref(false)

// export const useAuthorListActions = () => {
//   const { damClient } = useCommonAdminCoreDamOptions()
//   const { initialized } = useDamConfigState()
//   if (isNull(initialized.damConfigExtSystem)) {
//     throw new Error('Ext system must be initialised.')
//   }
//
//   const listItems = ref<DamAuthor[]>([])
//
//   const fetchList = async (pagination: Pagination, filterBag: FilterBag) => {
//     if (isNull(initialized.damConfigExtSystem)) {
//       throw new Error('Ext system must be initialised.')
//     }
//     listLoading.value = true
//     try {
//       listItems.value = await fetchAuthorList(damClient, initialized.damConfigExtSystem, pagination, filterBag)
//     } catch (error) {
//       showErrorsDefault(error)
//     } finally {
//       listLoading.value = false
//     }
//   }
//
//   return {
//     datatableHiddenColumns,
//     listLoading,
//     listItems,
//     fetchList,
//   }
// }

// export const useAuthorDetailActions = () => {
//   const authorOneStore = useAuthorOneStore()
//   const { author } = storeToRefs(authorOneStore)
//
//   const fetchData = async (id: string) => {
//     detailLoading.value = true
//     try {
//       const author = await fetchAuthor(id)
//       authorOneStore.setAuthor(author)
//     } catch (error) {
//       showErrorsDefault(error)
//     } finally {
//       detailLoading.value = false
//     }
//   }
//
//   return {
//     author,
//     detailLoading,
//     fetchData,
//     resetStore: authorOneStore.reset,
//   }
// }

// export const useAuthorEditActions = () => {
//   const v$ = useVuelidate()
//   const router = useRouter()
//   const authorOneStore = useAuthorOneStore()
//   const { author } = storeToRefs(authorOneStore)
//
//   const fetchData = async (id: string) => {
//     detailLoading.value = true
//     try {
//       const author = await fetchAuthor(id)
//       authorOneStore.setAuthor(author)
//     } catch (error) {
//       showErrorsDefault(error)
//     } finally {
//       detailLoading.value = false
//     }
//   }
//
//   const onUpdate = async (close = false) => {
//     try {
//       close ? (saveAndCloseButtonLoading.value = true) : (saveButtonLoading.value = true)
//       v$.value.$touch()
//       if (v$.value.$invalid) {
//         showValidationError()
//         saveButtonLoading.value = false
//         saveAndCloseButtonLoading.value = false
//         return
//       }
//       await updateAuthor(authorOneStore.author.id, author.value)
//       showRecordWas('updated')
//       if (!close) return
//       router.push({ name: ROUTE.DAM.AUTHOR.LIST })
//     } catch (error) {
//       showErrorsDefault(error)
//     } finally {
//       saveButtonLoading.value = false
//       saveAndCloseButtonLoading.value = false
//     }
//   }
//
//   return {
//     detailLoading,
//     saveButtonLoading,
//     saveAndCloseButtonLoading,
//     author,
//     fetchData,
//     onUpdate,
//     resetStore: authorOneStore.reset,
//   }
// }

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
