import { beforeEach, describe, expect, it, vi } from 'vitest'
import { START_LOCATION, type Router } from 'vue-router'
import { createNavigationErrorHandler } from '@/domains/system/composables/navigationError'
import { commonT } from '@/plugins/i18n'

vi.mock('@/domains/system/composables/alertsQueue', () => ({ pushAlert: vi.fn() }))
vi.mock('@/domains/system/systemBar/utils/appReload', () => ({ requestAppReload: vi.fn() }))
const logError = vi.fn()
vi.mock('@/domains/system/composables/sentry', () => ({ useSentry: () => ({ logError }) }))

// Without a handler a failed navigation only reaches the console: the click does nothing visible.

const routerAt = (currentRoute: unknown) => ({ currentRoute: { value: currentRoute } }) as unknown as Router
const loaded = { path: '/records', fullPath: '/records' }
const chunkError = new TypeError('Failed to fetch dynamically imported module: https://cms/assets/page-123.js')

const mocks = async () => {
  const { pushAlert } = await import('@/domains/system/composables/alertsQueue')
  const { requestAppReload } = await import('@/domains/system/systemBar/utils/appReload')
  return { pushAlert: vi.mocked(pushAlert), requestAppReload: vi.mocked(requestAppReload) }
}

beforeEach(async () => {
  const { pushAlert, requestAppReload } = await mocks()
  pushAlert.mockClear()
  requestAppReload.mockReset()
  logError.mockClear()
})

describe('createNavigationErrorHandler', () => {
  it('says the page could not be opened, and reports it', async () => {
    const error = new Error('guard threw')
    createNavigationErrorHandler(routerAt(loaded))(error)

    const { pushAlert, requestAppReload } = await mocks()
    expect(pushAlert).toHaveBeenCalledWith('error', commonT('common.alert.navigationFailed'), 3000)
    expect(requestAppReload).not.toHaveBeenCalled()
    expect(logError).toHaveBeenCalledWith(error)
  })

  it.each([
    ['Chromium', new TypeError('Failed to fetch dynamically imported module: https://cms/assets/a.js')],
    ['Safari', new TypeError('Importing a module script failed.')],
    ['Firefox', new TypeError('error loading dynamically imported module: https://cms/assets/a.js')],
    ['a route stylesheet (Vite)', new Error('Unable to preload CSS for /assets/a.css')],
    ['webpack-style', Object.assign(new Error('Loading chunk 3 failed.'), { name: 'ChunkLoadError' })],
  ])('reloads for a chunk that cannot be fetched: %s', async (_name, error) => {
    const { pushAlert, requestAppReload } = await mocks()
    requestAppReload.mockReturnValue(true)

    createNavigationErrorHandler(routerAt(loaded))(error)

    expect(requestAppReload).toHaveBeenCalledTimes(1)
    expect(pushAlert).not.toHaveBeenCalled()
  })

  it('shows the message instead of reloading for an admin that opts out', async () => {
    const { pushAlert, requestAppReload } = await mocks()
    requestAppReload.mockReturnValue(true)

    createNavigationErrorHandler(routerAt(loaded), { reloadOnChunkError: false })(chunkError)

    expect(requestAppReload).not.toHaveBeenCalled()
    expect(pushAlert).toHaveBeenCalledTimes(1)
  })

  it('keeps the message up when the first navigation fails right after a reload', async () => {
    const { pushAlert, requestAppReload } = await mocks()
    requestAppReload.mockReturnValue(false)

    createNavigationErrorHandler(routerAt(START_LOCATION))(new Error('guard threw'))

    expect(pushAlert).toHaveBeenCalledWith('error', commonT('common.alert.navigationFailed'), -1000)
  })

  it('calls the first-navigation callback once, and survives callbacks that throw', async () => {
    const { pushAlert, requestAppReload } = await mocks()
    requestAppReload.mockReturnValue(false)
    const onFirstNavigationError = vi.fn(() => {
      throw new Error('error page failed too')
    })
    const onError = vi.fn(() => {
      throw new Error('overlay reset failed')
    })
    const handle = createNavigationErrorHandler(routerAt(START_LOCATION), { onError, onFirstNavigationError })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => handle(new Error('first'))).not.toThrow()
    expect(() => handle(new Error('the error page failed'))).not.toThrow()

    expect(onFirstNavigationError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledTimes(2)
    // The throwing callback left the loader on screen, so both failures keep the message up.
    expect(pushAlert).toHaveBeenCalledTimes(2)
    expect(pushAlert).toHaveBeenLastCalledWith('error', commonT('common.alert.navigationFailed'), -1000)
    consoleError.mockRestore()
  })

  it('reloads for a chunk an old tab cannot fetch any more, without a message', async () => {
    const { pushAlert, requestAppReload } = await mocks()
    requestAppReload.mockReturnValue(true)

    createNavigationErrorHandler(routerAt(loaded))(chunkError)

    expect(requestAppReload).toHaveBeenCalledTimes(1)
    expect(pushAlert).not.toHaveBeenCalled()
  })

  it('shows the message when the reload was done a moment ago', async () => {
    const { pushAlert, requestAppReload } = await mocks()
    requestAppReload.mockReturnValue(false)

    createNavigationErrorHandler(routerAt(loaded))(chunkError)

    expect(pushAlert).toHaveBeenCalledTimes(1)
  })

  it('reloads once when the very first navigation fails, unless the admin handles it', async () => {
    const { pushAlert, requestAppReload } = await mocks()
    requestAppReload.mockReturnValue(true)
    createNavigationErrorHandler(routerAt(START_LOCATION))(new Error('guard threw'))
    expect(requestAppReload).toHaveBeenCalledTimes(1)
    expect(pushAlert).not.toHaveBeenCalled()

    requestAppReload.mockClear()
    const onFirstNavigationError = vi.fn()
    const onError = vi.fn()
    createNavigationErrorHandler(routerAt(START_LOCATION), { onError, onFirstNavigationError })(new Error('x'))
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onFirstNavigationError).toHaveBeenCalledTimes(1)
    expect(requestAppReload).not.toHaveBeenCalled()
  })
})
