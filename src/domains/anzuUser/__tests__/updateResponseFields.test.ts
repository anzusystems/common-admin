import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import type { AxiosInstance } from 'axios'
import { useAnzuUserActions, type AnzuUserActionsParams } from '@/domains/anzuUser/composables/anzuUserActions'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'
import { commonT } from '@/plugins/i18n'

// An update keeps what the user filled in and takes from the answer only the tracking and the fields the admin
// names: the ones the backend recalculates on save and the form only shows (DAM's "User in external systems").
// An answer that arrives after the page was left writes nothing, since the store holds the next page's record.
// The user is still told the record was saved.

const record = (id = 5, system = 'cms') => ({
  id,
  email: `u${id}@sme.sk`,
  enabled: true,
  roles: [],
  permissionGroups: [],
  permissions: {},
  resolvedPermissions: {},
  person: { firstName: 'U', lastName: String(id), fullName: `U ${id}` },
  avatar: { color: '#000000', text: 'U' },
  userToExtSystems: [] as number[],
  // A field the backend accepts but leaves out of its answer.
  notInTheAnswer: 'filled in',
  createdAt: '2026-01-01T00:00:00Z',
  modifiedAt: '2026-01-01T00:00:00Z',
  createdBy: 1,
  modifiedBy: 1,
  _resourceName: 'user',
  _system: system,
})

const answer = (body: Record<string, unknown>) => {
  const data: Record<string, unknown> = {
    ...body,
    email: 'normalized@sme.sk',
    userToExtSystems: [3],
    modifiedAt: '2026-11-05T10:00:00Z',
    modifiedBy: 2,
  }
  delete data.notInTheAnswer
  return { status: 200, data }
}

const isPut = (config: { method?: string }) => config.method?.toUpperCase() === 'PUT'

/** Unset, the PUT is answered at once; a test that acts while it is out sets it and answers later. */
let holdPut: ((answer: () => void) => void) | undefined
/** The same for a GET. */
let holdGet: ((answer: () => void) => void) | undefined
const request = vi.fn((config: { method?: string; url?: string; data?: unknown }, system: string) => {
  if (isPut(config)) {
    const body = JSON.parse(String(config.data ?? '{}'))
    if (!holdPut) return Promise.resolve(answer(body))
    const hold = holdPut
    return new Promise((resolve) => hold(() => resolve(answer(body))))
  }
  const id = /\/(\d+)(?:\?|$)/.exec(config.url ?? '')?.[1]
  const res = { status: 200, data: record(id ? Number(id) : undefined, system) }
  if (!holdGet) return Promise.resolve(res)
  const hold = holdGet
  return new Promise((resolve) => hold(() => resolve(res)))
})
const clientOf = (system: string) => () =>
  ({ request: (config: Parameters<typeof request>[0]) => request(config, system) }) as unknown as AxiosInstance
const client = clientOf('cms')

let pinia = createPinia()
beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  request.mockClear()
  holdPut = undefined
  holdGet = undefined
  useAlertsQueue().value = []
})
const inComponent = <T>(fn: () => T): T => {
  let out!: T
  mount(defineComponent({ setup: () => ((out = fn()), () => h('div')) }), { global: { plugins: [pinia] } })
  return out
}

const opened = async (updateResponseFields?: AnzuUserActionsParams['updateResponseFields']) => {
  const actions = inComponent(() => useAnzuUserActions({ client, system: 'cms', updateResponseFields }))
  await actions.fetchAnzuUser(5)
  actions.markPristine()
  return actions
}

const field = (actions: Awaited<ReturnType<typeof opened>>, name: string) =>
  (actions.anzuUser.value as unknown as Record<string, unknown>)[name]

const putSent = () => vi.waitFor(() => expect(request.mock.calls.some(([config]) => isPut(config))).toBe(true))

/** The PUT of the save is out until the test answers it. */
const saving = async (actions: Awaited<ReturnType<typeof opened>>) => {
  let answerPut: () => void = () => {}
  holdPut = (answer) => (answerPut = answer)
  const saved = actions.updateAnzuUser()
  await putSent()
  return { saved, answerPut: () => answerPut() }
}

const toldUpdated = () =>
  expect(useAlertsQueue().value).toEqual([
    expect.objectContaining({ color: 'success', text: commonT('common.alert.recordWas.updated') }),
  ])

