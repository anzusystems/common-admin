import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import { isEmailTerm, useUserCrossSystemSearch } from '@/labs/anzuUser/userCrossSystemSearch'
import { CrossSystemPhase, useUserCrossSystemStore } from '@/labs/anzuUser/userCrossSystemStore'
import { defineUserSystemDescriptor, type AnyUserSystemDescriptor } from '@/labs/anzuUser/userSystemDescriptor'
import { UserSystemAccess, UserSystemPresence } from '@/labs/anzuUser/userSystemState'

// The fan-out, and the rules that make it safe rather than merely parallel: one dead backend costs
// its own row and nothing else, a late answer from a previous search is dropped, and an e-mail is
// searched twice -- once to find the person, once by their id, because a system holding a different
// address for them answers nothing the first time and that looks exactly like "no account here".

const record = (over: Record<string, unknown> = {}) => ({
  id: 42,
  email: 'jozef@sme.sk',
  person: { firstName: 'Jozef', lastName: 'Mrkvicka', fullName: 'Jozef Mrkvicka' },
  avatar: { color: '#4CAF50', text: 'JM' },
  enabled: true,
  roles: [],
  permissions: {},
  permissionGroups: [],
  resolvedPermissions: {},
  ...over,
})

const httpError = (status: number) =>
  Object.assign(new Error('failed'), {
    isAxiosError: true,
    config: { url: '/adm/v1/anzu-user/42' },
    response: { status, data: {} },
  })

interface Backend {
  system: string
  /** `GET /adm/v1/anzu-user/:id` — the probe. */
  request: ReturnType<typeof vi.fn>
  /** `GET /adm/v1/anzu-user?filter_eq[email]=…` — round one of an e-mail search. */
  get: ReturnType<typeof vi.fn>
}

const backend = (system: string, over: Partial<Backend> = {}): Backend => ({
  system,
  request: vi.fn().mockResolvedValue({ status: 200, data: record() }),
  get: vi.fn().mockResolvedValue({ status: 200, data: { data: [record()], totalCount: 1 } }),
  ...over,
})

const descriptorsOf = (backends: Backend[]): AnyUserSystemDescriptor[] =>
  backends.map((item) =>
    defineUserSystemDescriptor({
      system: item.system,
      client: () => ({ request: item.request, get: item.get }) as unknown as AxiosInstance,
      entity: 'anzuUser',
      isEnabled: () => true,
      requiredMetadata: false,
      idInput: true,
      endpoints: {
        anzuUser: { get: '/adm/v1/anzu-user/:id', put: '/adm/v1/anzu-user/:id', post: '/adm/v1/anzu-user' },
        base: null,
        permissionGroup: '/adm/v1/permission-group',
        currentUser: '/adm/v1/anzu-user/current',
        list: '/adm/v1/anzu-user',
        probe: 'anzuUser',
      },
    })
  )

const NINE = ['cms', 'contentHub', 'weather', 'dam', 'blog', 'forum', 'smsGateway', 'brick', 'dailyTools']

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('what counts as an e-mail', () => {
  it('tells an address from an id', () => {
    expect(isEmailTerm('jozef@sme.sk')).toBe(true)
    expect(isEmailTerm('42')).toBe(false)
    expect(isEmailTerm(' jozef@sme.sk ')).toBe(true)
  })
})

describe('a term that is neither', () => {
  it('clears the previous person rather than leaving their rows on screen', async () => {
    // The rows are live: their buttons and all three bulk actions write to `resolvedId`, which is
    // still the person found a moment ago, while the box above them now holds a surname. The plan
    // expects exactly this operator -- the one who knows only the name.
    const backends = ['weather', 'blog'].map((system) => backend(system))
    const store = useUserCrossSystemStore()
    const search = useUserCrossSystemSearch({ descriptors: descriptorsOf(backends) })

    expect(await search.search('42')).toBe(true)
    expect(store.results.size).toBe(2)

    expect(await search.search('Mrkvicka')).toBe(false)

    expect(store.results.size).toBe(0)
    expect(store.resolvedId).toBeNull()
    expect(store.phase).toBe(CrossSystemPhase.Idle)
    expect(store.termRejected).toBe(true)
    // And nothing was asked of any backend for it.
    expect(backends.every((item) => item.request.mock.calls.length === 1)).toBe(true)
  })

  it('refuses a zero or a negative id the same way', async () => {
    const backends = [backend('weather')]
    const store = useUserCrossSystemStore()
    const search = useUserCrossSystemSearch({ descriptors: descriptorsOf(backends) })

    expect(await search.search('0')).toBe(false)
    expect(await search.search('-1')).toBe(false)
    expect(await search.search('4.5')).toBe(false)

    expect(backends[0]!.request).not.toHaveBeenCalled()
    expect(store.termRejected).toBe(true)
  })
})

