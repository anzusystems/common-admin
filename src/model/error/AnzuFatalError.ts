export const isAnzuFatalError = (error: any): error is AnzuFatalError => {
  return error instanceof AnzuFatalError
}

export class AnzuFatalError extends Error {
  constructor(cause?: Error, message = '') {
    // Empty message renders as "No error message" in Sentry.
    const resolvedMessage = message || 'Unexpected error'
    super(resolvedMessage)
    this.name = 'AnzuFatalError'
    this.cause = cause
    this.message = resolvedMessage
  }
}
