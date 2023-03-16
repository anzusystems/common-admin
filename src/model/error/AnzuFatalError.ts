export const isAnzuFatalError = (error: any): error is AnzuFatalError  => {
  return error instanceof AnzuFatalError
}

export class AnzuFatalError extends Error {
  constructor(cause?: Error, message = '') {
    super(message)
    this.name = 'AnzuFatalError'
    this.cause = cause
    this.message = message
  }
}
