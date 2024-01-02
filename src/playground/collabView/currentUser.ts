import { readonly, ref } from 'vue'
import type { AnzuUser } from '@/types/AnzuUser'
import { isDefined } from '@/utils/common'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import { cmsClient } from '@/playground/mock/cmsClient'

export const fetchCurrentUser = () => apiFetchOne<AnzuUser>(cmsClient, '/adm/v1/user/current', {}, 'cms', 'user')

const currentUser = ref<AnzuUser | undefined>(undefined)

export function updateCurrentUser() {
  return new Promise((resolve, reject) => {
    fetchCurrentUser()
      .then((res: AnzuUser) => {
        currentUser.value = res
        resolve(currentUser)
      })
      .catch((err) => {
        reject(err)
      })
  })
}

export function useCurrentUser() {
  const hasCurrentUser = () => isDefined(currentUser.value)

  return {
    currentUser: readonly(currentUser),
    hasCurrentUser,
  }
}
