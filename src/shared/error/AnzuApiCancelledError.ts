import axios from 'axios'
import { AnzuError } from '@/shared/error/AnzuError'

export const isAnzuApiCancelledError = (error: unknown): error is AnzuApiCancelledError => {
  return error instanceof AnzuApiCancelledError
}

/**
 * A request the caller stopped, as opposed to one that failed.
 * Axios reports it as a `CanceledError` with `code: 'ERR_CANCELED'`, not
 * as a `DOMException`. An `AbortController`-style check never fires.
 */
export const axiosErrorIsCancelled = (error: unknown) =>
  // Both checks are needed. `isCancel` reads an internal marker on errors axios constructs.
  // The code check catches a cancellation that arrives as a plain
  // object, rebuilt across a boundary or passed in by a test.
  axios.isCancel(error) || (axios.isAxiosError(error) && error.code === 'ERR_CANCELED')

/**
 * A stopped request is a normal outcome, such as another autocomplete keystroke or a route change during loading.
 * Reported as a transport failure, it would show the user an error for their own action.
 */
export class AnzuApiCancelledError extends AnzuError {
  constructor(cause: unknown = undefined) {
    super('API request was cancelled', cause)
    this.name = 'AnzuApiCancelledError'
  }
}
