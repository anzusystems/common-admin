/**
 * The auth backend could not answer the refresh (403, 5xx, timeout, network). This differs from an expired session.
 * A request stopped by it rejects with this error, so a caller can tell it from a 403 of the request itself.
 * Check the whole `.cause` chain, because the api helpers wrap what they catch.
 */
export class AuthUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Auth backend unavailable', { cause })
    this.name = 'AuthUnavailableError'
  }
}
