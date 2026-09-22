import type { RouteLocationRaw } from 'vue-router'
import type { AxiosClientFn } from '@/labs/api/client'
import type { AnzuUser } from '@/types/AnzuUser'

/**
 * A state a system has on top of `enabled`, shown next to it. Today only two systems have one:
 * blog's `status` (guest / waiting_approval / active / ban / gdpr_deleted) and forum's
 * `settings.banned`. Both arrive with the record -- they are `#[Serialize]` on the entity -- so
 * rendering one costs no extra call.
 */
export interface UserSystemExtraState {
  /** "blogger", "commenter" -- the app translates it; the library only prints it. */
  label: string
  /** "active", "banned". */
  value: string
  tone: 'ok' | 'warn' | 'error'
}

/** `/adm/v1/anzu-user`. Absent in contentHub, which has only `/adm/users`. */
export interface AnzuUserEndpointPair {
  get: string
  put: string
  post: string
}

/** `/adm/users`. Only cms, dam and contentHub have it; it is the only path with a `PATCH`. */
export interface BaseUserEndpointPair extends AnzuUserEndpointPair {
  patch: string
}

/**
 * Paired GET + write paths, never loose urls.
 *
 * This is what makes the write invariant expressible: a write body is always the whole object the
 * preceding GET on the *same path* returned. The two paths return different DTOs -- `/adm/users`
 * in cms answers `CmsUserDto` and its PUT runs `updateRelations()` over seven scalars and twelve
 * collections -- so a GET from one path and a PUT to the other silently drops whatever the other
 * DTO carries.
 */
export interface UserSystemEndpoints {
  anzuUser: AnzuUserEndpointPair | null
  base: BaseUserEndpointPair | null
  permissionGroup: string
  /**
   * Per system, not one constant. contentHub's is `/adm/users/current`, and the admins had this
   * hard-coded as a single path shared by every backend.
   */
  currentUser: string
  list: string
  /**
   * Which pair the probe reads through. A field rather than something derived, because in dam the
   * choice is visible to the operator: `GET /adm/v1/anzu-user/{id}` has no gating at all while
   * `GET /adm/users/{id}` sits behind `DAM_USER_READ`, so only the second can ever render "you
   * have no access". The rule is "the probe goes the way the write goes".
   */
  probe: 'anzuUser' | 'base'
}

/**
 * Where "manage in X" leads. A callback over the user rather than a static value: a global
 * descriptor does not know which row is being drawn.
 *
 * The return type is a discriminated union so the two cannot be confused in code either -- an
 * internal target is pushed through the router, an external one is an `<a href>` opened in a new
 * tab, and `href: null` is a configured-but-missing url, which renders disabled with a reason
 * rather than as a dead button.
 */
export type UserSystemManageTarget =
  | { kind: 'internal'; to: RouteLocationRaw }
  | { kind: 'external'; href: string | null }

export interface UserSystemDescriptor<TSystem extends string = string, TUser extends AnzuUser = AnzuUser> {
  system: TSystem
  client: AxiosClientFn
  /** Reaches every `useApiRequest` built for this system; see `permissionGroupApi`. */
  entity: string
  /**
   * Whether the system is switched on in this admin's configuration. Mandatory, not optional: the
   * "disabled in configuration" state has to be *shown*, so leaving the system out of the array is
   * not the same thing. The value is app-specific (`envConfig[system].enabled`) and the library has
   * no way to read it.
   */
  isEnabled: () => boolean
  /**
   * Which validation profile this system's form uses. `false` means only the e-mail is required;
   * `true` adds first name, last name, full name, avatar text and avatar colour. It is a property
   * of the system, and it is the same for creating and for editing.
   */
  requiredMetadata: boolean
  /**
   * Whether the id is typed in. False only in cms, where the backend looks it up in SSO from the
   * e-mail. On an edit the field is read-only regardless.
   */
  idInput: boolean
  extraState?: (user: TUser) => UserSystemExtraState | null
  /** Above the `enabled` switch and in the row of a bulk action. */
  enabledNote?: string
  /** In the metadata repair dialog and in the owning form. */
  metadataNote?: string
  /** In the confirmation dialog when an account is created here. */
  createNote?: string
  endpoints: UserSystemEndpoints
  /** Added in task 2: the system's name as the app translates it. */
  label?: string
  /** Added in task 2. */
  manage?: (user: TUser) => UserSystemManageTarget
}

/**
 * The erasure boundary for a heterogeneous array.
 *
 * Descriptors differ in `TUser` -- blog's `extraState` reaches for `status`, forum's for
 * `settings.banned` -- so an array of them cannot keep each one's type. Without a single place to
 * erase it, `strict: true` would demand a cast in every admin, at every call site. This does it
 * once, where the array is built.
 */
export type AnyUserSystemDescriptor = UserSystemDescriptor<string, AnzuUser>

export const defineUserSystemDescriptor = <TSystem extends string, TUser extends AnzuUser>(
  descriptor: UserSystemDescriptor<TSystem, TUser>
): AnyUserSystemDescriptor => descriptor as unknown as AnyUserSystemDescriptor

/**
 * The pair the probe reads through, with the one invariant the type cannot state: both branches of
 * `endpoints` are nullable, so nothing stops a descriptor naming `probe: 'base'` on a system that
 * has no `/adm/users`. Every admin's descriptor test asserts this resolves for each of its
 * systems.
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
 * Metadata is written through `PATCH /adm/users/{id}` wherever that path exists: the method behind
 * it can only write e-mail, locale, avatar and person -- it has no setter for roles, permissions,
 * groups or `enabled`. That is a stronger guarantee than being careful about what goes in the body.
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
 * `enabled` has no `PATCH` anywhere: the only method that calls `setEnabled` is the full update.
 * So it goes GET + PUT, on the same path, with the whole DTO the GET returned.
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

/** Creating an account goes the same way a write does. */
export const resolveCreateEndpoint = (descriptor: AnyUserSystemDescriptor): string => {
  const base = descriptor.endpoints.base
  if (base !== null) return base.post
  const anzuUser = descriptor.endpoints.anzuUser
  if (anzuUser === null) {
    throw new Error(`[userSystemDescriptor] '${descriptor.system}' has no create path.`)
  }
  return anzuUser.post
}