describe('searching by id', () => {
  it('asks every system once -- nine calls, no more', async () => {
    const backends = NINE.map((system) => backend(system))
    const search = useUserCrossSystemSearch({ descriptors: descriptorsOf(backends) })

    await search.search('42')

    expect(backends.every((item) => item.request.mock.calls.length === 1)).toBe(true)
    expect(backends.some((item) => item.get.mock.calls.length > 0)).toBe(false)
  })

  it('lets one dead backend cost its own row and nothing else', async () => {
    const backends = NINE.map((system) =>
      system === 'blog' ? backend(system, { request: vi.fn().mockRejectedValue(httpError(503)) }) : backend(system)
    )
    const store = useUserCrossSystemStore()
    const search = useUserCrossSystemSearch({ descriptors: descriptorsOf(backends) })

    await search.search('42')

    expect(store.phase).toBe(CrossSystemPhase.Done)
    expect(store.results.get('blog')?.axes.access).toBe(UserSystemAccess.Unavailable)
    expect(store.results.get('weather')?.axes.presence).toBe(UserSystemPresence.Present)
    expect([...store.results.keys()]).toHaveLength(9)
  })

  it('reports an absent account as absent, and a forbidden one as forbidden', async () => {
    const backends = [
      backend('weather', { request: vi.fn().mockRejectedValue(httpError(404)) }),
      backend('dam', { request: vi.fn().mockRejectedValue(httpError(403)) }),
    ]
    const store = useUserCrossSystemStore()
    const search = useUserCrossSystemSearch({ descriptors: descriptorsOf(backends) })

    await search.search('42')

    expect(store.results.get('weather')?.axes.presence).toBe(UserSystemPresence.Absent)
    expect(store.results.get('dam')?.axes.access).toBe(UserSystemAccess.Forbidden)
    // Only the one that answered an authoritative 404 counts as resolved.
    expect(search.unresolvedSystems.value).toEqual(['dam'])
  })
})

