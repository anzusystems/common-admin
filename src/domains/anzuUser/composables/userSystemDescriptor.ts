import type { RouteLocationRaw } from 'vue-router'
import type { AxiosClientFn } from '@/domains/api/utils/client'
import type { AnzuUser } from '@/shared/types/AnzuUser'

/**
 * A system state shown next to `enabled`. Today: blog's `status` and forum's `settings.banned`.
 * Both are serialized on the entity, so rendering costs no extra call.
 */
export interface UserSystemExtraState {
  /**
   * "blogger", "commenter". The app translates it; the library only prints it.
   */
  label: string
  /**
   * "active", "banned".
   */
  value: string
  tone: 'ok' | 'warn' | 'error'
}

/**
 * `/adm/v1/anzu-user`. Absent in contentHub, which has only `/adm/users`.
 */
export interface AnzuUserEndpointPair {
  get: string
  put: string
  post: string
}

/**
 * `/adm/users`. Only cms, dam and contentHub have it; it is the only path with a `PATCH`.
 */
export interface BaseUserEndpointPair extends AnzuUserEndpointPair {
  patch: string
}

/**
 * Paired GET and write paths. A write body is always the whole object the GET on the same path returned.
 * The two paths return different DTOs. A GET from one and a PUT to the other
 * silently drops fields, e.g. cms `CmsUserDto` with `updateRelations()`.
 */
export interface UserSystemEndpoints {
  anzuUser: AnzuUserEndpointPair | null
  base: BaseUserEndpointPair | null
  permissionGroup: string
  /**
   * Per system. contentHub uses `/adm/users/current`.
   */
  currentUser: string
  list: string
  /**
   * Which pair the probe reads through. The probe follows the write path.
   * In dam `GET /adm/v1/anzu-user/{id}` is ungated while `GET /adm/users/{id}`
   * needs `DAM_USER_READ`, so only the second can show "no access".
   */
  probe: 'anzuUser' | 'base'
}

/**
 * Where "manage in X" leads. A callback because the descriptor does not know which row is drawn.
 * Internal targets go through the router. External ones open in a new tab.
 * `href: null` means a missing url and renders disabled with a reason.
 */
export type UserSystemManageTarget =
  | { kind: 'internal'; to: RouteLocationRaw }
  | { kind: 'external'; href: string | null }

export interface UserSystemDescriptor<TSystem extends string = string, TUser extends AnzuUser = AnzuUser> {
  system: TSystem
  client: AxiosClientFn
  /**
   * Reaches every `useApiRequest` built for this system; see `permissionGroupApi`.
   */
  entity: string
  /**
   * Whether the system is enabled in this admin's config (`envConfig[system].enabled`).
   * Mandatory because the disabled state must be shown. Omitting the system from the array is not the same.
   */
  isEnabled: () => boolean
  /**
   * Validation profile. `false`: only e-mail is required. `true`: also
   * first name, last name, full name, avatar text and avatar colour.
   * Same for create and edit.
   */
  requiredMetadata: boolean
  /**
   * Whether the id is typed in. False only in cms, where the backend looks it up in SSO by e-mail.
   * Read-only on edit regardless.
   */
  idInput: boolean
  extraState?: (user: TUser) => UserSystemExtraState | null
  /**
   * Above the `enabled` switch and in the row of a bulk action.
   */
  enabledNote?: string
  /**
   * In the metadata repair dialog and in the owning form.
   */
  metadataNote?: string
  /**
   * In the confirmation dialog when an account is created here.
   */
  createNote?: string
  endpoints: UserSystemEndpoints
  /**
   * The system's name as the app translates it.
   */
  label?: string
  manage?: (user: TUser) => UserSystemManageTarget
  /**
   * Whether the current user may write this system's accounts. `false`
   * removes create, enable/disable, manage and the bulk action part.
   * `undefined` or no function leaves it to the probe and the
   * backend. Only the admin knows the other systems' current users.
   */
  canWrite?: (action: UserSystemWriteAction) => boolean | undefined
}

export type UserSystemWriteAction = 'create' | 'update'

/**
 * Type erasure point for the heterogeneous descriptor array.
 * Descriptors differ in `TUser`. Erasing here avoids a cast at every call site under `strict: true`.
 */
export type AnyUserSystemDescriptor = UserSystemDescriptor<string, AnzuUser>

export const defineUserSystemDescriptor = <TSystem extends string, TUser extends AnzuUser>(
  descriptor: UserSystemDescriptor<TSystem, TUser>
): AnyUserSystemDescriptor => descriptor as unknown as AnyUserSystemDescriptor

/**
 * False only when the descriptor says no. Not knowing is not a no.
 */
export const descriptorMayWrite = (descriptor: AnyUserSystemDescriptor, action: UserSystemWriteAction): boolean =>
  descriptor.canWrite?.(action) !== false

/**
 * Both `endpoints` branches are nullable, so `probe: 'base'` may name a system without `/adm/users`.
 * Each admin's descriptor test asserts this resolves for every system.
 */
export const resolveProbeEndpoint = (descriptor: AnyUserSystemDescriptor): AnzuUserEndpointPair => {
  const pair = descriptor.endpoints[descriptor.endpoints.probe]
  if (pair === null) {
    throw new Error(
      `[userSystemDescriptor] '${descriptor.system}' names probe '${descriptor.endpoints.probe}', which it does not have.`
    )
  }
  return pair
}

/**
 * Metadata goes through `PATCH /adm/users/{id}` where it exists.
 * Its method has no setters for roles, permissions, groups or `enabled`.
 */
export const resolveMetadataWrite = (
  descriptor: AnyUserSystemDescriptor
): { method: 'PATCH'; get: string; url: string } | { method: 'PUT'; get: string; url: string } => {
  const base = descriptor.endpoints.base
  if (base !== null) return { method: 'PATCH', get: base.get, url: base.patch }
  const anzuUser = descriptor.endpoints.anzuUser
  if (anzuUser === null) {
    throw new Error(`[userSystemDescriptor] '${descriptor.system}' has neither write path.`)
  }
  return { method: 'PUT', get: anzuUser.get, url: anzuUser.put }
}

/**
 * `enabled` has no PATCH. Only the full update calls `setEnabled`.
 * So it is GET then PUT on the same path with the whole DTO from the GET.
 */
export const resolveEnabledWrite = (descriptor: AnyUserSystemDescriptor): { get: string; url: string } => {
  const base = descriptor.endpoints.base
  if (base !== null) return { get: base.get, url: base.put }
  const anzuUser = descriptor.endpoints.anzuUser
  if (anzuUser === null) {
    throw new Error(`[userSystemDescriptor] '${descriptor.system}' has neither write path.`)
  }
  return { get: anzuUser.get, url: anzuUser.put }
}

/**
 * Creating an account goes the same way a write does.
 */
export const resolveCreateEndpoint = (descriptor: AnyUserSystemDescriptor): string => {
  const base = descriptor.endpoints.base
  if (base !== null) return base.post
  const anzuUser = descriptor.endpoints.anzuUser
  if (anzuUser === null) {
    throw new Error(`[userSystemDescriptor] '${descriptor.system}' has no create path.`)
  }
  return anzuUser.post
}
