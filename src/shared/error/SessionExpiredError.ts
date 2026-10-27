/** The session is gone: no cookie left to refresh with, or the refresh was refused. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired')
    this.name = 'SessionExpiredError'
  }
}
