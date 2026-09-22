import { computed } from 'vue'
import { useAlerts } from '@/composables/system/alerts'
import { useLanguageSettings } from '@/composables/languageSettings'
import type { AxiosClientFn } from '@/labs/api/client'
import {
  PERMISSION_CONFIG_ENDPOINT,
  PERMISSION_CONFIG_ENTITY,
  usePermissionConfigApi,
} from '@/labs/permissionConfig/permissionConfigApi'
import { usePermissionConfigStore } from '@/labs/permissionConfig/permissionConfigStore'
import type { PermissionTranslationGroup } from '@/types/PermissionConfig'
import { objectGetValueByPath } from '@/utils/object'

export interface PermissionConfigActionsParams {
  client: AxiosClientFn
  /**
   * The system this config belongs to. It is a parameter and not a global -- admin-inhouse used to
   * read it from a `curSystem` ref, which made the whole module impossible to use from a page that
   * shows two systems at once and impossible to move here at all.
   */
  system: string
  entity?: string
  endPoint?: string
  /**
   * Fetch as soon as the composable is built, the way every admin does today. Turn it off where
   * the caller wants to decide when (a dialog that may never open, a test).
   */
  autoFetch?: boolean
}

/**
 * One request per system, however many components ask at once. The map lives at module scope
 * because the de-duplication has to span composable instances: a page with the editor open twice
 * builds two of these, and both would otherwise fire the same GET.
 */
const inFlight = new Map<string, Promise<void>>()

export const usePermissionConfigActions = (params: PermissionConfigActionsParams) => {
  const {
    client,
    system,
    entity = PERMISSION_CONFIG_ENTITY,
    endPoint = PERMISSION_CONFIG_ENDPOINT,
    autoFetch = true,
  } = params

  const { showErrorsDefault } = useAlerts()
  const { useFetchPermissionConfig } = usePermissionConfigApi({ client, system, entity, endPoint })
  const store = usePermissionConfigStore()

  const entry = computed(() => store.getEntry(system))
  const permissionConfig = computed(() => entry.value.config)
  const loadingPermissionConfig = computed(() => entry.value.loading)
  const isPermissionConfigInitialized = computed(() => entry.value.initialized)

  const runFetch = async () => {
    store.setLoading(system, true)
    try {
      const { execute } = useFetchPermissionConfig()
      store.setConfig(system, await execute())
    } catch (error) {
      showErrorsDefault(error)
    } finally {
      // Always, including on the failure path. Without it a backend that is down leaves the
      // editor's card spinning for the rest of the session.
      store.setLoading(system, false)
      inFlight.delete(system)
    }
  }

  const fetchPermissionConfig = async (force = false) => {
    if (!force && isPermissionConfigInitialized.value) return
    const running = inFlight.get(system)
    if (running) return running
    const started = runFetch()
    inFlight.set(system, started)
    return started
  }

  const { currentLanguageCode } = useLanguageSettings()

  /**
   * Falls back to the raw key, which is the contract the admins rely on: the ACL vocabulary lives
   * in the backend yaml, never in front-end i18n, so an untranslated action is shown as
   * `weather_location_ui` rather than as a blank cell.
   */
  const translatePermission = (group: PermissionTranslationGroup, key: string): string => {
    const translated = objectGetValueByPath(
      permissionConfig.value.translation,
      group + '.' + key + '.' + currentLanguageCode.value
    )

    return translated ?? key
  }

  if (autoFetch) void fetchPermissionConfig()

  return {
    permissionConfig,
    loadingPermissionConfig,
    isPermissionConfigInitialized,
    fetchPermissionConfig,
    translatePermission,
    resetPermissionConfig: () => store.resetSystem(system),
  }
}
