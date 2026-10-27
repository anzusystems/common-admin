import { computed } from 'vue'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useLanguageSettings } from '@/domains/system/composables/languageSettings'
import type { AxiosClientFn } from '@/domains/api/utils/client'
import {
  PERMISSION_CONFIG_ENDPOINT,
  PERMISSION_CONFIG_ENTITY,
  usePermissionConfigApi,
} from '@/domains/permission/config/api/permissionConfigApi'
import { usePermissionConfigStore } from '@/domains/permission/config/store/permissionConfigStore'
import type { PermissionTranslationGroup } from '@/domains/permission/config/types/PermissionConfig'
import { objectGetValueByPath } from '@/shared/utils/object'

export interface PermissionConfigActionsParams {
  client: AxiosClientFn
  /**
   * The system this config belongs to. A parameter, not a global, so a page can show two systems at once.
   */
  system: string
  entity?: string
  endPoint?: string
  /**
   * Fetch as soon as the composable is built, as every admin does.
   * Turn off where the caller decides when, e.g. a dialog that may never open or a test.
   */
  autoFetch?: boolean
}

/**
 * One request per system, however many components ask.
 * Module scope, because de-duplication must span composable
 * instances. Two open editors would otherwise fire the same GET.
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
      // Always, including on failure. Otherwise a down backend leaves the editor's card spinning for the session.
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
   * Falls back to the raw key, which the admins rely on.
   * The ACL vocabulary lives in the backend yaml, not in front-end i18n, so
   * an untranslated action shows as `weather_location_ui`, not a blank cell.
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
