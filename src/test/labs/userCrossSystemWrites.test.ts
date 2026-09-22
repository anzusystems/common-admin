import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import { BulkOutcome } from '@/labs/anzuUser/userCrossSystemStore'
import { classifyWriteStatus, useUserCrossSystemWrites } from '@/labs/anzuUser/userCrossSystemWrites'
import { probeStatusFromError } from '@/labs/anzuUser/userSystemProbe'
import { mapApiError } from '@/labs/api/apiErrors'
import { defineUserSystemDescriptor, type UserSystemEndpoints } from '@/labs/anzuUser/userSystemDescriptor'
import type { AnzuUser } from '@/types/AnzuUser'

// The write invariant, pinned.
//
// An omitted field is not neutral, it is destructive: `UserDto` defaults `roles` to `[ROLE_USER]`,
// `enabled` to true and both permission collections to empty, and `updateAnzuUser` writes all four
// unconditionally. A body of "just the field I am changing" resets the roles, wipes the grants,
// detaches the groups and switches a disabled account back on. On `/adm/users` in cms it goes
// further: that PUT also runs `updateRelations()` over seven scalars and twelve collections.

const anzuUserOnly: UserSystemEndpoints = {
  anzuUser: { get: '/adm/v1/anzu-user/:id', put: '/adm/v1/anzu-user/:id', post: '/adm/v1/anzu-user' },
  base: null,
  permissionGroup: '/adm/v1/permission-group',
  currentUser: '/adm/v1/anzu-user/current',
  list: '/adm/v1/anzu-user',
  probe: 'anzuUser',
}

const withBase: UserSystemEndpoints = {
  ...anzuUserOnly,
  base: { get: '/adm/users/:id', put: '/adm/users/:id', patch: '/adm/users/:id', post: '/adm/users' },
  probe: 'base',
}

const stored = (over: Partial<AnzuUser> = {}) =>
  ({
    id: 42,
    email: 'jozef@sme.sk',
    person: { firstName: 'Jozef', lastName: 'Mrkvicka', fullName: 'Jozef Mrkvicka' },
    avatar: { color: '#4CAF50', text: 'JM' },
    enabled: true,
    locale: 'sk',
    roles: ['ROLE_EDITOR'],
    permissions: { weather_location_ui: 2 },
    permissionGroups: [7, 9],
    resolvedPermissions: {},
    createdAt: '2026-01-01T00:00:00.000000Z',
    modifiedAt: '2026-01-01T00:00:00.000000Z',
    createdBy: 1,
    modifiedBy: 1,
    _system: 'weather',
    _resourceName: 'user',
    ...over,
  }) as unknown as AnzuUser

const descriptorFor = (request: ReturnType<typeof vi.fn>, endpoints: UserSystemEndpoints) =>
  defineUserSystemDescriptor({
    system: 'weather',
    client: () => ({ request }) as unknown as AxiosInstance,
    entity: 'anzuUser',
    isEnabled: () => true,
    requiredMetadata: false,
    idInput: true,
    endpoints,
  })

/** The helper serialises the body, so a test reading it has to parse it back. */
const sentBody = (request: ReturnType<typeof vi.fn>, call: number) => JSON.parse(request.mock.calls[call][0].data)

const httpError = (status: number, data: Record<string, unknown> = {}) =>
  Object.assign(new Error('failed'), {
    isAxiosError: true,
    config: { url: '/adm/v1/anzu-user/42' },
    response: { status, data },
  })

/**
 * What a 422 really looks like: `ValidationExceptionHandler` answers
 * `{ error: 'validation_failed', fields, contextId }`. An empty body is not a 422 any backend
 * sends, and a fixture with one would map to a different error class than production does -- which
 * is how a test can certify the opposite of what happens.
 */
const validationError = () =>
  httpError(422, { error: 'validation_failed', contextId: 'x', fields: { 'avatar.color': ['invalid'] } })

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('switching an account on or off', () => {
  it('reads first and sends the whole record back', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, data: stored() })
      .mockResolvedValueOnce({ status: 200, data: stored({ enabled: false }) })

    const result = await useUserCrossSystemWrites().setEnabled(descriptorFor(request, anzuUserOnly), 42, false)

    expect(result.outcome).toBe(BulkOutcome.Done)
    const write = request.mock.calls[1][0]
    const body = sentBody(request, 1)
    expect(write.method.toUpperCase()).toBe('PUT')
    expect(body.enabled).toBe(false)
    // Everything the caller is not changing has to survive the round trip.
    expect(body.roles).toEqual(['ROLE_EDITOR'])
    expect(body.permissions).toEqual({ weather_location_ui: 2 })
    expect(body.permissionGroups).toEqual([7, 9])
    expect(body.locale).toBe('sk')
    expect(body.id).toBe(42)
  })

  it('writes nothing when the account is already in the requested state', async () => {
    const request = vi.fn().mockResolvedValueOnce({ status: 200, data: stored({ enabled: false }) })

    const result = await useUserCrossSystemWrites().setEnabled(descriptorFor(request, anzuUserOnly), 42, false)

    // A no-op PUT would still run `updateRelations()` in cms -- risk for nothing.
    expect(request).toHaveBeenCalledTimes(1)
    expect(result.outcome).toBe(BulkOutcome.Done)
  })

  it('reads and writes on the same path, which is the one the invariant names', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, data: stored() })
      .mockResolvedValueOnce({ status: 200, data: stored({ enabled: false }) })

    await useUserCrossSystemWrites().setEnabled(descriptorFor(request, withBase), 42, false)

    expect(request.mock.calls[0][0].url).toBe('/adm/users/42')
    expect(request.mock.calls[1][0].url).toBe('/adm/users/42')
  })
})

