import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import { defineUserSystemDescriptor } from '@/labs/anzuUser/userSystemDescriptor'
import { useUserSystemProbe } from '@/labs/anzuUser/userSystemProbe'
import { UserSystemPresence } from '@/labs/anzuUser/userSystemState'
import { defaultApiErrorLogger, mapApiError, report, setApiErrorLogger } from '@/labs/api/apiErrors'
import { AuthUnavailableError } from '@/model/error/AuthUnavailableError'
import { SessionExpiredError } from '@/model/error/SessionExpiredError'

const notFound = () =>
  Object.assign(new Error('failed'), {
    isAxiosError: true,
    config: { url: '/adm/v1/anzu-user/42' },
    response: { status: 404, data: {} },
  })

afterEach(() => {
  setApiErrorLogger(defaultApiErrorLogger)
  vi.restoreAllMocks()
})

describe('default api error logger and the user probe', () => {
  it('does not write an "Api error" for an absent account, which is the probe\'s answer', async () => {
    setActivePinia(createPinia())
    setApiErrorLogger(defaultApiErrorLogger)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const request = vi.fn().mockRejectedValue(notFound())
    const probe = useUserSystemProbe({
      descriptor: defineUserSystemDescriptor({
        system: 'weather',
        client: () => ({ request }) as unknown as AxiosInstance,
        entity: 'anzuUser',
        isEnabled: () => true,
        requiredMetadata: false,
        idInput: true,
        endpoints: {
          anzuUser: { get: '/adm/v1/anzu-user/:id', put: '/adm/v1/anzu-user/:id', post: '/adm/v1/anzu-user' },
          base: { get: '/adm/users/:id', put: '/adm/users/:id', patch: '/adm/users/:id', post: '/adm/users' },
          permissionGroup: '/adm/v1/permission-group',
          currentUser: '/adm/v1/anzu-user/current',
          list: '/adm/v1/anzu-user',
          probe: 'anzuUser',
        },
      }),
    })
    await probe.probe(42)

    expect(probe.axes.value.presence).toBe(UserSystemPresence.Absent)
    expect(consoleError.mock.calls.filter(([m]) => String(m).startsWith('Api error'))).toEqual([])
  })

  it('does not write an "Api error" for a request the refresh stopped because the session is gone', () => {
    setApiErrorLogger(defaultApiErrorLogger)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const context = { system: 'blog', entity: 'x', url: '/adm/v1/x' }

    report(mapApiError(new SessionExpiredError(), context), context)
    expect(consoleError.mock.calls.filter(([m]) => String(m).startsWith('Api error'))).toEqual([])

    report(mapApiError(new AuthUnavailableError(new Error('503')), context), context)
    expect(consoleError.mock.calls.filter(([m]) => String(m).startsWith('Api error'))).toHaveLength(1)
  })
})
