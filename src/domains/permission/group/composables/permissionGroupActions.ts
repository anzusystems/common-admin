import { ref, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import useVuelidate from '@vuelidate/core'
import { useAlerts } from '@/domains/system/composables/alerts'
import type { AxiosClientFn } from '@/domains/api/utils/client'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'
import type { Pagination } from '@/domains/api/composables/pagination'
import { useCachedPermissionGroups } from '@/domains/permission/group/composables/cachedPermissionGroups'
import {
  PERMISSION_GROUP_ENDPOINT,
  PERMISSION_GROUP_ENTITY,
  usePermissionGroupApi,
} from '@/domains/permission/group/api/permissionGroupApi'
import { usePermissionGroupOneStore } from '@/domains/permission/group/store/permissionGroupStore'
import type { IntegerId } from '@/shared/types/common'
import type { PermissionGroup } from '@/domains/permission/group/types/PermissionGroup'
import type { ValueObjectOption } from '@/shared/types/ValueObject'
import { AnzuFatalError } from '@/shared/error/AnzuFatalError'
import { syncUserAndTimeTracking } from '@/shared/utils/userAndTimeTracking'

// The record store is shared by every page, and a request is not aborted when its page goes: only the
// latest fetch may write the record, or reset it on failure. A store reset (a page's teardown, a create
// page's mount) counts as newer too.
let fetchGeneration = 0

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
    const generation = ++fetchGeneration
    permissionGroupOneStore.setLoadingPermissionGroup(true)
    try {
      const { execute } = useFetchPermissionGroup()
      const res = await execute({ urlParams: { id } })
      if (generation !== fetchGeneration) return
      permissionGroupOneStore.setPermissionGroup(res)
    } catch (error) {
      // A newer fetch owns the record now, possibly another page's: leave it alone.
      if (generation !== fetchGeneration) return
      // Not the previous record: Save would PUT it back to its own id from a page opened for another.
      permissionGroupOneStore.reset()
      showErrorsDefault(error)
    } finally {
      if (generation === fetchGeneration) permissionGroupOneStore.setLoadingPermissionGroup(false)
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
      const id = permissionGroupOneStore.permissionGroup.id
      // The factory's blank record has id 0: after a failed fetch there is nothing to update.
      if (!id) {
        throw new AnzuFatalError(undefined, '[usePermissionGroupActions] update called on a record with no id.')
      }
      const { execute } = useUpdatePermissionGroup()
      const res = await execute({
        urlParams: { id: permissionGroupOneStore.permissionGroup.id },
        body: permissionGroupOneStore.permissionGroup,
      })
      syncUserAndTimeTracking(permissionGroupOneStore.permissionGroup, res)
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
    resetPermissionGroupStore: () => {
      fetchGeneration++
      permissionGroupOneStore.reset()
    },
  }
}
