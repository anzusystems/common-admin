import { vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import {
  defineUserSystemDescriptor,
  type AnyUserSystemDescriptor,
} from '@/domains/anzuUser/composables/userSystemDescriptor'

export const record = (over: Record<string, unknown> = {}) => ({
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

export const httpError = (status: number) =>
  Object.assign(new Error('failed'), {
    isAxiosError: true,
    config: { url: '/adm/v1/anzu-user/42' },
    response: { status, data: {} },
  })

type RequestConfig = { method?: string; url?: string; data?: string }

/** A system without the person: every read answers 404, a create succeeds. */
export const absentSystem = () =>
  vi.fn((config: RequestConfig) =>
    config.method?.toUpperCase() === 'POST'
      ? Promise.resolve({ status: 201, data: JSON.parse(config.data ?? '{}') })
      : Promise.reject(httpError(404))
  )

/** A system holding the person. */
export const presentSystem = (over: Record<string, unknown> = {}) =>
  vi.fn(() => Promise.resolve({ status: 200, data: record(over) }))

export const posted = (request: ReturnType<typeof vi.fn>) =>
  request.mock.calls
    .map((call) => call[0] as RequestConfig)
    .filter((config) => config.method?.toUpperCase() === 'POST')
    .map((config) => JSON.parse(config.data ?? '{}'))

export const descriptor = (
  system: string,
  label: string,
  request: ReturnType<typeof vi.fn>,
  over: Partial<AnyUserSystemDescriptor> = {}
): AnyUserSystemDescriptor =>
  defineUserSystemDescriptor({
    system,
    label,
    client: () => ({ request }) as unknown as AxiosInstance,
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
    manage: () => ({ kind: 'external', href: 'https://example.test/users/42/edit' }),
    ...over,
  })
