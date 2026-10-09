export interface UploadSettlementScheduler {
  now(): number
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export interface UploadSettlementVisibility {
  isVisible(): boolean
  onChange(callback: () => void): () => void
}

/**
 * An object with writable fields: a test replaces a field, not the binding. Production code never writes here.
 * The settlement reads the fields at each use, not once when it is created.
 */
export const uploadSettlementRuntime: {
  scheduler: UploadSettlementScheduler
  visibility: UploadSettlementVisibility
} = {
  scheduler: {
    now: () => Date.now(),
    setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  },
  visibility: {
    isVisible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
    onChange: (callback) => {
      if (typeof document === 'undefined') return () => {}
      document.addEventListener('visibilitychange', callback)
      return () => document.removeEventListener('visibilitychange', callback)
    },
  },
}
