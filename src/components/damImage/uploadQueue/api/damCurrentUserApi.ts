import type { AxiosInstance } from 'axios'
import type { DamCurrentUserDto } from '@/types/coreDam/DamCurrentUser'
import { useApiRequest } from '@/labs/api/useApiRequest'

const END_POINT = '/adm/users/current'

export const fetchDamCurrentUser = (client: () => AxiosInstance) => {
  const { execute } = useApiRequest<DamCurrentUserDto, null>({
    client,
    method: 'GET',
    system: 'coreDam',
    entity: 'user',
    urlTemplate: END_POINT,
  })

  return execute()
}