describe('writing metadata', () => {
  it('goes through PATCH wherever that path exists', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, data: stored() })
      .mockResolvedValueOnce({ status: 200, data: stored() })

    await useUserCrossSystemWrites().writeMetadata(descriptorFor(request, withBase), 42, {
      id: 42,
      email: 'jozef@sme.sk',
      person: { firstName: 'Jozef', lastName: 'Novak', fullName: 'Jozef Novak' },
      avatar: { color: '#4CAF50', text: 'JN' },
    })

    // The method behind PATCH has no setter for roles, grants, groups or `enabled` -- a stronger
    // guarantee than a carefully assembled body.
    expect(request.mock.calls[1][0].method.toUpperCase()).toBe('PATCH')
  })

  it('falls back to the full PUT where there is no PATCH', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, data: stored() })
      .mockResolvedValueOnce({ status: 200, data: stored() })

    await useUserCrossSystemWrites().writeMetadata(descriptorFor(request, anzuUserOnly), 42, {
      id: 42,
      email: 'jozef@sme.sk',
      person: { firstName: 'Jozef', lastName: 'Novak', fullName: 'Jozef Novak' },
      avatar: { color: '#4CAF50', text: 'JN' },
    })

    const write = request.mock.calls[1][0]
    const body = sentBody(request, 1)
    expect(write.method.toUpperCase()).toBe('PUT')
    expect(body.roles).toEqual(['ROLE_EDITOR'])
    expect(body.enabled).toBe(true)
  })

  it('always carries the id, which is the one field nobody expects and which fails every account', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, data: stored() })
      .mockResolvedValueOnce({ status: 200, data: stored() })

    await useUserCrossSystemWrites().writeMetadata(descriptorFor(request, withBase), 42, {
      id: 42,
      email: 'novy@sme.sk',
      person: { firstName: 'Jozef', lastName: 'Mrkvicka', fullName: 'Jozef Mrkvicka' },
      avatar: { color: '#4CAF50', text: 'JM' },
    })

    // The uniqueness validator only excludes the record itself when the DTO carries a non-empty id;
    // without it the server reports the user's own e-mail as already taken.
    expect(sentBody(request, 1).id).toBe(42)
  })

  it('does not write to a system that already holds the value', async () => {
    const request = vi.fn().mockResolvedValueOnce({ status: 200, data: stored() })

    const result = await useUserCrossSystemWrites().writeMetadata(descriptorFor(request, withBase), 42, {
      id: 42,
      email: 'jozef@sme.sk',
      person: { firstName: 'Jozef', lastName: 'Mrkvicka', fullName: 'Jozef Mrkvicka' },
      avatar: { color: '#4CAF50', text: 'JM' },
    })

    expect(request).toHaveBeenCalledTimes(1)
    expect(result.changed).toBe(false)
  })

  it('compares against a reading taken immediately before the write', async () => {
    // Not against what the search found: those results can be hours old, and a value changed
    // meanwhile would be overwritten with what the operator saw rather than what is there.
    const request = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, data: stored({ email: 'changed@sme.sk' }) })
      .mockResolvedValueOnce({ status: 200, data: stored() })

    await useUserCrossSystemWrites().writeMetadata(descriptorFor(request, withBase), 42, {
      id: 42,
      email: 'jozef@sme.sk',
      person: { firstName: 'Jozef', lastName: 'Mrkvicka', fullName: 'Jozef Mrkvicka' },
      avatar: { color: '#4CAF50', text: 'JM' },
    })

    expect(request).toHaveBeenCalledTimes(2)
    expect(sentBody(request, 1).email).toBe('jozef@sme.sk')
  })

  it('names the fields somebody else changed between the search and the write', async () => {
    // Decision 24: the operator's value still wins -- that is what they asked for -- but the record
    // moved under them, and the log line says which fields rather than letting it pass unnoticed.
    const request = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, data: stored({ email: 'somebody-else@sme.sk' }) })
      .mockResolvedValueOnce({ status: 200, data: stored() })

    const result = await useUserCrossSystemWrites().writeMetadata(
      descriptorFor(request, withBase),
      42,
      stored({ email: 'jozef.novy@sme.sk' }),
      undefined,
      // What the search showed. The stored value now matches neither this nor the target.
      stored()
    )

    expect(result.concurrentFields).toEqual(['email'])
    expect(result.changed).toBe(true)
  })

  it('says nothing when the stored value is still the one the search showed', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, data: stored() })
      .mockResolvedValueOnce({ status: 200, data: stored() })

    const result = await useUserCrossSystemWrites().writeMetadata(
      descriptorFor(request, withBase),
      42,
      stored({ email: 'jozef.novy@sme.sk' }),
      undefined,
      stored()
    )

    expect(result.concurrentFields).toEqual([])
  })
})

