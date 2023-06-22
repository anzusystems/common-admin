export const isAnzuApiForbiddenError = (error: unknown): error is AnzuNewVersionFetchError => {
  return error instanceof AnzuNewVersionFetchError
}

export class AnzuNewVersionFetchError extends Error {
  constructor(message = '') {
    super(message)
    this.name = 'AnzuNewVersionFetchError'
    this.message = message
  }
}
