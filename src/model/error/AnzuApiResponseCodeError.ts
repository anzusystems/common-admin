export const isAnzuApiResponseCodeError = (error: any): error is AnzuApiResponseCodeError => {
  return error instanceof AnzuApiResponseCodeError
}

export class AnzuApiResponseCodeError extends Error {
  code: number

  constructor(code: number, cause?: Error, message?: string) {
    // Empty message renders as "No error message" in Sentry.
    const resolvedMessage = message || `API responded with unexpected status code ${code}`
    super(resolvedMessage)
    this.name = 'AnzuApiResponseCodeError'
    this.cause = cause
    this.code = code
  }
}
