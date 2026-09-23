import { AnzuError } from '@/model/error/AnzuError'
import axios from 'axios'

export const isAnzuApiTimeoutError = (error: any): error is AnzuApiTimeoutError => {
  return error instanceof AnzuApiTimeoutError
}

export const axiosErrorIsTimeout = (error: Error) => {
  return (
    axios.isAxiosError(error) &&
    (error.code === 'ECONNABORTED' ||
      error.message.includes('timeout') ||
      (error.cause instanceof Error && error.cause.message.includes('timeout')))
  )
}

/**
 * Custom error class for timeout error
 */
export class AnzuApiTimeoutError extends AnzuError {
  constructor(cause: Error | undefined = undefined) {
    super('API request timed out')
    this.name = 'AnzuApiTimeoutError'
    this.cause = cause
  }
}
