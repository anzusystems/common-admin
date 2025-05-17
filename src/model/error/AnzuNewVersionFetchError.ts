export const isAnzuNewVersionFetchError = (error: unknown): error is AnzuNewVersionFetchError => {
  return error instanceof AnzuNewVersionFetchError
}

export class AnzuNewVersionFetchError extends Error {
  private originalError: Error | null

  constructor(message = '', originalError: Error | null = null) {
    super(message)
    this.name = 'AnzuNewVersionFetchError'
    this.message = message
    this.originalError = originalError
  }
}
