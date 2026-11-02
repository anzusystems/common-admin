import type { Ref } from 'vue'
import {
  CollabConnectionState,
  type CollabConnectionStateType,
  CollabReconnectVerdict,
  type CollabReconnectVerdictType,
} from '@/domains/collab/types/Collab'

export const COLLAB_RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 300_000]
export const COLLAB_BEFORE_RECONNECT_TIMEOUT_MS = 20_000
export const COLLAB_STUCK_REPORT_MS = 15 * 60_000

const VERDICTS: ReadonlySet<unknown> = new Set(Object.values(CollabReconnectVerdict))
const TERMINAL: ReadonlySet<CollabConnectionStateType> = new Set([
  CollabConnectionState.SessionEnded,
  CollabConnectionState.IdentityChanged,
  CollabConnectionState.Rejected,
])

export type CollabRefusal = Error & { data?: { reason?: string } }

interface CollabRecoverySocket {
  readonly connected: boolean
  readonly active: boolean
  connect: () => unknown
  disconnect: () => unknown
}

interface CollabRecoveryOptions {
  socket: CollabRecoverySocket
  state: Ref<CollabConnectionStateType>
  beforeReconnect: () => unknown
  isSameIdentity: () => boolean | undefined
  logError: (
    error: Error,
    context: { level: 'error' | 'warning'; tags: Record<string, string>; fingerprint?: string[] }
  ) => void
}

/**
 * Brings a socket the server refused back, once per refusal and never under another account.
 *
 * Transport errors are socket.io's: it reconnects on its own, and nothing here runs for them. A refusal (the
 * server's `connect_error`, after which the socket is no longer `active`) asks `beforeReconnect` what to do and
 * connects the same socket again only on `ready`. A token refresh spent on a transport error used to leave the
 * refusal that followed it, typically after a night, with nothing to recover by.
 */
