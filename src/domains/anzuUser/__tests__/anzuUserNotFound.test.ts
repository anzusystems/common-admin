import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import type { AxiosInstance } from 'axios'
import { useAnzuUserActions } from '@/domains/anzuUser/composables/anzuUserActions'
import { defaultApiErrorLogger, setApiErrorLogger, USER_PROBE_ENTITY } from '@/domains/api/utils/apiErrors'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'
import { httpError, record } from '@/domains/anzuUser/__tests__/support/userSystems'

// A managed system's user page where the person has no account stays in its tabs instead of leaving.
// The page asks for that with `keepOnNotFound`; every other failure keeps leaving the page.

let status = 404
const request = vi.fn((config: { url?: string }) => {
  if (config.url?.endsWith('/42')) return Promise.resolve({ status: 200, data: record() })
  return Promise.reject(httpError(status))
})
const client = () => ({ request }) as unknown as AxiosInstance

let pinia = createPinia()
const inComponent = <T>(fn: () => T): T => {
  let out!: T
  mount(defineComponent({ setup: () => ((out = fn()), () => h('div')) }), { global: { plugins: [pinia] } })
  return out
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  status = 404
  request.mockClear()
  useAlertsQueue().value.splice(0)
})

afterEach(() => {
  setApiErrorLogger(defaultApiErrorLogger)
})

describe('fetchAnzuUser with keepOnNotFound', () => {
  it('stays on a 404, says the account is missing and shows no alert', async () => {
    const actions = inComponent(() => useAnzuUserActions({ client, system: 'brick' }))

    expect(await actions.fetchAnzuUser(7, { keepOnNotFound: true })).toBeUndefined()

    expect(actions.anzuUserNotFound.value).toBe(true)
    expect(actions.anzuUser.value.id).toBeNull()
    expect(useAlertsQueue().value).toEqual([])
  })

  it('names the read as a probe, so the app logger skips the expected 404', async () => {
    const logger = vi.fn()
    setApiErrorLogger(logger)
    const actions = inComponent(() => useAnzuUserActions({ client, system: 'brick' }))

    await actions.fetchAnzuUser(7, { keepOnNotFound: true })

    expect(logger).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ entity: USER_PROBE_ENTITY }))
  })

  it('shows the record once a later fetch finds it', async () => {
    const actions = inComponent(() => useAnzuUserActions({ client, system: 'brick' }))
    await actions.fetchAnzuUser(7, { keepOnNotFound: true })

    expect(await actions.fetchAnzuUser(42, { keepOnNotFound: true })).toBe(true)

    expect(actions.anzuUserNotFound.value).toBe(false)
    expect(actions.anzuUser.value.id).toBe(42)
  })

  it('still leaves on any other failure', async () => {
    status = 500
    const actions = inComponent(() => useAnzuUserActions({ client, system: 'brick' }))

    expect(await actions.fetchAnzuUser(7, { keepOnNotFound: true })).toBe(false)
    expect(actions.anzuUserNotFound.value).toBe(false)
  })

  it('leaves on a 404 without the option, as before', async () => {
    const actions = inComponent(() => useAnzuUserActions({ client, system: 'brick' }))

    expect(await actions.fetchAnzuUser(7)).toBe(false)
    expect(actions.anzuUserNotFound.value).toBe(false)
    expect(useAlertsQueue().value.length).toBeGreaterThan(0)
  })
})
