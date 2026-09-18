import type { AxiosInstance } from 'axios'
// eslint-disable-next-line anzu/no-deprecated-imports
import { apiFetchOne } from '@/services/api/apiFetchOne'
import type { DamCurrentUserDto } from '@/types/coreDam/DamCurrentUser'

const END_POINT = '/adm/users/current'

export const fetchDamCurrentUser = (client: () => AxiosInstance) =>
  apiFetchOne<DamCurrentUserDto>(client, END_POINT, {}, 'coreDam', 'user')
