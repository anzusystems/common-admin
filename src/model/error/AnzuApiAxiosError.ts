/**
 * Custom error class for Axios-related errors
 */
export class AnzuApiAxiosError extends Error {
  constructor(cause: Error) {
    super('API request failed')
    this.name = 'AnzuApiAxiosError'
    this.cause = cause
  }
}
