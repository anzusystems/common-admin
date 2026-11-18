import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import type { AxiosInstance } from 'axios'
import { usePermissionGroupActions } from '@/domains/permission/group/composables/permissionGroupActions'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'
import { commonT } from '@/plugins/i18n'

// An update answered after the page was left writes nothing: the store holds the next page's record,
// another group or the blank one of the create page. The user is still told the group was saved.

const record = (id: number, system: string) => ({
  id,
  title: `G${id}`,
  description: '',
  permissions: {},
  createdAt: '2026-01-01T00:00:00Z',
  modifiedAt: '2026-01-01T00:00:00Z',
  createdBy: 1,
  modifiedBy: 1,
  _resourceName: 'permissionGroup',
  _system: system,
})

const isPut = (config: { method?: string }) => config.method?.toUpperCase() === 'PUT'

let answerPut: () => void = () => {}
/** Unset, a GET is answered at once; a test that acts while one is out sets it and answers later. */
let holdGet: ((answer: () => void) => void) | undefined
const request = vi.fn((config: { method?: string; url?: string; data?: unknown }, system: string) => {
  if (isPut(config)) {
    const body = JSON.parse(String(config.data ?? '{}'))
    const data = { ...body, modifiedAt: '2026-11-05T10:00:00Z', modifiedBy: 2 }
    return new Promise((resolve) => (answerPut = () => resolve({ status: 200, data })))
  }
  const id = /\/(\d+)(?:\?|$)/.exec(config.url ?? '')?.[1]
  const res = { status: 200, data: record(Number(id), system) }
  if (!holdGet) return Promise.resolve(res)
  const hold = holdGet
  return new Promise((resolve) => hold(() => resolve(res)))
})
const clientOf = (system: string) => () =>
  ({ request: (config: Parameters<typeof request>[0]) => request(config, system) }) as unknown as AxiosInstance

let pinia = createPinia()
beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  request.mockClear()
  answerPut = () => {}
  holdGet = undefined
  useAlertsQueue().value = []
})
const inComponent = <T>(fn: () => T): T => {
  let out!: T
  mount(defineComponent({ setup: () => ((out = fn()), () => h('div')) }), { global: { plugins: [pinia] } })
  return out
}
const groupPage = (system = 'cms') => inComponent(() => usePermissionGroupActions({ client: clientOf(system), system }))

const putSent = () => vi.waitFor(() => expect(request.mock.calls.some(([config]) => isPut(config))).toBe(true))

/** Group 5 opened and saved; the PUT is out until the test answers it. */
const savingGroup5 = async () => {
  const actions = groupPage()
  await actions.fetchPermissionGroup(5)
  const saved = actions.updatePermissionGroup()
  await putSent()
  return { actions, saved }
}

const toldUpdated = () =>
  expect(useAlertsQueue().value).toEqual([
    expect.objectContaining({ color: 'success', text: commonT('common.alert.recordWas.updated') }),
  ])

const untouched = (group: { modifiedBy: unknown; modifiedAt: unknown }) => {
  expect(group.modifiedBy).toBe(1)
  expect(group.modifiedAt).toBe('2026-01-01T00:00:00Z')
}

describe('a permission group update answered after the page was left', () => {
  it.each([
    // What leaving the edit page does: it unmounts, and the next page opens its record.
    ['the page unmounts and the next one opens another group', true],
    // A route to another group that keeps the page mounted only fetches.
    ['the same page opens another group', false],
  ])('writes nothing into the next group: %s', async (_, unmounts) => {
    const { actions, saved } = await savingGroup5()
    if (unmounts) actions.resetPermissionGroupStore()
    await actions.fetchPermissionGroup(8)
    answerPut()

    await expect(saved).resolves.toBe(true)
    toldUpdated()
    expect(actions.permissionGroup.value.id).toBe(8)
    untouched(actions.permissionGroup.value)
  })

  // The store is shared by systems: admin-inhouse has a group page per system, so a check by id would write here.
  it('writes nothing into another system’s group with the same id', async () => {
    const { actions, saved } = await savingGroup5()
    actions.resetPermissionGroupStore()
    const next = groupPage('weather')
    await next.fetchPermissionGroup(5)
    answerPut()

    await expect(saved).resolves.toBe(true)
    toldUpdated()
    expect(next.permissionGroup.value._system).toBe('weather')
    expect(next.permissionGroup.value.id).toBe(5)
    untouched(next.permissionGroup.value)
  })

  it('writes nothing into the create page’s blank record', async () => {
    const { actions, saved } = await savingGroup5()
    // The create page mounts on a reset store.
    actions.resetPermissionGroupStore()
    answerPut()

    await expect(saved).resolves.toBe(true)
    toldUpdated()
    expect(actions.permissionGroup.value.id).toBe(0)
    expect(actions.permissionGroup.value.modifiedBy).toBe(0)
    expect(actions.permissionGroup.value.createdBy).toBe(0)
  })

  // The save reads the generation of a fetch already out, which bumps nothing when it lands.
  it('writes nothing into the group of a fetch that was loading when the save went out', async () => {
    const actions = groupPage()
    await actions.fetchPermissionGroup(5)
    let answerGet: () => void = () => {}
    holdGet = (answer) => (answerGet = answer)
    const loading = actions.fetchPermissionGroup(8)
    holdGet = undefined
    const saved = actions.updatePermissionGroup()
    await putSent()
    answerGet()
    await expect(loading).resolves.toBe(true)
    answerPut()

    await expect(saved).resolves.toBe(true)
    toldUpdated()
    expect(actions.permissionGroup.value.id).toBe(8)
    untouched(actions.permissionGroup.value)
  })

  it('still brings the tracking into the form the save came from', async () => {
    const { actions, saved } = await savingGroup5()
    answerPut()

    await expect(saved).resolves.toBe(true)
    toldUpdated()
    expect(actions.permissionGroup.value.id).toBe(5)
    expect(actions.permissionGroup.value.modifiedBy).toBe(2)
    expect(actions.permissionGroup.value.modifiedAt).toBe('2026-11-05T10:00:00Z')
  })
})
