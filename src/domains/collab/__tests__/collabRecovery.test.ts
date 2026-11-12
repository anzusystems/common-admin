import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import {
  COLLAB_BEFORE_RECONNECT_TIMEOUT_MS,
  COLLAB_RETRY_DELAYS_MS,
  COLLAB_STUCK_REPORT_MS,
  createCollabRecovery,
} from '@/domains/collab/composables/collabRecovery'
import { CollabConnectionState, type CollabConnectionStateType } from '@/domains/collab/types/Collab'

// A tab left open overnight: the network drops while the token is valid, and the server refuses it in the
// morning, once the token expired. The refusal has to refresh and connect, whatever errors came before it.

const setup = ({
  beforeReconnect = vi.fn<() => unknown>(async () => undefined),
  isSameIdentity = (): boolean | undefined => undefined,
} = {}) => {
  const socket = { connected: false, active: false, connect: vi.fn(), disconnect: vi.fn() }
  const state = ref<CollabConnectionStateType>(CollabConnectionState.Connected)
  const logError = vi.fn()
  const recovery = createCollabRecovery({ socket, state, beforeReconnect, isSameIdentity, logError })
  return { socket, state, logError, recovery, beforeReconnect }
}

const refusal = (reason = 'tokenInvalid') => Object.assign(new Error(''), { data: { reason } })
const settle = () => vi.advanceTimersByTimeAsync(0)
const pending = () => {
  let resolve!: (value: unknown) => void
  const promise = new Promise((r) => (resolve = r))
  return { promise, resolve }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
})

describe('a refusal', () => {
  it('still refreshes and connects after transport errors, which ask and spend nothing', async () => {
    const { recovery, socket, state, beforeReconnect, logError } = setup()

    recovery.onTransportError()
    recovery.onTransportError()
    expect(beforeReconnect).not.toHaveBeenCalled()
    expect(state.value).toBe(CollabConnectionState.Reconnecting)

    recovery.onRefused(refusal())
    await settle()

    expect(beforeReconnect).toHaveBeenCalledTimes(1)
    expect(socket.connect).toHaveBeenCalledTimes(1)
    expect(logError).not.toHaveBeenCalled()
  })

  it('for another account is final, without asking beforeReconnect', async () => {
    const { recovery, socket, state, beforeReconnect } = setup()

    recovery.onRefused(refusal('identityMismatch'))
    await settle()

    expect(state.value).toBe(CollabConnectionState.IdentityChanged)
    expect(beforeReconnect).not.toHaveBeenCalled()
    expect(socket.connect).not.toHaveBeenCalled()
  })

  it('twice with a ready verdict ends in rejected, reported once with its reason', async () => {
    const { recovery, socket, state, logError } = setup()

    for (let i = 0; i < 3; i++) {
      recovery.onRefused(refusal())
      await settle()
    }
    expect(state.value).toBe(CollabConnectionState.Rejected)
    expect(socket.connect).toHaveBeenCalledTimes(2)
    expect(logError).toHaveBeenCalledTimes(1)
    expect(logError.mock.calls[0]![0].message).toBe('Collaboration connection rejected: tokenInvalid')
    expect(logError.mock.calls[0]![1]).toMatchObject({
      level: 'error',
      tags: { collabPhase: 'connectRejected', collabRejectReason: 'tokenInvalid' },
      fingerprint: ['collab-connect-rejected', 'tokenInvalid'],
    })

    // The user tries again and it fails the same way: no second report.
    void recovery.retry()
    for (let i = 0; i < 3; i++) {
      recovery.onRefused(refusal())
      await settle()
    }
    expect(logError).toHaveBeenCalledTimes(1)
  })
})

