import axios from 'axios'

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
export class AnzuApiTimeoutError extends Error {
  constructor(cause: Error | undefined = undefined) {
    super('API request failed')
    this.name = 'AnzuApiAxiosError'
    this.cause = cause
  }
}
