import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import { useLanguageSettings } from '@/composables/languageSettings'
import { usePermissionConfigActions } from '@/labs/permissionConfig/permissionConfigActions'

// The three per-admin versions this replaces shared one `loading` and one `initialized` boolean
// across every system they fetched. With a parallel fan-out that is wrong twice over: the first
// answer cleared the flag for all of them, and the first failure left it set for the session
// because there was no `finally`.

const configFor = (subject: string) => ({
  roles: [],
  defaultGrants: [0, 1, 2],
  config: { [subject]: { view: {} } },
  translation: { subjects: {}, actions: {}, roles: {} },
})

const clientAnswering = (request: ReturnType<typeof vi.fn>) => () => ({ request }) as unknown as AxiosInstance

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('usePermissionConfigActions', () => {
  it('keeps one config per system', async () => {
    const weather = vi.fn().mockResolvedValue({ status: 200, data: configFor('location') })
    const brick = vi.fn().mockResolvedValue({ status: 200, data: configFor('page') })

    const a = usePermissionConfigActions({ client: clientAnswering(weather), system: 'weather' })
    const b = usePermissionConfigActions({ client: clientAnswering(brick), system: 'brick' })
    await a.fetchPermissionConfig()
    await b.fetchPermissionConfig()

    expect(Object.keys(a.permissionConfig.value.config)).toEqual(['location'])
    expect(Object.keys(b.permissionConfig.value.config)).toEqual(['page'])
  })

  it('clears loading for the failing system only, and leaves the other loaded', async () => {
    const dead = vi.fn().mockRejectedValue(Object.assign(new Error('down'), { isAxiosError: true, config: {} }))
    const alive = vi.fn().mockResolvedValue({ status: 200, data: configFor('location') })

    const down = usePermissionConfigActions({ client: clientAnswering(dead), system: 'blog', autoFetch: false })
    const up = usePermissionConfigActions({ client: clientAnswering(alive), system: 'weather', autoFetch: false })
    await down.fetchPermissionConfig()
    await up.fetchPermissionConfig()

    expect(down.loadingPermissionConfig.value).toBe(false)
    expect(down.isPermissionConfigInitialized.value).toBe(false)
    expect(up.isPermissionConfigInitialized.value).toBe(true)
  })

  it('asks once however many components ask at the same time', async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, data: configFor('location') })
    const client = clientAnswering(request)

    const first = usePermissionConfigActions({ client, system: 'weather', autoFetch: false })
    const second = usePermissionConfigActions({ client, system: 'weather', autoFetch: false })
    await Promise.all([first.fetchPermissionConfig(), second.fetchPermissionConfig()])

    expect(request).toHaveBeenCalledTimes(1)
  })

  it('does not re-ask once the system is loaded, and does when forced', async () => {
    const request = vi.fn().mockResolvedValue({ status: 200, data: configFor('location') })
    const client = clientAnswering(request)

    const actions = usePermissionConfigActions({ client, system: 'weather', autoFetch: false })
    await actions.fetchPermissionConfig()
    await actions.fetchPermissionConfig()
    expect(request).toHaveBeenCalledTimes(1)

    await actions.fetchPermissionConfig(true)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('falls back to the raw acl key, which is the whole contract of the translation table', async () => {
    // Keyed by whatever language the app is in: the backend ships one entry per language and the
    // lookup is `group.key.lang`, so pinning `en` here would only test the fallback twice.
    const { currentLanguageCode } = useLanguageSettings()
    const request = vi.fn().mockResolvedValue({
      status: 200,
      data: {
        ...configFor('location'),
        translation: {
          subjects: { location: { [currentLanguageCode.value]: 'Location' } },
          actions: {},
          roles: {},
        },
      },
    })

    const actions = usePermissionConfigActions({
      client: clientAnswering(request),
      system: 'weather',
      autoFetch: false,
    })
    await actions.fetchPermissionConfig()

    expect(actions.translatePermission('subjects', 'location')).toBe('Location')
    // Never blank: the ACL vocabulary lives in the backend yaml and an untranslated one is shown
    // as the key an operator can search for.
    expect(actions.translatePermission('actions', 'ui')).toBe('ui')
  })

  it('reads as an empty config before the first answer, so a template can render', () => {
    const actions = usePermissionConfigActions({
      client: clientAnswering(vi.fn()),
      system: 'weather',
      autoFetch: false,
    })

    expect(actions.permissionConfig.value.config).toEqual({})
    expect(actions.isPermissionConfigInitialized.value).toBe(false)
  })
})