describe('the verdict', () => {
  it.each([CollabConnectionState.SessionEnded, CollabConnectionState.IdentityChanged])(
    '%s stops without connecting or reporting',
    async (verdict) => {
      const { recovery, socket, state, logError } = setup({ beforeReconnect: vi.fn(async () => verdict) })

      recovery.onRefused(refusal())
      await settle()
      await vi.advanceTimersByTimeAsync(COLLAB_STUCK_REPORT_MS)

      expect(state.value).toBe(verdict)
      expect(socket.connect).not.toHaveBeenCalled()
      expect(logError).not.toHaveBeenCalled()
    }
  )

  it('retryLater waits, retries after the delay, and at once when the network is back', async () => {
    const beforeReconnect = vi.fn<() => unknown>(async () => 'ready')
    beforeReconnect.mockResolvedValueOnce('retryLater').mockResolvedValueOnce('retryLater')
    const { recovery, socket, state } = setup({ beforeReconnect })

    recovery.onRefused(refusal())
    await settle()
    expect(state.value).toBe(CollabConnectionState.WaitingForNetwork)
    expect(socket.connect).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(COLLAB_RETRY_DELAYS_MS[0]!)
    expect(beforeReconnect).toHaveBeenCalledTimes(2)
    expect(state.value).toBe(CollabConnectionState.WaitingForNetwork)

    recovery.retryIfWaiting()
    await settle()
    expect(beforeReconnect).toHaveBeenCalledTimes(3)
    expect(socket.connect).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['an unknown verdict', () => Promise.resolve('foo')],
    ['a rejection', () => Promise.reject(new Error('refresh helper crashed'))],
    ['no answer', () => new Promise(() => {})],
  ])('%s means retryLater, reported once however often it repeats', async (_, hook) => {
    const { recovery, socket, state, logError } = setup({ beforeReconnect: vi.fn(hook) })

    recovery.onRefused(refusal())
    await vi.advanceTimersByTimeAsync(COLLAB_BEFORE_RECONNECT_TIMEOUT_MS)
    expect(state.value).toBe(CollabConnectionState.WaitingForNetwork)

    await vi.advanceTimersByTimeAsync(COLLAB_RETRY_DELAYS_MS[0]! + COLLAB_BEFORE_RECONNECT_TIMEOUT_MS)
    expect(socket.connect).not.toHaveBeenCalled()
    expect(logError).toHaveBeenCalledTimes(1)
    expect(logError.mock.calls[0]![1]).toMatchObject({ level: 'warning', tags: { collabPhase: 'beforeReconnect' } })
  })

  it('that comes after a connect is dropped', async () => {
    const hook = pending()
    const { recovery, socket, state } = setup({ beforeReconnect: vi.fn(() => hook.promise) })

    recovery.onRefused(refusal())
    await settle()
    socket.connected = true
    recovery.onConnect()
    hook.resolve('sessionEnded')
    await settle()

    expect(state.value).toBe(CollabConnectionState.Connected)
    expect(socket.connect).not.toHaveBeenCalled()
  })
})

describe('retries', () => {
  it('asked at once share one beforeReconnect', async () => {
    const hook = pending()
    const { recovery, beforeReconnect, socket } = setup({ beforeReconnect: vi.fn(() => hook.promise) })

    const all = Promise.all([recovery.retry(), recovery.retry(), recovery.retry()])
    hook.resolve('ready')
    await all

    expect(beforeReconnect).toHaveBeenCalledTimes(1)
    expect(socket.connect).toHaveBeenCalledTimes(1)
  })

  it('do nothing while a handshake or socket.io reconnection is under way', async () => {
    const { recovery, beforeReconnect, socket } = setup()
    socket.active = true

    await recovery.retry()

    expect(beforeReconnect).not.toHaveBeenCalled()
  })

  it('stop on pagehide and resume when the page comes back from the back-forward cache', async () => {
    const beforeReconnect = vi.fn<() => unknown>(async () => 'retryLater')
    const { recovery } = setup({ beforeReconnect })

    recovery.onRefused(refusal())
    await settle()
    recovery.onPageHide()
    await vi.advanceTimersByTimeAsync(COLLAB_RETRY_DELAYS_MS[0]!)
    expect(beforeReconnect).toHaveBeenCalledTimes(1)

    recovery.onPageShow(true)
    await settle()
    expect(beforeReconnect).toHaveBeenCalledTimes(2)
  })

  it('follow a disconnect by the server, not one by the transport', async () => {
    const { recovery, beforeReconnect } = setup()

    recovery.onDisconnect('transport close')
    await settle()
    expect(beforeReconnect).not.toHaveBeenCalled()

    recovery.onDisconnect('io server disconnect')
    await settle()
    expect(beforeReconnect).toHaveBeenCalledTimes(1)
  })
})

describe("socket.io's own reconnection", () => {
  it('is stopped when the cookies belong to another account', () => {
    const { recovery, socket, state } = setup({ isSameIdentity: () => false })

    expect(recovery.onReconnectAttempt()).toBe(true)
    expect(socket.disconnect).toHaveBeenCalledTimes(1)
    expect(state.value).toBe(CollabConnectionState.IdentityChanged)
  })

  it.each([true, undefined])('goes on when the identity check answers %s', (answer) => {
    const { recovery, socket } = setup({ isSameIdentity: () => answer })

    expect(recovery.onReconnectAttempt()).toBe(false)
    expect(socket.disconnect).not.toHaveBeenCalled()
  })
})

describe('a connection that does not come back', () => {
  it('is reported once after 15 minutes', async () => {
    const { recovery, logError } = setup()

    recovery.onDisconnect('transport close')
    await vi.advanceTimersByTimeAsync(COLLAB_STUCK_REPORT_MS)
    recovery.onTransportError()
    await vi.advanceTimersByTimeAsync(COLLAB_STUCK_REPORT_MS)

    expect(logError).toHaveBeenCalledTimes(1)
    expect(logError.mock.calls[0]![1]).toMatchObject({ level: 'warning', tags: { collabPhase: 'transportStuck' } })
  })

  it('is not reported when it comes back in time', async () => {
    const { recovery, socket, logError } = setup()

    recovery.onDisconnect('transport close')
    await vi.advanceTimersByTimeAsync(COLLAB_STUCK_REPORT_MS - 1)
    socket.connected = true
    recovery.onConnect()
    await vi.advanceTimersByTimeAsync(COLLAB_STUCK_REPORT_MS)

    expect(logError).not.toHaveBeenCalled()
  })
})
