import { computed, nextTick, ref, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import useVuelidate from '@vuelidate/core'
import { useAlerts } from '@/composables/system/alerts'
import type { AxiosClientFn } from '@/labs/api/client'
import type { FilterConfig, FilterData } from '@/labs/filters/filterFactory'
import type { Pagination } from '@/labs/filters/pagination'
import { ANZU_USER_ENDPOINT, ANZU_USER_ENTITY, useAnzuUserApi } from '@/labs/anzuUser/anzuUserApi'
import { useAnzuUserOneStore } from '@/labs/anzuUser/anzuUserStore'
import type { AnzuUser } from '@/types/AnzuUser'
import type { IntegerId } from '@/types/common'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import { isNull, isUndefined } from '@/utils/common'

export interface AnzuUserActionsParams {
  client: AxiosClientFn
  system: string
  entity?: string
  /**
   * i18n scope for a server-side validation failure, which is a different question from which
   * backend answered. `AnzuApiValidationError` builds `<system>.<entity>.model.<field>` keys, so
   * the pair has to name the namespace the *labels* live under. It defaults to `common` +
   * `anzuUser`, which is where the shared form's own fields are; an admin whose form carries
   * system fields as well passes its own pair, and keeps the base keys beside them.
   */
  validationSystem?: string
  validationEntity?: string
  endPoint?: string
  /** Vuelidate scope, when the page collects its fields under one of its own. */
  validationScope?: string | symbol
}

/**
 * Per instance, like every other actions composable here. The admins' versions kept their loading
 * flags at module scope.
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
   * What the server last said, so the page can tell whether anything has been edited.
   *
   * A page needs this for two things that look cosmetic and are not: the dot on the owning tab,
   * and the guard that asks before leaving. Switching a tab is not navigation -- the form stays
   * mounted and dirty -- so the moment the operator does leave is through a button inside a panel,
   * and by then nothing else remembers there was unsaved work.
   */
  const pristine = ref<string>('')
  const snapshot = () => {
    pristine.value = JSON.stringify(anzuUserOneStore.anzuUser)
  }

  const isDirty = computed(() => pristine.value !== '' && pristine.value !== JSON.stringify(anzuUser.value))

  const fetchAnzuUser = async (id: IntegerId) => {
    anzuUserOneStore.setLoadingAnzuUser(true)
    try {
      const { execute } = useFetchAnzuUser()
      anzuUserOneStore.setAnzuUser(await execute({ urlParams: { id } }))
      // After the form has settled, not before it. The derived fields recompute in a watcher, and
      // a baseline taken ahead of that would make an account whose stored full name is empty read
      // as edited the instant it opens -- an unsaved dot and a leave prompt before anyone typed.
      await nextTick()
      snapshot()
    } catch (error) {
      showErrorsDefault(error)
    } finally {
      anzuUserOneStore.setLoadingAnzuUser(false)
    }
  }

  // Collects whatever the form's children registered. With a scope it collects only that scope,
  // which is how an app keeps its own system fields in a separate one.
  const v$ = params.validationScope ? useVuelidate({}, {}, { $scope: params.validationScope }) : useVuelidate()

  const loadingCreateAnzuUser = ref(false)
  /**
   * The body is the store's record, which the library factory built: `roles: []` and
   * `enabled: false`. That matters -- a hand-assembled body of base fields would have the backend
   * fill in `ROLE_USER`, and the account would exist with a role nobody granted.
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
   * Sends the whole record the preceding GET returned, with only the edited fields changed.
   *
   * That is the write invariant, and it is not a style preference: an omitted field is destructive
   * rather than neutral. `UserDto` defaults `roles` to `[ROLE_USER]`, `enabled` to `true` and both
   * permission collections to empty, and the manager writes all four unconditionally -- so a body
   * carrying only the metadata resets roles, wipes grants, detaches groups and switches a disabled
   * account back on.
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
      await execute({
        urlParams: { id },
        body: anzuUserOneStore.anzuUser,
      })
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
    /** Takes the record as it stands as the new baseline; the page calls it after it seeds one. */
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
    resetAnzuUserStore: anzuUserOneStore.reset,
  }
}
