export const isAnzuApiResponseCodeError = (error: any): error is AnzuApiResponseCodeError  => {
  return error instanceof AnzuApiResponseCodeError
}

export class AnzuApiResponseCodeError extends Error {
  code: number

  constructor(code: number, cause?: Error, message?: string) {
    super(message)
    this.name = 'AnzuApiResponseCodeError'
    this.cause = cause
    this.code = code
  }
}
