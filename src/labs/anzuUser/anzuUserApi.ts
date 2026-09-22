import type { AxiosClientFn } from '@/labs/api/client'
import { useApiFetchByIds } from '@/labs/api/useApiFetchByIds'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { useApiRequest } from '@/labs/api/useApiRequest'
import type { AnzuUser } from '@/types/AnzuUser'

export const ANZU_USER_ENTITY = 'anzuUser'
export const ANZU_USER_ENDPOINT = '/adm/v1/anzu-user'

export interface AnzuUserApiParams {
  client: AxiosClientFn
  /**
   * Both reach every `useApiRequest` built here. The admins' copies declared `system = 'common'`
   * and `entity = 'anzuUser'` as file constants, which is why a shared version has to take them:
   * the same file now serves nine backends, and the error context has to name the right one.
   */
  system: string
  entity?: string
  /**
   * i18n scope for a server-side validation failure, which is a different question from which
   * backend answered. `AnzuApiValidationError` builds `<system>.<entity>.model.<field>` keys, and
   * for a component shared by nine backends the labels are always the library's own `common.*` --
   * `weather.anzuUser.model.email` exists nowhere. Defaults to `common` plus the entity;
   * contentHub passes its own pair to keep the keys it already has.
   */
  validationSystem?: string
  validationEntity?: string
  endPoint?: string
}

/**
 * Generic in the user type, because the three systems that answer on `/adm/users` return a DTO of
 * their own -- `CmsUserDto`, `DamUserDto`, `ContentHubUserDto` -- each extending `UserDto` with
 * system fields. Losing those in the round trip is exactly what the write invariant forbids: the
 * body of a write is the whole object the preceding GET returned.
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
   * Only cms, dam and contentHub have this, and it is the safe path for metadata: the method
   * behind it writes e-mail, locale, avatar and person and has no setter for anything else.
   *
   * The body is the whole record the preceding read returned -- typed `T`, not `BaseUser`. Two
   * reasons, and both are the invariant: `BaseUser` has no `locale`, and the method behind this
   * path calls `setLocale` unconditionally, so a body shaped like `BaseUser` would erase the
   * interface language of whoever was edited. And `id` has to be in it: `BaseUserDto` declares a
   * uniqueness constraint on both `id` and `email`, and the validator only excludes the record
   * itself when the DTO carries a non-empty `id` -- without it the server reports the user's own
   * e-mail as taken, on every account.
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
