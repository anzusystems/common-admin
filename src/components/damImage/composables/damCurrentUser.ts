import { ref } from 'vue'
import type { DamCurrentUserDto } from '@/types/coreDam/DamCurrentUser'
import { fetchDamCurrentUser } from '@/components/damImage/uploadQueue/api/damCurrentUserApi'
import { ROLE_SUPER_ADMIN } from '@/composables/system/ability'
import type { AxiosInstance } from 'axios'

export const damCurrentUser = ref<DamCurrentUserDto | undefined>(undefined)
export const damCurrentUserIsSuperAdmin = ref(false)

export function updateDamCurrentUser(client: () => AxiosInstance) {
  return new Promise((resolve, reject) => {
    fetchDamCurrentUser(client)
      .then((res: DamCurrentUserDto) => {
        damCurrentUser.value = res
        if (res.roles.includes(ROLE_SUPER_ADMIN)) {
          damCurrentUserIsSuperAdmin.value = true
        }
        resolve(damCurrentUser)
      })
      .catch((err) => {
        reject(err)
      })
  })
}

export function useDamCurrentUser() {
  return {
    damCurrentUser,
    damCurrentUserIsSuperAdmin,
  }
}
