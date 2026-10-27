/**
 * Four independent axes, one derived state.
 * Collapsing them early conflated "no access" with "no account" and offered Create in unreadable systems.
 */
export const UserSystemLoad = {
  Idle: 'idle',
  Loading: 'loading',
  Loaded: 'loaded',
  Error: 'error',
} as const
export type UserSystemLoadType = (typeof UserSystemLoad)[keyof typeof UserSystemLoad]

export const UserSystemPresence = {
  Present: 'present',
  Absent: 'absent',
  Unknown: 'unknown',
} as const
export type UserSystemPresenceType = (typeof UserSystemPresence)[keyof typeof UserSystemPresence]

export const UserSystemAccess = {
  Ok: 'ok',
  Forbidden: 'forbidden',
  Unauthenticated: 'unauthenticated',
  Unavailable: 'unavailable',
  ConfigDisabled: 'configDisabled',
} as const
export type UserSystemAccessType = (typeof UserSystemAccess)[keyof typeof UserSystemAccess]

/**
 * `enabled` is an axis so "here and on" and "here and off" can be told apart.
 * Ownership is not an axis; the descriptor's `manage` decides the button.
 */
export interface UserSystemAxes {
  load: UserSystemLoadType
  presence: UserSystemPresenceType
  access: UserSystemAccessType
  enabled: boolean | 'unknown'
}

export const UserSystemState = {
  /**
   * Nothing has been asked yet, or the answer is still on its way.
   */
  Loading: 'loading',
  Enabled: 'enabled',
  Disabled: 'disabled',
  Absent: 'absent',
  Forbidden: 'forbidden',
  Unavailable: 'unavailable',
  ConfigDisabled: 'configDisabled',
} as const
export type UserSystemStateType = (typeof UserSystemState)[keyof typeof UserSystemState]

export const emptyUserSystemAxes = (): UserSystemAxes => ({
  load: UserSystemLoad.Idle,
  presence: UserSystemPresence.Unknown,
  access: UserSystemAccess.Ok,
  enabled: 'unknown',
})

/**
 * Order matters. Config-disabled wins over everything.
 * Access is checked before presence because a forbidden record is not an absent one.
 */
export const resolveUserSystemState = (axes: UserSystemAxes): UserSystemStateType => {
  if (axes.access === UserSystemAccess.ConfigDisabled) return UserSystemState.ConfigDisabled
  if (axes.access === UserSystemAccess.Forbidden) return UserSystemState.Forbidden
  if (axes.access === UserSystemAccess.Unauthenticated || axes.access === UserSystemAccess.Unavailable) {
    return UserSystemState.Unavailable
  }
  if (axes.load === UserSystemLoad.Idle || axes.load === UserSystemLoad.Loading) return UserSystemState.Loading
  if (axes.presence === UserSystemPresence.Absent) return UserSystemState.Absent
  if (axes.presence === UserSystemPresence.Unknown) return UserSystemState.Unavailable
  return axes.enabled === true ? UserSystemState.Enabled : UserSystemState.Disabled
}

/**
 * 401 is its own case: an expired session must not show as "no account here" (decision 16).
 * The caller retries through its refresh hook first; this receives the verdict.
 * 422 has no case: a detail GET does not validate. A 422 belongs to the write log.
 */
export const classifyProbeStatus = (status: number | null): Pick<UserSystemAxes, 'presence' | 'access'> => {
  if (status === null) {
    // A timeout, a network failure, or anything that never reached a status.
    return { presence: UserSystemPresence.Unknown, access: UserSystemAccess.Unavailable }
  }
  if (status === 404) return { presence: UserSystemPresence.Absent, access: UserSystemAccess.Ok }
  if (status === 403) return { presence: UserSystemPresence.Unknown, access: UserSystemAccess.Forbidden }
  if (status === 401) return { presence: UserSystemPresence.Unknown, access: UserSystemAccess.Unauthenticated }
  if (status >= 500) return { presence: UserSystemPresence.Unknown, access: UserSystemAccess.Unavailable }
  if (status >= 200 && status < 300) return { presence: UserSystemPresence.Present, access: UserSystemAccess.Ok }
  return { presence: UserSystemPresence.Unknown, access: UserSystemAccess.Unavailable }
}

/**
 * Whether every relevant system answered authoritatively that the account does not exist.
 * Account creation is offered only then. An unreadable record is not a missing one, and
 * an AnzuUser cannot be deleted, so a duplicate created on a guess cannot be undone.
 */
export const isAuthoritativelyAbsent = (axes: UserSystemAxes): boolean =>
  axes.load === UserSystemLoad.Loaded &&
  axes.presence === UserSystemPresence.Absent &&
  axes.access === UserSystemAccess.Ok

/**
 * A system a bulk action may act on: it answered, the account is there, and access was granted.
 */
export const isActionable = (axes: UserSystemAxes): boolean =>
  axes.load === UserSystemLoad.Loaded &&
  axes.presence === UserSystemPresence.Present &&
  axes.access === UserSystemAccess.Ok
