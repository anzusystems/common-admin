import { createApp, readonly, ref } from 'vue'
import App from './App.vue'
import { vuetify } from './plugins/vuetify'
import { i18n } from './plugins/i18n'
import { createPinia } from 'pinia'
import router from './router'
import { createCommonAdmin } from '@/create'
import AnzuSystemsCommonAdmin from '@/AnzuSystemsCommonAdmin'
import { AnzuUser } from '@/types/AnzuUser'
import { Grant } from '@/model/valueObject/Grant'

createCommonAdmin({ i18nInstance: i18n })

export type CustomAclValue = 'anzu_entity_create' | 'anzu_entity_view'

const currentUserObject: AnzuUser = {
  _resourceName: '',
  _system: '',
  createdAt: '',
  createdBy: 0,
  email: '',
  enabled: false,
  id: 1,
  modifiedAt: '',
  modifiedBy: 0,
  permissionGroups: [],
  permissions: {},
  resolvedPermissions: {
    anzu_entity_create: Grant.Deny,
    anzu_entity_view: Grant.Allow,
  },
  roles: [],
}
const currentUserRef = ref<AnzuUser | undefined>(currentUserObject)
const currentUser = readonly(currentUserRef)

createApp(App)
  .use(createPinia())
  .use(router)
  .use(i18n)
  .use(vuetify)
  .use(AnzuSystemsCommonAdmin, { currentUser })
  .mount('#app')