describe('searching by e-mail', () => {
  it('runs two rounds: nine to find the person, nine to ask by their id', async () => {
    const backends = NINE.map((system) => backend(system))
    const search = useUserCrossSystemSearch({ descriptors: descriptorsOf(backends) })

    await search.search('jozef@sme.sk')

    // The budget the plan sets: 9 by id, 18 by e-mail.
    expect(backends.reduce((sum, item) => sum + item.get.mock.calls.length, 0)).toBe(9)
    expect(backends.reduce((sum, item) => sum + item.request.mock.calls.length, 0)).toBe(9)
  })

  it('asks for an exact match on one row', async () => {
    const backends = [backend('weather')]
    const search = useUserCrossSystemSearch({ descriptors: descriptorsOf(backends) })

    await search.search('jozef@sme.sk')

    const url = decodeURIComponent(backends[0].get.mock.calls[0][0] as string)
    // `startsWith` -- what the list filter uses -- would match `jozko.mrkvicka@sme.sk` for `jozko@`.
    expect(url).toContain('filter_eq[email]=jozef@sme.sk')
    expect(url).toContain('limit=1')
  })

  it('finds the person through the one system that knows the address, then asks the rest by id', async () => {
    // The case the second round exists for: blog holds the same person under a different address,
    // so round one gets nothing from it -- which is indistinguishable from "no account here".
    const backends = [
      backend('weather'),
      backend('blog', {
        get: vi.fn().mockResolvedValue({ status: 200, data: { data: [], totalCount: 0 } }),
        request: vi.fn().mockResolvedValue({ status: 200, data: record({ email: 'j.mrkvicka@sme.sk' }) }),
      }),
    ]
    const store = useUserCrossSystemStore()
    const search = useUserCrossSystemSearch({ descriptors: descriptorsOf(backends) })

    await search.search('jozef@sme.sk')

    expect(store.resolvedId).toBe(42)
    expect(store.results.get('blog')?.user?.email).toBe('j.mrkvicka@sme.sk')
    expect(store.results.get('blog')?.axes.presence).toBe(UserSystemPresence.Present)
  })

  it('stops on two ids behind one address rather than picking the first', async () => {
    const backends = [
      backend('weather'),
      backend('blog', {
        get: vi.fn().mockResolvedValue({ status: 200, data: { data: [record({ id: 99 })], totalCount: 1 } }),
      }),
    ]
    const store = useUserCrossSystemStore()
    const search = useUserCrossSystemSearch({ descriptors: descriptorsOf(backends) })

    await search.search('jozef@sme.sk')

    // Picking one quietly would have every later fan-out follow the wrong identity, and nothing
    // written under it could be taken back.
    expect(store.identityConflict).not.toBeNull()
    expect(store.resolvedId).toBeNull()
    // The second round never runs.
    expect(backends[0].request).not.toHaveBeenCalled()
  })

  it('leaves every row unknown when nobody holds the address', async () => {
    const backends = NINE.map((system) =>
      backend(system, { get: vi.fn().mockResolvedValue({ status: 200, data: { data: [], totalCount: 0 } }) })
    )
    const store = useUserCrossSystemStore()
    const search = useUserCrossSystemSearch({ descriptors: descriptorsOf(backends) })

    await search.search('nobody@sme.sk')

    // An address search cannot prove absence -- only an id search can. Nothing is marked absent,
    // and no second round runs.
    expect(store.phase).toBe(CrossSystemPhase.Done)
    expect(store.results.size).toBe(0)
    expect(backends.every((item) => item.request.mock.calls.length === 0)).toBe(true)
  })
})

describe('results that arrive late', () => {
  it('drops the answers of a search the operator has moved on from', async () => {
    let releaseFirst: (value: unknown) => void = () => {}
    const slow = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (releaseFirst = resolve)))
      .mockResolvedValue({ status: 200, data: record({ id: 7, email: 'second@sme.sk' }) })
    const backends = [backend('weather', { request: slow })]
    const store = useUserCrossSystemStore()
    const search = useUserCrossSystemSearch({ descriptors: descriptorsOf(backends) })

    const first = search.search('42')
    await search.search('7')
    releaseFirst({ status: 200, data: record({ id: 42, email: 'first@sme.sk' }) })
    await first

    expect(store.resolvedId).toBe(7)
    expect(store.results.get('weather')?.user?.email).toBe('second@sme.sk')
  })

  it('stops the requests as well as discarding them', async () => {
    // Cancelled while one is still on the wire, which is the only moment there is anything to stop:
    // leaving the page mid-search would otherwise leave up to eighteen calls running against
    // backends nobody is waiting for any more. The token alone only discards the answers.
    let release: (value: unknown) => void = () => {}
    const slow = vi.fn().mockImplementation(() => new Promise((resolve) => (release = resolve)))
    const backends = [backend('weather', { request: slow })]
    const search = useUserCrossSystemSearch({ descriptors: descriptorsOf(backends) })

    const running = search.search('42')
    await vi.waitFor(() => expect(slow).toHaveBeenCalled())
    search.cancel()

    const config = slow.mock.calls[0][0] as { signal?: AbortSignal }
    expect(config.signal?.aborted).toBe(true)

    release({ status: 200, data: record() })
    await running
  })
})

describe('refreshing one row after a write', () => {
  it('re-reads only the system that was written to', async () => {
    const backends = [backend('weather'), backend('brick')]
    const search = useUserCrossSystemSearch({ descriptors: descriptorsOf(backends) })

    await search.search('42')
    await search.refreshSystem('weather')

    // Otherwise the row goes on showing what it showed before the write.
    expect(backends[0].request.mock.calls).toHaveLength(2)
    expect(backends[1].request.mock.calls).toHaveLength(1)
  })
})
