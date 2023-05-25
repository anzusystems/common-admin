import { createApp, readonly, ref } from 'vue'
import App from '@/App.vue'
import { vuetify } from '@/plugins/vuetify'
import { i18n } from '@/plugins/i18n'
import { createPinia } from 'pinia'
import router from '@/router'
import AnzuSystemsCommonAdmin from '@/AnzuSystemsCommonAdmin'
import type { AnzuUser } from '@/types/AnzuUser'
import { Grant } from '@/model/valueObject/Grant'
import { ROLE_SUPER_ADMIN } from '@/composables/system/ability'
import { damClient } from '@/services/api/clients/coreDamClient'

export type CustomAclValue = 'anzu_entity_create' | 'anzu_entity_view'

const currentUserObject: AnzuUser = {
  id: 1,
  email: '',
  enabled: false,
  roles: [ROLE_SUPER_ADMIN],
  person: {
    firstName: '',
    lastName: '',
    fullName: '',
  },
  avatar: {
    color: '',
    text: '',
  },
  permissionGroups: [],
  permissions: {},
  resolvedPermissions: {
    anzu_entity_create: Grant.Deny,
    anzu_entity_view: Grant.Allow,
  },
  createdAt: '',
  createdBy: 0,
  modifiedAt: '',
  modifiedBy: 0,
  _resourceName: '',
  _system: '',
}
const currentUserRef = ref<AnzuUser>(currentUserObject)
const currentUser = readonly(currentUserRef)

createApp(App)
  .use(createPinia())
  .use(router)
  .use(i18n)
  .use(vuetify)
  .use(AnzuSystemsCommonAdmin, {
    currentUser,
    languages: {
      available: ['en', 'sk'],
      default: 'sk',
    },
    coreDam: {
      client: damClient,
      defaultLicenceId: 100001,
    },
  })
  .mount('#app')