/** The record as its GET brought it: none of the answer's tracking or fields, and the form not edited. */
const untouched = (actions: Awaited<ReturnType<typeof opened>>, email: string) => {
  expect(actions.anzuUser.value.email).toBe(email)
  expect(actions.anzuUser.value.modifiedBy).toBe(1)
  expect(actions.anzuUser.value.modifiedAt).toBe('2026-01-01T00:00:00Z')
  expect(field(actions, 'userToExtSystems')).toEqual([])
  expect(actions.isDirty.value).toBe(false)
}

describe('updateResponseFields', () => {
  it('copies the named fields of the answer besides the tracking, and the form is saved', async () => {
    const actions = await opened(['userToExtSystems'])

    await expect(actions.updateAnzuUser()).resolves.toBe(true)

    expect(field(actions, 'userToExtSystems')).toEqual([3])
    expect(actions.anzuUser.value.modifiedBy).toBe(2)
    expect(actions.anzuUser.value.modifiedAt).toBe('2026-11-05T10:00:00Z')
    // What the user filled in stays, even where the answer differs.
    expect(actions.anzuUser.value.email).toBe('u5@sme.sk')
    expect(actions.isDirty.value).toBe(false)
    // The answer replaces the reload: no GET after the save.
    expect(request.mock.calls.filter(([config]) => !isPut(config))).toHaveLength(1)
  })

  it('copies only the tracking when unset', async () => {
    const actions = await opened()

    await expect(actions.updateAnzuUser()).resolves.toBe(true)

    expect(field(actions, 'userToExtSystems')).toEqual([])
    expect(actions.anzuUser.value.modifiedBy).toBe(2)
    expect(actions.isDirty.value).toBe(false)
  })

  it('keeps the value of a named field the answer leaves out', async () => {
    const actions = await opened(['userToExtSystems', 'notInTheAnswer'])

    await expect(actions.updateAnzuUser()).resolves.toBe(true)

    expect(field(actions, 'userToExtSystems')).toEqual([3])
    expect(field(actions, 'notInTheAnswer')).toBe('filled in')
    expect(actions.isDirty.value).toBe(false)
  })
})

describe.each([
  ['with fields to copy', ['userToExtSystems']],
  ['with only the tracking', undefined],
])('an update answered after the page was left, %s', (_, fields) => {
  it.each([
    // What leaving the edit page does: it unmounts, and the next page opens its record.
    ['the page unmounts and the next one opens another user', true],
    // A route to another user that keeps the page mounted only fetches.
    ['the same page opens another user', false],
  ])('writes nothing into the next record: %s', async (_, unmounts) => {
    const actions = await opened(fields)
    const { saved, answerPut } = await saving(actions)
    if (unmounts) actions.resetAnzuUserStore('cms')
    await actions.fetchAnzuUser(8)
    answerPut()

    await expect(saved).resolves.toBe(true)
    toldUpdated()
    expect(actions.anzuUser.value.id).toBe(8)
    untouched(actions, 'u8@sme.sk')
  })

  // The store is shared by systems: a cross-system user page opens one per system, so a check by id would write here.
  it('writes nothing into another system’s user with the same id', async () => {
    const actions = await opened(fields)
    const { saved, answerPut } = await saving(actions)
    actions.resetAnzuUserStore('cms')
    const next = inComponent(() =>
      useAnzuUserActions({ client: clientOf('weather'), system: 'weather', updateResponseFields: fields })
    )
    await next.fetchAnzuUser(5)
    answerPut()

    await expect(saved).resolves.toBe(true)
    toldUpdated()
    expect(next.anzuUser.value._system).toBe('weather')
    expect(next.anzuUser.value.id).toBe(5)
    untouched(next, 'u5@sme.sk')
  })

  // The save reads the generation of a fetch already out, which bumps nothing when it lands.
  it('writes nothing into the record of a fetch that was loading when the save went out', async () => {
    const actions = await opened(fields)
    let answerGet: () => void = () => {}
    holdGet = (answer) => (answerGet = answer)
    const loading = actions.fetchAnzuUser(8)
    holdGet = undefined
    const { saved, answerPut } = await saving(actions)
    answerGet()
    await expect(loading).resolves.toBe(true)
    answerPut()

    await expect(saved).resolves.toBe(true)
    toldUpdated()
    expect(actions.anzuUser.value.id).toBe(8)
    untouched(actions, 'u8@sme.sk')
  })
})
