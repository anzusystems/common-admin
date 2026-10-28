import { createI18n } from 'vue-i18n'
import { useAuthStore } from '@/domains/auth/store/authStore'
import { Grant } from '@/domains/auth/valueObject/Grant'
import { SYSTEM_DAM } from '@/domains/dam/api/damConstants'
import en from '@/locales/en'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'
import { commonT } from '@/plugins/i18n'
import type { IntegerId } from '@/shared/types/common'

// What the user reads of an upload: the library texts as the test setup renders
// them (English), and the raised alerts, which no tested component shows.

const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en } })

export const uiText = (key: string, named: Record<string, unknown> = {}) => i18n.global.t(key, named)

export const damText = (key: string, named: Record<string, unknown> = {}) => uiText(`common.damImage.${key}`, named)

export const shownAlerts = () => useAlertsQueue().value.map((alert) => [alert.color, alert.text])

/**
 * Alerts translate through the plugin's instance, which tests do not
 * install. The expected text is what that instance makes of the key.
 */
export const alertText = (key: string) => commonT(key)

export const forgetAlerts = () => {
  useAlertsQueue().value = []
}

export const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/**
 * The DAM user as admin-cms has loaded it when a widget mounts: one of
 * the given ext system with the given grants. admin-ugc has no DAM user.
 */
export const signInToDam = (extSystem: IntegerId, grants: string[] = []) => {
  const auth = useAuthStore()
  auth.currentUsers.value.set(SYSTEM_DAM, {
    id: 1,
    roles: [],
    resolvedPermissions: Object.fromEntries(grants.map((grant) => [grant, Grant.Allow])),
    adminToExtSystems: [],
    userToExtSystems: [extSystem],
    resolvedAssetLicences: [],
  } as never)
  auth.currentUsersLoaded.value.set(SYSTEM_DAM, true)
}

export const signOutOfDam = () => useAuthStore().reset()
