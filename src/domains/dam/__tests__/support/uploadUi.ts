import { createI18n } from 'vue-i18n'
import { useAuthStore } from '@/domains/auth/store/authStore'
import { Grant } from '@/domains/auth/valueObject/Grant'
import { SYSTEM_DAM } from '@/domains/dam/api/damConstants'
import en from '@/locales/en'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'
import { commonT } from '@/plugins/i18n'
import type { IntegerId } from '@/shared/types/common'

// What the user reads of an upload, for the component tests of the upload dialogs and widgets: the texts of the
// library as the test setup renders them (English), and the alerts raised, which no component of a test shows.

const i18n = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en } })

/** The text of a key of the library, as a mounted component renders it. */
export const uiText = (key: string, named: Record<string, unknown> = {}) => i18n.global.t(key, named)

/** The same, of a key of the DAM upload and image widgets (`common.damImage.…`). */
export const damText = (key: string, named: Record<string, unknown> = {}) => uiText(`common.damImage.${key}`, named)

/** The alerts the user was shown so far: `[colour, text]` each, in the order they were raised. */
export const shownAlerts = () => useAlertsQueue().value.map((alert) => [alert.color, alert.text])

/**
 * The text an alert of the given key is raised with. The alerts translate through the instance of the plugin,
 * which a test has not installed: the text is what that instance makes of the key.
 */
export const alertText = (key: string) => commonT(key)

/** The alerts are the page's: what an earlier case raised is not this one's. */
export const forgetAlerts = () => {
  useAlertsQueue().value = []
}

/** A one-pixel image that needs no server: the preview of a row whose picture is to be drawn. */
export const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/**
 * The user of the DAM as admin-cms has loaded it by the time a widget mounts: one of the given ext system, with the
 * given grants. admin-ugc has no user of the DAM at all.
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

/** The users are the page's: the one an earlier case signed in is not this one's. */
export const signOutOfDam = () => useAuthStore().reset()
