/**
 * The auth backend could not answer the refresh (403, 5xx, timeout, network), as opposed to "the
 * session is gone". A request stopped by it rejects with this, so a caller can tell it from a 403 of
 * the request itself -- anywhere in the `.cause` chain, since the api helpers wrap what they catch.
 */
export class AuthUnavailableError extends Error {
  constructor(cause: unknown) {
    super('Auth backend unavailable', { cause })
    this.name = 'AuthUnavailableError'
  }
}