describe('creating an account', () => {
  it('posts to the create path of that system', async () => {
    const request = vi.fn().mockResolvedValue({ status: 201, data: stored() })

    await useUserCrossSystemWrites().createInSystem(descriptorFor(request, withBase), stored({ roles: [] }))

    expect(request.mock.calls[0][0].url).toBe('/adm/users')
    expect(request.mock.calls[0][0].method.toUpperCase()).toBe('POST')
    expect(sentBody(request, 0).roles).toEqual([])
  })
})

describe('the bulk log', () => {
  const storeModule = () => import('@/labs/anzuUser/userCrossSystemStore')

  it('keeps what it already said about the systems a retry does not touch', async () => {
    // "Try the failed ones again" runs a subset. Resetting the whole log would erase the systems
    // that succeeded, and a partial success would read as if it had never happened.
    const { useUserCrossSystemStore: useStore, BulkAction, BulkOutcome: Outcome } = await storeModule()
    const store = useStore()

    store.startBulk(BulkAction.Disable, ['cms', 'dam'], 42)
    store.setBulkEntry('cms', Outcome.Done)
    store.setBulkEntry('dam', Outcome.Forbidden)
    store.finishBulk()

    store.startBulk(BulkAction.Disable, ['dam'], 42)

    expect(store.bulkLog.find((entry) => entry.system === 'cms')?.outcome).toBe(Outcome.Done)
    expect(store.bulkLog.find((entry) => entry.system === 'dam')?.outcome).toBe(Outcome.Pending)
  })

  it('does not carry a failed metadata repair into an enable or a disable run', async () => {
    // The repair writes into this same log, the retry button acts on whatever the log calls failed,
    // and the overview always performs the *currently selected* enable or disable. Unscoped, a 422
    // on a repair would come back as "retry" on a screen whose button disables the account -- in
    // blog and forum the switch whose own row warns that it closes the public account as well.
    const { useUserCrossSystemStore: useStore, BulkAction, BulkOutcome: Outcome } = await storeModule()
    const store = useStore()

    store.startBulk(BulkAction.Metadata, ['blog'], 42)
    store.setBulkEntry('blog', Outcome.Invalid)
    store.finishBulk()

    store.startBulk(BulkAction.Disable, ['cms'], 42)

    expect(store.bulkLog.map((entry) => entry.system)).toEqual(['cms'])
  })

  it("does not carry one account's failures into a run about another", async () => {
    // A new search replaces `resolvedId` and leaves the log alone unless something clears it, and
    // every retry writes to whatever `resolvedId` holds by then.
    const { useUserCrossSystemStore: useStore, BulkAction, BulkOutcome: Outcome } = await storeModule()
    const store = useStore()

    store.startBulk(BulkAction.Disable, ['cms'], 42)
    store.setBulkEntry('cms', Outcome.Forbidden)
    store.finishBulk()

    // What a new search does first.
    store.resetResults()

    expect(store.bulkLog).toEqual([])
  })
})

describe('what the operator is told', () => {
  it('names a validation failure as one, because legacy accounts hit it on a plain disable', async () => {
    // A stored avatar colour that no longer passes `CssColor`, or an e-mail another AnzuUser has
    // taken meanwhile: the PUT validates the whole body, so even "just disable them" answers 422.
    const request = vi.fn().mockRejectedValue(validationError())

    const result = await useUserCrossSystemWrites().setEnabled(descriptorFor(request, anzuUserOnly), 42, false)

    expect(result.outcome).toBe(BulkOutcome.Invalid)
  })

  it('reads the status off a 422 that arrives as a validation error, not as a transport failure', async () => {
    // `AnzuApiValidationError` extends `AnzuError`, not `AnzuApiAxiosError`, so a reader that goes
    // by class alone sees nothing and files it as "the system did not answer".
    expect(probeStatusFromError(mapApiError(validationError(), { system: 'test', entity: 'test' }))).toBe(422)
  })

  it('maps the rest of the statuses apart', () => {
    expect(classifyWriteStatus(403)).toBe(BulkOutcome.Forbidden)
    expect(classifyWriteStatus(401)).toBe(BulkOutcome.Unauthenticated)
    expect(classifyWriteStatus(404)).toBe(BulkOutcome.NotFound)
    expect(classifyWriteStatus(400)).toBe(BulkOutcome.Invalid)
    expect(classifyWriteStatus(500)).toBe(BulkOutcome.Unavailable)
    expect(classifyWriteStatus(null)).toBe(BulkOutcome.Unavailable)
  })
})
