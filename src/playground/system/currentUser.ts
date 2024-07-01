import type { AnzuUser } from '@/types/AnzuUser'
import { Grant } from '@/model/valueObject/Grant'
import { readonly, ref } from 'vue'
import { ROLE_SUPER_ADMIN } from '@/composables/auth/defineAuth'

const currentUserObject: AnzuUser = {
  id: 1,
  email: 'common@admin.com',
  enabled: false,
  roles: [ROLE_SUPER_ADMIN],
  person: {
    firstName: 'Common',
    lastName: 'Admin',
    fullName: 'Common Admin User',
  },
  avatar: {
    color: '#3f6ad8',
    text: 'CA',
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
export const currentUser = readonly(currentUserRef)
