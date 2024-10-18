import type { AxiosInstance } from 'axios'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import type { DamCurrentUserDto } from '@/types/coreDam/DamCurrentUser'

const END_POINT = '/adm/v1/users/current'

export const fetchDamCurrentUser = (client: () => AxiosInstance) =>
  apiFetchOne<DamCurrentUserDto>(client, END_POINT, {}, 'coreDam', 'user')
