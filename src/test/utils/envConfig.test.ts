import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startWithEnvConfig } from '@/utils/envConfig'

const respond = (body: unknown, init: { status?: number; type?: string } = {}) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status: init.status ?? 200,
          headers: { 'content-type': init.type ?? 'application/json' },
        })
    )
  )

let app: HTMLElement
beforeEach(() => {
  app = document.createElement('div')
  app.id = 'app'
  document.body.appendChild(app)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  app.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('startWithEnvConfig', () => {
  it('applies the config, then starts, and asks for it past any cache', async () => {
    respond({ appVersion: '1.0' })
    const order: string[] = []
    await startWithEnvConfig(
      (config) => order.push('apply ' + JSON.stringify(config)),
      () => {
        order.push('start')
      }
    )

    expect(order).toEqual(['apply {"appVersion":"1.0"}', 'start'])
    expect(vi.mocked(fetch).mock.calls[0]![0]).toMatch(/^\/config\.json\?random=\d+$/)
    expect(app.textContent).toBe('')
  })

  it.each([
    ['a failed response', { appVersion: '1.0' }, { status: 404 }],
    ['a body that is not JSON', { appVersion: '1.0' }, { type: 'text/html' }],
    ['an empty config', {}, {}],
  ])('does not start on %s, and says so', async (_name, body, init) => {
    respond(body, init)
    const start = vi.fn()
    await startWithEnvConfig(() => {}, start)

    expect(start).not.toHaveBeenCalled()
    expect(app.textContent).toMatch(/Fatal error|Fatálna chyba/)
    expect(console.error).toHaveBeenCalled()
  })

  // It used to run inside the config's promise chain, so a failed start read as a config that did not
  // load, and reached no error handler.
  it('reports a failed start as itself, to whatever handles errors', async () => {
    respond({ appVersion: '1.0' })
    const reported = vi.fn()
    vi.stubGlobal('reportError', reported)
    const failure = new Error('plugin install failed')

    await startWithEnvConfig(
      () => {},
      async () => {
        throw failure
      }
    )

    expect(reported).toHaveBeenCalledWith(failure)
    expect(app.textContent).toMatch(/Fatal error|Fatálna chyba/)
  })
})
