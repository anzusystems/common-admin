import { computed, nextTick, ref, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import useVuelidate from '@vuelidate/core'
import { useAlerts } from '@/domains/system/composables/alerts'
import { handleRecordLoadError } from '@/domains/system/composables/recordPage'
import type { AxiosClientFn } from '@/domains/api/utils/client'
import type { FilterConfig, FilterData } from '@/domains/filters/composables/filterFactory'
import type { Pagination } from '@/domains/api/composables/pagination'
import { ANZU_USER_ENDPOINT, ANZU_USER_ENTITY, useAnzuUserApi } from '@/domains/anzuUser/api/anzuUserApi'
import { useAnzuUserOneStore } from '@/domains/anzuUser/store/anzuUserStore'
import type { AnzuUser } from '@/shared/types/AnzuUser'
import type { IntegerId } from '@/shared/types/common'
import { AnzuFatalError } from '@/shared/error/AnzuFatalError'
import { isNull, isUndefined } from '@/shared/utils/common'
import { syncUserAndTimeTracking } from '@/shared/utils/userAndTimeTracking'

export interface AnzuUserActionsParams {
  client: AxiosClientFn
  system: string
  entity?: string
  /**
   * i18n scope for server-side validation errors, independent of which backend answered.
   * `AnzuApiValidationError` builds `<system>.<entity>.model.<field>` keys, so this pair
   * must name where the labels live. Defaults to `common` + `anzuUser`. An admin whose
   * form adds system fields passes its own pair and keeps the base keys alongside.
   */
  validationSystem?: string
  validationEntity?: string
  endPoint?: string
  /**
   * Vuelidate scope, when the page collects its fields under one of its own.
   */
  validationScope?: string | symbol
}

// The record store is shared by every page and system, and requests are not
// aborted when a page goes. Only the latest fetch may write or reset the record.
// A store reset (page teardown, create page mount) also counts as newer.
let fetchGeneration = 0

/**
 * Per instance, like the other actions composables. The admins' versions kept loading flags at module scope.
 */
export const useAnzuUserActions = (params: AnzuUserActionsParams) => {
  const { client, system, entity = ANZU_USER_ENTITY, endPoint = ANZU_USER_ENDPOINT } = params

  const { showErrorsDefault, showRecordWas, showValidationError } = useAlerts()
  const { useFetchAnzuUserList, useFetchAnzuUser, useCreateAnzuUser, useUpdateAnzuUser } = useAnzuUserApi({
    client,
    system,
    entity,
    validationSystem: params.validationSystem,
    validationEntity: params.validationEntity,
    endPoint,
  })

  const { execute: executeList, abort: abortList } = useFetchAnzuUserList()

  const anzuUserList = ref<AnzuUser[]>([])
  const loadingAnzuUserList = ref(false)
  const datatableHiddenColumns = ref<Array<string>>([])

  let listGeneration = 0

  const fetchAnzuUserList = async (
    pagination: Ref<Pagination>,
    filterData: FilterData<any>,
    filterConfig: FilterConfig<any>
  ) => {
    const token = ++listGeneration
    loadingAnzuUserList.value = true
    try {
      const items = await executeList(pagination, filterData, filterConfig)
      if (token !== listGeneration) return
      anzuUserList.value = items
    } catch (error) {
      if (token !== listGeneration) return
      anzuUserList.value = []
      showErrorsDefault(error)
    } finally {
      if (token === listGeneration) loadingAnzuUserList.value = false
    }
  }

  const cancelAnzuUserList = () => {
    listGeneration++
    abortList()
  }

  const anzuUserOneStore = useAnzuUserOneStore()
  const { anzuUser, loadingAnzuUser } = storeToRefs(anzuUserOneStore)

  /**
   * What the server last returned, used to detect edits.
   * It drives the dot on the owning tab and the leave guard. Switching tabs is not
   * navigation, so the form stays dirty and the actual leave happens through a panel button.
   */
  const pristine = ref<string>('')
  const snapshot = () => {
    pristine.value = JSON.stringify(anzuUserOneStore.anzuUser)
  }

  const isDirty = computed(() => pristine.value !== '' && pristine.value !== JSON.stringify(anzuUser.value))

  /**
   * `true` once loaded, `false` when the page should leave (`handleRecordLoadError`), `undefined`
   * when a newer fetch took over or the request was stopped.
   */
  const fetchAnzuUser = async (id: IntegerId, options: { signal?: AbortSignal } = {}): Promise<boolean | undefined> => {
    const generation = ++fetchGeneration
    const isLatest = () => fetchGeneration === generation
    anzuUserOneStore.setLoadingAnzuUser(true)
    try {
      const { execute } = useFetchAnzuUser()
      const res = await execute({ urlParams: { id }, signal: options.signal })
      if (!isLatest()) return undefined
      anzuUserOneStore.setAnzuUser(res)
      // Snapshot after the form settles. Derived fields recompute in a watcher, and an earlier
      // baseline would mark an account with an empty stored full name as edited on open.
      await nextTick()
      snapshot()
      return true
    } catch (error) {
      // A newer fetch owns the record now, possibly another page's: leave it alone.
      if (!isLatest()) return undefined
      // Not the previous record: Save would PUT it back to its own id from a page opened for another.
      anzuUserOneStore.reset(system)
      pristine.value = ''
      return handleRecordLoadError(error) ? false : undefined
    } finally {
      if (isLatest()) anzuUserOneStore.setLoadingAnzuUser(false)
    }
  }

  // Collects what the form's children registered. With a scope it collects
  // only that scope, which lets an app keep its system fields separate.
  const v$ = params.validationScope ? useVuelidate({}, {}, { $scope: params.validationScope }) : useVuelidate()

  const loadingCreateAnzuUser = ref(false)
  /**
   * The body is the store's record from the library factory, with `roles: []` and `enabled: false`.
   * A hand-assembled body would make the backend add `ROLE_USER`, a role nobody granted.
   */
  const createAnzuUser = async (): Promise<AnzuUser | null> => {
    try {
      loadingCreateAnzuUser.value = true
      v$.value.$touch()
      if (v$.value.$invalid) {
        showValidationError()
        return null
      }
      const { execute } = useCreateAnzuUser()
      const created = await execute({ body: anzuUserOneStore.anzuUser })
      showRecordWas('created')
      snapshot()
      return created
    } catch (error) {
      showErrorsDefault(error)
      return null
    } finally {
      loadingCreateAnzuUser.value = false
    }
  }

  const loadingUpdateAnzuUser = ref(false)
  /**
   * Sends the whole record from the preceding GET with only edited fields changed.
   * An omitted field is destructive. `UserDto` defaults `roles` to `[ROLE_USER]`, `enabled` to `true`
   * and both permission collections to empty, and the manager writes all four. A metadata-only body
   * resets roles, wipes grants, detaches groups and re-enables a disabled account.
   */
  const updateAnzuUser = async (): Promise<boolean> => {
    try {
      loadingUpdateAnzuUser.value = true
      v$.value.$touch()
      if (v$.value.$invalid) {
        showValidationError()
        return false
      }
      const id = anzuUserOneStore.anzuUser.id
      if (isNull(id) || isUndefined(id)) {
        throw new AnzuFatalError(undefined, '[useAnzuUserActions] update called on a record with no id.')
      }
      const { execute } = useUpdateAnzuUser()
      const res = await execute({
        urlParams: { id },
        body: anzuUserOneStore.anzuUser,
      })
      // Before the snapshot: `isDirty` compares the whole record, so tracking written after it would
      // mark the form as unsaved.
      syncUserAndTimeTracking(anzuUserOneStore.anzuUser, res)
      showRecordWas('updated')
      snapshot()
      return true
    } catch (error) {
      showErrorsDefault(error)
      return false
    } finally {
      loadingUpdateAnzuUser.value = false
    }
  }

  return {
    isDirty,
    /**
     * Takes the record as it stands as the new baseline; the page calls it after it seeds one.
     */
    markPristine: snapshot,
    anzuUserList,
    loadingAnzuUserList,
    datatableHiddenColumns,
    fetchAnzuUserList,
    cancelAnzuUserList,
    anzuUser,
    loadingAnzuUser,
    fetchAnzuUser,
    createAnzuUser,
    updateAnzuUser,
    loadingCreateAnzuUser,
    loadingUpdateAnzuUser,
    resetAnzuUserStore: (...args: Parameters<typeof anzuUserOneStore.reset>) => {
      fetchGeneration++
      anzuUserOneStore.reset(...args)
    },
  }
}
