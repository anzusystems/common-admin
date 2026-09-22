import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import { defineUserSystemDescriptor, type UserSystemEndpoints } from '@/labs/anzuUser/userSystemDescriptor'
import { useUserSystemProbe } from '@/labs/anzuUser/userSystemProbe'
import { UserSystemAccess, UserSystemLoad, UserSystemPresence } from '@/labs/anzuUser/userSystemState'

const endpoints = (over: Partial<UserSystemEndpoints> = {}): UserSystemEndpoints => ({
  anzuUser: { get: '/adm/v1/anzu-user/:id', put: '/adm/v1/anzu-user/:id', post: '/adm/v1/anzu-user' },
  base: {
    get: '/adm/users/:id',
    put: '/adm/users/:id',
    patch: '/adm/users/:id',
    post: '/adm/users',
  },
  permissionGroup: '/adm/v1/permission-group',
  currentUser: '/adm/v1/anzu-user/current',
  list: '/adm/v1/anzu-user',
  probe: 'anzuUser',
  ...over,
})

const record = (over: Record<string, unknown> = {}) => ({
  id: 42,
  email: 'jozef@sme.sk',
  person: { firstName: 'Jozef', lastName: 'Mrkvicka', fullName: 'Jozef Mrkvicka' },
  avatar: { color: '#4CAF50', text: 'JM' },
  enabled: true,
  ...over,
})

const httpError = (status: number) =>
  Object.assign(new Error('failed'), {
    isAxiosError: true,
    config: { url: '/adm/v1/anzu-user/42' },
    response: { status, data: {} },
  })

const build = (request: ReturnType<typeof vi.fn>, over: Record<string, unknown> = {}) =>
  defineUserSystemDescriptor({
    system: 'weather',
    client: () => ({ request }) as unknown as AxiosInstance,
    entity: 'anzuUser',
    isEnabled: () => true,
    requiredMetadata: false,
    idInput: true,
    endpoints: endpoints(),
    ...over,
  })

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useUserSystemProbe', () => {
  it('reports a system switched off in configuration without asking it anything', async () => {
    const request = vi.fn()
    const probe = useUserSystemProbe({ descriptor: build(request, { isEnabled: () => false }) })

    await probe.probe(42)

    expect(request).not.toHaveBeenCalled()
    expect(probe.axes.value.access).toBe(UserSystemAccess.ConfigDisabled)
  })

  it('takes the enabled flag from the record it found', async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, data: record({ enabled: false }) })
    const probe = useUserSystemProbe({ descriptor: build(request) })

    await probe.probe(42)

    expect(probe.axes.value.presence).toBe(UserSystemPresence.Present)
    expect(probe.axes.value.enabled).toBe(false)
    expect(probe.user.value?.email).toBe('jozef@sme.sk')
  })

  it('reads 404 as absent and 403 as forbidden, never the other way round', async () => {
    const absent = vi.fn().mockRejectedValue(httpError(404))
    const forbidden = vi.fn().mockRejectedValue(httpError(403))

    const a = useUserSystemProbe({ descriptor: build(absent) })
    await a.probe(42)
    expect(a.axes.value.presence).toBe(UserSystemPresence.Absent)
    expect(a.axes.value.access).toBe(UserSystemAccess.Ok)

    const b = useUserSystemProbe({ descriptor: build(forbidden) })
    await b.probe(42)
    expect(b.axes.value.access).toBe(UserSystemAccess.Forbidden)
    expect(b.axes.value.presence).toBe(UserSystemPresence.Unknown)
  })

  it('asks again after a 401 the hook could refresh, and then answers about the account', async () => {
    const request = vi.fn().mockRejectedValueOnce(httpError(401)).mockResolvedValueOnce({ status: 200, data: record() })
    const refreshHook = vi.fn().mockResolvedValue(true)

    const probe = useUserSystemProbe({ descriptor: build(request), refreshHook })
    await probe.probe(42)

    expect(refreshHook).toHaveBeenCalledWith('weather')
    expect(probe.axes.value.presence).toBe(UserSystemPresence.Present)
  })

  it('calls an unrefreshable 401 unverified, never "no account here"', async () => {
    const request = vi.fn().mockRejectedValue(httpError(401))
    const refreshHook = vi.fn().mockResolvedValue(false)

    const probe = useUserSystemProbe({ descriptor: build(request), refreshHook })
    await probe.probe(42)

    // Decision 16: an expired session and a missing account must not look the same.
    expect(probe.axes.value.access).toBe(UserSystemAccess.Unauthenticated)
    expect(probe.axes.value.presence).not.toBe(UserSystemPresence.Absent)
  })

  it('says unverified when there is no hook at all', async () => {
    const request = vi.fn().mockRejectedValue(httpError(401))

    const probe = useUserSystemProbe({ descriptor: build(request) })
    await probe.probe(42)

    expect(probe.axes.value.access).toBe(UserSystemAccess.Unauthenticated)
  })

  it('reads through the path the descriptor names', async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, data: record() })

    // dam names `base` on purpose: `/adm/v1/anzu-user` has no gating there, so only the other path
    // can ever render "you have no access".
    const probe = useUserSystemProbe({
      descriptor: build(request, { endpoints: endpoints({ probe: 'base' }) }),
    })
    await probe.probe(42)

    expect(request.mock.calls[0][0].url).toBe('/adm/users/42')
  })

  it('drops the answer to a probe that was superseded', async () => {
    let releaseFirst: (value: unknown) => void = () => {}
    const request = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)))
      .mockResolvedValueOnce({ status: 200, data: record({ email: 'second@sme.sk' }) })

    const probe = useUserSystemProbe({ descriptor: build(request) })
    const first = probe.probe(42)
    await probe.probe(43)
    releaseFirst({ status: 200, data: record({ email: 'first@sme.sk' }) })
    await first

    expect(probe.user.value?.email).toBe('second@sme.sk')
  })

  it('goes back to idle when reset', async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, data: record() })
    const probe = useUserSystemProbe({ descriptor: build(request) })

    await probe.probe(42)
    probe.reset()

    expect(probe.axes.value.load).toBe(UserSystemLoad.Idle)
    expect(probe.user.value).toBeNull()
  })
})
