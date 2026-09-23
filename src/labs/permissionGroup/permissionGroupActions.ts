import { ref, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import useVuelidate from '@vuelidate/core'
import { useAlerts } from '@/composables/system/alerts'
import type { AxiosClientFn } from '@/labs/api/client'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import type { Pagination } from '@/labs/filters/pagination'
import { useCachedPermissionGroups } from '@/labs/permissionGroup/cachedPermissionGroups'
import {
  PERMISSION_GROUP_ENDPOINT,
  PERMISSION_GROUP_ENTITY,
  usePermissionGroupApi,
} from '@/labs/permissionGroup/permissionGroupApi'
import { usePermissionGroupOneStore } from '@/labs/permissionGroup/permissionGroupStore'
import type { IntegerId } from '@/types/common'
import type { PermissionGroup } from '@/types/PermissionGroup'
import type { ValueObjectOption } from '@/types/ValueObject'

export interface PermissionGroupActionsParams {
  client: AxiosClientFn
  system: string
  entity?: string
  /**
   * i18n scope for a server-side validation failure, which is a different question from which
   * backend answered. `AnzuApiValidationError` builds `<system>.<entity>.model.<field>` keys, so
   * the pair has to name the namespace the *labels* live under. It defaults to `common` +
   * `permissionGroup`, which is where the shared form's own fields are; an admin whose form carries
   * system fields as well passes its own pair, and keeps the base keys beside them.
   */
  validationSystem?: string
  validationEntity?: string
  endPoint?: string
}

/**
 * Everything below is per instance. The admins kept `listLoading`, `detailLoading` and
 * `datatableHiddenColumns` at module scope, which is a single set of flags shared by every caller
 * -- fine for one list on one backend, wrong for a library a page may instantiate twice.
 */
export const usePermissionGroupActions = (params: PermissionGroupActionsParams) => {
  const { client, system, entity = PERMISSION_GROUP_ENTITY, endPoint = PERMISSION_GROUP_ENDPOINT } = params

  const { showValidationError, showRecordWas, showErrorsDefault } = useAlerts()
  const {
    useFetchPermissionGroupList,
    useFetchPermissionGroup,
    useDeletePermissionGroup,
    useUpdatePermissionGroup,
    useCreatePermissionGroup,
    useFetchPermissionGroupListByIds,
  } = usePermissionGroupApi({
    client,
    system,
    entity,
    validationSystem: params.validationSystem,
    validationEntity: params.validationEntity,
    endPoint,
  })

  const { execute: executeList, abort: abortList } = useFetchPermissionGroupList()
  const { execute: executeFetchByIds } = useFetchPermissionGroupListByIds()

  const datatableHiddenColumns = ref<Array<string>>([])
  const permissionGroupList = ref<PermissionGroup[]>([])
  const loadingPermissionGroupList = ref(false)

  // Same reason as in `useLogListActions`: axios rejects an aborted request with `CanceledError`,
  // which reaches the catch like any other failure. Without a token the user gets an error alert
  // for a navigation they performed themselves.
  let listGeneration = 0

  const fetchPermissionGroupList = async (
    pagination: Ref<Pagination>,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>
  ) => {
    const token = ++listGeneration
    loadingPermissionGroupList.value = true
    try {
      const items = await executeList(pagination, filterData, filterConfig)
      if (token !== listGeneration) return
      permissionGroupList.value = items
    } catch (error) {
      if (token !== listGeneration) return
      permissionGroupList.value = []
      showErrorsDefault(error)
    } finally {
      if (token === listGeneration) loadingPermissionGroupList.value = false
    }
  }

  const cancelPermissionGroupList = () => {
    listGeneration++
    abortList()
  }

  const permissionGroupOneStore = usePermissionGroupOneStore()
  const { permissionGroup, loadingPermissionGroup } = storeToRefs(permissionGroupOneStore)

  const fetchPermissionGroup = async (id: IntegerId) => {
    permissionGroupOneStore.setLoadingPermissionGroup(true)
    try {
      const { execute } = useFetchPermissionGroup()
      permissionGroupOneStore.setPermissionGroup(await execute({ urlParams: { id } }))
    } catch (error) {
      showErrorsDefault(error)
    } finally {
      permissionGroupOneStore.setLoadingPermissionGroup(false)
    }
  }

  const loadingDeletePermissionGroup = ref(false)
  /** Resolves true when the row is gone, so the caller can decide where to navigate. */
  const deletePermissionGroup = async (id: IntegerId): Promise<boolean> => {
    try {
      loadingDeletePermissionGroup.value = true
      const { execute } = useDeletePermissionGroup()
      await execute({ urlParams: { id } })
      showRecordWas('deleted')
      return true
    } catch (error) {
      showErrorsDefault(error)
      return false
    } finally {
      loadingDeletePermissionGroup.value = false
    }
  }

  const v$ = useVuelidate()

  const loadingUpdatePermissionGroup = ref(false)
  const updatePermissionGroup = async (): Promise<boolean> => {
    try {
      loadingUpdatePermissionGroup.value = true
      v$.value.$touch()
      if (v$.value.$invalid) {
        showValidationError()
        return false
      }
      const { execute } = useUpdatePermissionGroup()
      await execute({
        urlParams: { id: permissionGroupOneStore.permissionGroup.id },
        body: permissionGroupOneStore.permissionGroup,
      })
      showRecordWas('updated')
      return true
    } catch (error) {
      showErrorsDefault(error)
      return false
    } finally {
      loadingUpdatePermissionGroup.value = false
    }
  }

  const loadingCreatePermissionGroup = ref(false)
  /** Resolves the created row, so the caller can route to its detail; null on failure. */
  const createPermissionGroup = async (): Promise<PermissionGroup | null> => {
    try {
      loadingCreatePermissionGroup.value = true
      v$.value.$touch()
      if (v$.value.$invalid) {
        showValidationError()
        return null
      }
      const { execute } = useCreatePermissionGroup()
      const created = await execute({ body: permissionGroupOneStore.permissionGroup })
      showRecordWas('created')
      return created
    } catch (error) {
      showErrorsDefault(error)
      return null
    } finally {
      loadingCreatePermissionGroup.value = false
    }
  }

  const { addManualToCachedPermissionGroups } = useCachedPermissionGroups({ client, system, entity, endPoint })

  const fetchPermissionGroupOptions = async (
    pagination: Ref<Pagination>,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>
  ): Promise<ValueObjectOption<IntegerId>[]> => {
    const permissionGroups = await executeList(pagination, filterData, filterConfig)
    permissionGroups.forEach((item) => addManualToCachedPermissionGroups(item))

    return permissionGroups.map((item) => ({ title: item.title, value: item.id }))
  }

  const fetchPermissionGroupOptionsByIds = async (ids: IntegerId[]): Promise<ValueObjectOption<IntegerId>[]> => {
    const permissionGroups = await executeFetchByIds(ids)
    permissionGroups.forEach((item) => addManualToCachedPermissionGroups(item))

    return permissionGroups.map((item) => ({ title: item.title, value: item.id }))
  }

  return {
    datatableHiddenColumns,
    permissionGroupList,
    loadingPermissionGroupList,
    fetchPermissionGroupList,
    cancelPermissionGroupList,
    permissionGroup,
    loadingPermissionGroup,
    fetchPermissionGroup,
    createPermissionGroup,
    updatePermissionGroup,
    deletePermissionGroup,
    loadingCreatePermissionGroup,
    loadingUpdatePermissionGroup,
    loadingDeletePermissionGroup,
    fetchPermissionGroupOptions,
    fetchPermissionGroupOptionsByIds,
    resetPermissionGroupStore: permissionGroupOneStore.reset,
  }
}