export function createCollabRecovery({
  socket,
  state,
  beforeReconnect,
  isSameIdentity,
  logError,
}: CollabRecoveryOptions) {
  let generation = 0
  let recovering: Promise<void> | undefined
  let connectedAfterReady = false
  let readyRefusals = 0
  let retryIndex = 0
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let stuckTimer: ReturnType<typeof setTimeout> | undefined
  let paused = false
  const reported = new Set<string>()

  const setState = (next: CollabConnectionStateType) => {
    if (state.value === next) return
    // A console line is a Sentry breadcrumb: the state a later error happened in.
    console.info(`[common-admin] collab connection: ${state.value} -> ${next}`)
    state.value = next
  }

  const reportOnce = (
    phase: string,
    error: Error,
    level: 'error' | 'warning',
    tags: Record<string, string> = {},
    fingerprint?: string[]
  ) => {
    if (paused || reported.has(phase)) return
    reported.add(phase)
    logError(error, { level, tags: { collabPhase: phase, ...tags }, ...(fingerprint && { fingerprint }) })
  }

  const clearRetry = () => {
    clearTimeout(retryTimer)
    retryTimer = undefined
  }
  const clearStuck = () => {
    clearTimeout(stuckTimer)
    stuckTimer = undefined
  }
  const isTerminal = () => TERMINAL.has(state.value)

  // Without it a server out of reach for good (DNS, TLS, CORS) never reports anything.
  const armStuck = () => {
    if (stuckTimer) return
    stuckTimer = setTimeout(() => {
      stuckTimer = undefined
      if (socket.connected || isTerminal()) return
      reportOnce(
        'transportStuck',
        new Error(`Collaboration not connected for ${COLLAB_STUCK_REPORT_MS / 60_000} minutes (${state.value})`),
        'warning'
      )
    }, COLLAB_STUCK_REPORT_MS)
  }

  const settle = (next: CollabConnectionStateType) => {
    generation++
    clearRetry()
    clearStuck()
    setState(next)
  }

  const askBeforeReconnect = async (): Promise<CollabReconnectVerdictType> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        Promise.resolve().then(beforeReconnect),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`beforeReconnect did not settle in ${COLLAB_BEFORE_RECONNECT_TIMEOUT_MS} ms`)),
            COLLAB_BEFORE_RECONNECT_TIMEOUT_MS
          )
        }),
      ])
      if (result === undefined) return CollabReconnectVerdict.Ready
      if (VERDICTS.has(result)) return result as CollabReconnectVerdictType
      throw new Error(`beforeReconnect returned an unknown verdict: ${String(result)}`)
    } catch (error) {
      // Fail closed: connecting with what failed to refresh would only be refused again.
      reportOnce('beforeReconnect', error as Error, 'warning')
      return CollabReconnectVerdict.RetryLater
    } finally {
      clearTimeout(timer)
    }
  }

  const scheduleRetry = () => {
    clearRetry()
    const delay = COLLAB_RETRY_DELAYS_MS[Math.min(retryIndex++, COLLAB_RETRY_DELAYS_MS.length - 1)]
    retryTimer = setTimeout(() => void recover(), delay)
  }

  const recover = (): Promise<void> => {
    // A handshake, or socket.io's own reconnection, is already on its way.
    if (paused || socket.connected || socket.active) return Promise.resolve()
    recovering ??= (async () => {
      const mine = ++generation
      try {
        clearRetry()
        setState(CollabConnectionState.Reconnecting)
        armStuck()
        const verdict = await askBeforeReconnect()
        // A connect, a terminal state or a pagehide came while the hook ran.
        if (mine !== generation || paused || socket.connected) return
        if (verdict === CollabReconnectVerdict.SessionEnded) return settle(CollabConnectionState.SessionEnded)
        if (verdict === CollabReconnectVerdict.IdentityChanged) return settle(CollabConnectionState.IdentityChanged)
        if (verdict === CollabReconnectVerdict.RetryLater) {
          setState(CollabConnectionState.WaitingForNetwork)
          return scheduleRetry()
        }
        connectedAfterReady = true
        socket.connect()
      } finally {
        recovering = undefined
      }
    })()
    return recovering
  }

  return {
    /** The user's "try again": also out of a terminal state, with the retry delays and the refusals counted anew. */
    retry: (): Promise<void> => {
      readyRefusals = 0
      retryIndex = 0
      return recover()
    },
    retryIfWaiting: () => {
      if (state.value === CollabConnectionState.WaitingForNetwork) void recover()
    },
    onTransportError: () => {
      if (state.value === CollabConnectionState.Connected) setState(CollabConnectionState.Reconnecting)
      armStuck()
    },
    onRefused: (error: CollabRefusal) => {
      const reason = error.data?.reason || error.message || 'none'
      if (reason === 'identityMismatch') return settle(CollabConnectionState.IdentityChanged)
      if (connectedAfterReady) readyRefusals++
      connectedAfterReady = false
      // Refused twice with a token the admin called good: no refresh helps, someone has to look.
      if (readyRefusals < 2) return void recover()
      settle(CollabConnectionState.Rejected)
      reportOnce(
        'connectRejected',
        new Error(`Collaboration connection rejected: ${reason}`),
        'error',
        { collabRejectReason: reason },
        ['collab-connect-rejected', reason]
      )
    },
    onConnect: () => {
      generation++
      connectedAfterReady = false
      readyRefusals = 0
      retryIndex = 0
      clearRetry()
      clearStuck()
      setState(CollabConnectionState.Connected)
    },
    onDisconnect: (reason: string) => {
      if (state.value === CollabConnectionState.Connected) setState(CollabConnectionState.Reconnecting)
      armStuck()
      if (reason === 'io server disconnect') void recover()
    },
    /** socket.io reconnects without `beforeReconnect`; stop it before cookies of another account are sent. */
    onReconnectAttempt: (): boolean => {
      if (isSameIdentity() !== false) return false
      socket.disconnect()
      settle(CollabConnectionState.IdentityChanged)
      return true
    },
    onPageHide: () => {
      paused = true
      generation++
      clearRetry()
      clearStuck()
    },
    onPageShow: (persisted: boolean) => {
      if (!persisted) return
      paused = false
      if (!isTerminal() && !socket.connected && !socket.active) void recover()
    },
  }
}
