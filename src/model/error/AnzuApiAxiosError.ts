import type { AxiosError } from 'axios'

export const isAnzuApiAxiosError = (error: unknown): error is AnzuApiAxiosError => {
  return error instanceof AnzuApiAxiosError
}

/**
 * Custom error class for Axios-related errors
 */
export class AnzuApiAxiosError extends Error {
  declare cause: AxiosError

  constructor(cause: AxiosError) {
    super('API request failed')
    this.name = 'AnzuApiAxiosError'
    this.cause = cause
  }
}
