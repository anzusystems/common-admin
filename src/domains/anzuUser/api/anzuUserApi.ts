import type { AxiosClientFn } from '@/domains/api/utils/client'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiRequest } from '@/domains/api/composables/useApiRequest'
import type { AnzuUser } from '@/shared/types/AnzuUser'

export const ANZU_USER_ENTITY = 'anzuUser'
export const ANZU_USER_ENDPOINT = '/adm/v1/anzu-user'

export interface AnzuUserApiParams {
  client: AxiosClientFn
  /**
   * Both reach every `useApiRequest` built here.
   * This file serves nine backends, so the error context has to name the right one.
   */
  system: string
  entity?: string
  /**
   * i18n scope for server-side validation failures, separate from which backend answered.
   * `AnzuApiValidationError` builds `<system>.<entity>.model.<field>` keys. For a component shared by
   * nine backends the labels are the library's `common.*`; `weather.anzuUser.model.email` does not exist.
   * Defaults to `common` plus the entity. contentHub passes its own pair to keep its existing keys.
   */
  validationSystem?: string
  validationEntity?: string
  endPoint?: string
}

/**
 * Generic in the user type: the systems on `/adm/users` return their own DTO (`CmsUserDto`,
 * `DamUserDto`, `ContentHubUserDto`) extending `UserDto` with system fields.
 * Those fields must survive the round trip: a write body is the whole object the preceding GET returned.
 */
export const useAnzuUserApi = <T extends AnzuUser = AnzuUser>({
  client,
  system,
  entity = ANZU_USER_ENTITY,
  validationSystem = 'common',
  validationEntity = entity,
  endPoint = ANZU_USER_ENDPOINT,
}: AnzuUserApiParams) => {
  const scope = { validationSystem, validationEntity }
  const useFetchAnzuUserListByIds = () =>
    useApiFetchByIds<T>({ client, system, entity, ...scope, urlTemplate: endPoint })

  const useFetchAnzuUserList = () => useApiFetchList<T>({ client, system, entity, ...scope, urlTemplate: endPoint })

  const useFetchAnzuUser = () =>
    useApiRequest<T, null>({ client, method: 'GET', system, entity, ...scope, urlTemplate: endPoint + '/:id' })

  const useCreateAnzuUser = () =>
    useApiRequest<T, T>({ client, method: 'POST', system, entity, ...scope, urlTemplate: endPoint })

  const useUpdateAnzuUser = () =>
    useApiRequest<T, T>({ client, method: 'PUT', system, entity, ...scope, urlTemplate: endPoint + '/:id' })

  /**
   * Only cms, dam and contentHub have this path. It is the safe path for metadata:
   * the backend method writes e-mail, locale, avatar and person and nothing else.
   * The body is the whole record from the preceding read, typed `T`, not `BaseUser`. The method calls `setLocale`
   * unconditionally, and `BaseUser` has no `locale`, so a `BaseUser` body would erase the user's interface language.
   * The body must also carry `id`. `BaseUserDto` has a uniqueness constraint on `id` and `email`, and the validator
   * excludes the record itself only when `id` is set. Without it the server reports the user's own e-mail as taken.
   */
  const usePatchBaseUser = (patchEndPoint: string) =>
    useApiRequest<T, T>({ client, method: 'PATCH', system, entity, ...scope, urlTemplate: patchEndPoint })

  return {
    useFetchAnzuUserListByIds,
    useFetchAnzuUserList,
    useFetchAnzuUser,
    useCreateAnzuUser,
    useUpdateAnzuUser,
    usePatchBaseUser,
  }
}
