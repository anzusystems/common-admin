/**
 * Four independent axes inside, one derived state outside.
 *
 * The axes are kept apart because they answer different questions and can move independently: a
 * system can be loaded and forbidden, or absent and still enabled in configuration. Collapsing
 * them into one enum early is what made the per-admin prototypes conflate "no access" with "no
 * account here" -- admin-cms's panel leaves `userExists` at null on any non-404 and offers
 * "Create" in a system the operator cannot even read.
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
 * `enabled` is one of the axes and not a detail: without it the two states the cross-system view
 * shows most often -- "the account is here and on" versus "here and off" -- cannot be told apart.
 *
 * Ownership is deliberately *not* an axis. None of the six visual states below distinguishes it;
 * it decides which button is drawn, and that is the descriptor's `manage` union.
 */
export interface UserSystemAxes {
  load: UserSystemLoadType
  presence: UserSystemPresenceType
  access: UserSystemAccessType
  enabled: boolean | 'unknown'
}

export const UserSystemState = {
  /** Nothing has been asked yet, or the answer is still on its way. */
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
 * The single closed function from axes to what is drawn. Order matters: a system switched off in
 * configuration is reported as such whatever else is known about it, and access is decided before
 * presence because a forbidden record is not an absent one.
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
 * How a probe response becomes axes.
 *
 * 401 is its own case and it is not a detail. A first 401 is ambiguous -- an expired session looks
 * exactly like "no account here" -- and since the buttons are gated by this answer alone, showing
 * an expired token as "no account here" is the one confusion decision 16 forbids. The caller is
 * expected to have retried through its refresh hook before classifying; what arrives here is the
 * verdict after that retry.
 *
 * 422 deliberately has no case. A detail GET loads the record and returns it; it does not validate
 * a body. A 422 belongs to the log of writes.
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
 * Whether the probe answered authoritatively that nobody is there.
 *
 * Creating an account is offered only when every relevant system said so. A record that could not
 * be read is not a record that does not exist, and since no admin can delete an AnzuUser, a
 * duplicate identity created on a guess cannot be taken back.
 */
export const isAuthoritativelyAbsent = (axes: UserSystemAxes): boolean =>
  axes.load === UserSystemLoad.Loaded &&
  axes.presence === UserSystemPresence.Absent &&
  axes.access === UserSystemAccess.Ok

/** A system a bulk action may act on: it answered, the account is there, and access was granted. */
export const isActionable = (axes: UserSystemAxes): boolean =>
  axes.load === UserSystemLoad.Loaded &&
  axes.presence === UserSystemPresence.Present &&
  axes.access === UserSystemAccess.Ok
