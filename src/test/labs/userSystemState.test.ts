import { describe, expect, it } from 'vitest'
import {
  classifyProbeStatus,
  emptyUserSystemAxes,
  isActionable,
  isAuthoritativelyAbsent,
  resolveUserSystemState,
  UserSystemAccess,
  UserSystemLoad,
  UserSystemPresence,
  UserSystemState,
  type UserSystemAxes,
} from '@/labs/anzuUser/userSystemState'

const axes = (over: Partial<UserSystemAxes> = {}): UserSystemAxes => ({
  ...emptyUserSystemAxes(),
  load: UserSystemLoad.Loaded,
  ...over,
})

describe('probe classification', () => {
  it('reads 404 as an answer about the account, not about access', () => {
    expect(classifyProbeStatus(404)).toEqual({
      presence: UserSystemPresence.Absent,
      access: UserSystemAccess.Ok,
    })
  })

  it('never reads 403 as "no account here"', () => {
    // The prototype this replaces left `userExists` at null on any non-404 and offered Create in a
    // system the operator cannot even read.
    const result = classifyProbeStatus(403)

    expect(result.access).toBe(UserSystemAccess.Forbidden)
    expect(result.presence).toBe(UserSystemPresence.Unknown)
  })

  it('keeps 401 apart from both', () => {
    expect(classifyProbeStatus(401)).toEqual({
      presence: UserSystemPresence.Unknown,
      access: UserSystemAccess.Unauthenticated,
    })
  })

  it('treats no answer and a server failure the same way', () => {
    expect(classifyProbeStatus(null).access).toBe(UserSystemAccess.Unavailable)
    expect(classifyProbeStatus(503).access).toBe(UserSystemAccess.Unavailable)
  })

  it('has no case for 422, which belongs to writes', () => {
    // A detail GET loads a record and returns it; it does not validate a body.
    expect(classifyProbeStatus(422).access).toBe(UserSystemAccess.Unavailable)
    expect(classifyProbeStatus(422).presence).toBe(UserSystemPresence.Unknown)
  })
})

describe('derived state', () => {
  it('tells an account that is on from one that is off', () => {
    const present = { presence: UserSystemPresence.Present, access: UserSystemAccess.Ok }

    expect(resolveUserSystemState(axes({ ...present, enabled: true }))).toBe(UserSystemState.Enabled)
    expect(resolveUserSystemState(axes({ ...present, enabled: false }))).toBe(UserSystemState.Disabled)
  })

  it('reports a system switched off in configuration whatever else is known', () => {
    expect(
      resolveUserSystemState(
        axes({ access: UserSystemAccess.ConfigDisabled, presence: UserSystemPresence.Present, enabled: true })
      )
    ).toBe(UserSystemState.ConfigDisabled)
  })

  it('keeps "no access" and "no account here" as different states', () => {
    expect(resolveUserSystemState(axes({ access: UserSystemAccess.Forbidden }))).toBe(UserSystemState.Forbidden)
    expect(resolveUserSystemState(axes({ presence: UserSystemPresence.Absent }))).toBe(UserSystemState.Absent)
  })

  it('is loading until something has answered', () => {
    expect(resolveUserSystemState(emptyUserSystemAxes())).toBe(UserSystemState.Loading)
    expect(resolveUserSystemState(axes({ load: UserSystemLoad.Loading }))).toBe(UserSystemState.Loading)
  })

  it('does not claim an account is absent when nothing answered', () => {
    expect(resolveUserSystemState(axes({ presence: UserSystemPresence.Unknown }))).toBe(UserSystemState.Unavailable)
  })
})

describe('authority', () => {
  it('counts only a loaded, authoritative 404 as absence', () => {
    expect(isAuthoritativelyAbsent(axes({ presence: UserSystemPresence.Absent }))).toBe(true)
    // A record that could not be read is not a record that does not exist -- and no admin can
    // delete an AnzuUser, so a duplicate identity cannot be taken back.
    expect(isAuthoritativelyAbsent(axes({ access: UserSystemAccess.Forbidden }))).toBe(false)
    expect(isAuthoritativelyAbsent(axes({ access: UserSystemAccess.Unavailable }))).toBe(false)
    expect(isAuthoritativelyAbsent(axes({ load: UserSystemLoad.Loading, presence: UserSystemPresence.Absent }))).toBe(
      false
    )
  })

  it('lets a bulk action touch only a system that answered with a record', () => {
    expect(isActionable(axes({ presence: UserSystemPresence.Present, enabled: true }))).toBe(true)
    expect(isActionable(axes({ presence: UserSystemPresence.Absent }))).toBe(false)
    expect(isActionable(axes({ access: UserSystemAccess.Unavailable }))).toBe(false)
  })
})
