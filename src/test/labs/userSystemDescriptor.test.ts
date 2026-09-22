import { describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import type { AnzuUser } from '@/types/AnzuUser'
import {
  defineUserSystemDescriptor,
  resolveCreateEndpoint,
  resolveEnabledWrite,
  resolveMetadataWrite,
  resolveProbeEndpoint,
  type AnyUserSystemDescriptor,
  type UserSystemEndpoints,
} from '@/labs/anzuUser/userSystemDescriptor'

// Which path carries which operation is the descriptor's job to state, because the two paths are
// not interchangeable: `/adm/users` in cms answers `CmsUserDto` and its PUT runs
// `updateRelations()` over seven scalars and twelve collections, while `/adm/v1/anzu-user` answers
// the entity and does not. A GET on one and a write to the other drops whatever the other carries.

const client = () => ({}) as unknown as AxiosInstance

const descriptor = (endpoints: UserSystemEndpoints, system = 'test'): AnyUserSystemDescriptor =>
  defineUserSystemDescriptor({
    system,
    client,
    entity: 'anzuUser',
    isEnabled: () => true,
    requiredMetadata: false,
    idInput: true,
    endpoints,
  })

const anzuUserOnly: UserSystemEndpoints = {
  anzuUser: { get: '/adm/v1/anzu-user/:id', put: '/adm/v1/anzu-user/:id', post: '/adm/v1/anzu-user' },
  base: null,
  permissionGroup: '/adm/v1/permission-group',
  currentUser: '/adm/v1/anzu-user/current',
  list: '/adm/v1/anzu-user',
  probe: 'anzuUser',
}

const withBase: UserSystemEndpoints = {
  anzuUser: { get: '/adm/v1/anzu-user/:id', put: '/adm/v1/anzu-user/:id', post: '/adm/v1/anzu-user' },
  base: {
    get: '/adm/users/:id',
    put: '/adm/users/:id',
    patch: '/adm/users/:id',
    post: '/adm/users',
  },
  permissionGroup: '/adm/v1/permission-group',
  currentUser: '/adm/users/current',
  list: '/adm/users',
  probe: 'base',
}

describe('user system descriptor', () => {
  it('sends metadata through PATCH wherever that path exists', () => {
    // The method behind it can only write e-mail, locale, avatar and person -- it has no setter
    // for roles, grants, groups or `enabled`. That is a stronger guarantee than a careful body.
    expect(resolveMetadataWrite(descriptor(withBase))).toEqual({
      method: 'PATCH',
      get: '/adm/users/:id',
      url: '/adm/users/:id',
    })
  })

  it('falls back to the full PUT where there is no PATCH', () => {
    expect(resolveMetadataWrite(descriptor(anzuUserOnly))).toEqual({
      method: 'PUT',
      get: '/adm/v1/anzu-user/:id',
      url: '/adm/v1/anzu-user/:id',
    })
  })

  it('pairs the enabled write with a GET on the same path', () => {
    // There is no PATCH for `enabled` anywhere: the only method that calls `setEnabled` is the full
    // update. So the body has to be the whole DTO the GET on that same path returned.
    expect(resolveEnabledWrite(descriptor(withBase))).toEqual({ get: '/adm/users/:id', url: '/adm/users/:id' })
    expect(resolveEnabledWrite(descriptor(anzuUserOnly))).toEqual({
      get: '/adm/v1/anzu-user/:id',
      url: '/adm/v1/anzu-user/:id',
    })
  })

  it('creates the same way it writes', () => {
    expect(resolveCreateEndpoint(descriptor(withBase))).toBe('/adm/users')
    expect(resolveCreateEndpoint(descriptor(anzuUserOnly))).toBe('/adm/v1/anzu-user')
  })

  it('probes the path the descriptor names, not the one that happens to exist', () => {
    expect(resolveProbeEndpoint(descriptor(withBase)).get).toBe('/adm/users/:id')
    // dam names `base` deliberately: `/adm/v1/anzu-user` has no gating there, so only the other
    // path can ever render "you have no access".
    expect(resolveProbeEndpoint(descriptor({ ...withBase, probe: 'anzuUser' })).get).toBe('/adm/v1/anzu-user/:id')
  })

  it('reports a probe naming a path the system does not have', () => {
    // Both branches are nullable, so the type cannot state this. Every admin asserts it for each of
    // its systems -- contentHub has no `/adm/v1/anzu-user` at all.
    const contentHub = descriptor({ ...withBase, anzuUser: null, probe: 'anzuUser' }, 'contentHub')

    expect(() => resolveProbeEndpoint(contentHub)).toThrow(/contentHub/)
  })

  it('erases the user type once, where the array is built', () => {
    // `AnzuUser & { status: string }`, not `any`: with `any` the boundary erases nothing and the
    // test would pass however the generic were declared. This is the shape the plan describes --
    // a descriptor that reaches for a field the base user does not have.
    interface BlogUser extends AnzuUser {
      status: string
    }
    const blog = defineUserSystemDescriptor<'blog', BlogUser>({
      system: 'blog',
      client,
      entity: 'anzuUser',
      isEnabled: () => true,
      requiredMetadata: false,
      idInput: true,
      extraState: (user) => (user.status === 'ban' ? { label: 'blogger', value: 'banned', tone: 'error' } : null),
      endpoints: anzuUserOnly,
    })

    const systems: AnyUserSystemDescriptor[] = [descriptor(withBase, 'cms'), blog]

    expect(systems).toHaveLength(2)
    expect(blog.extraState?.({ status: 'ban' } as never)).toMatchObject({ tone: 'error' })
  })

  it('answers whether the system is switched on in this admin', () => {
    const off = defineUserSystemDescriptor({
      system: 'weather',
      client,
      entity: 'anzuUser',
      isEnabled: vi.fn().mockReturnValue(false),
      requiredMetadata: false,
      idInput: true,
      endpoints: anzuUserOnly,
    })

    // Mandatory, not optional: "disabled in configuration" is a state that has to be shown, so
    // leaving the system out of the array is not the same thing.
    expect(off.isEnabled()).toBe(false)
  })
})
