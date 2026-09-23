import axios from 'axios'
import { AnzuError } from '@/model/error/AnzuError'

export const isAnzuApiCancelledError = (error: unknown): error is AnzuApiCancelledError => {
  return error instanceof AnzuApiCancelledError
}

/**
 * A request the caller stopped, told apart from a request that failed.
 *
 * Axios reports it as a `CanceledError` -- an axios error carrying `code: 'ERR_CANCELED'`, not the
 * `DOMException` an `AbortController`-shaped check would look for, which is why such a check never
 * fires.
 */
export const axiosErrorIsCancelled = (error: unknown) =>
  // Both, because they answer for different things. `isCancel` reads an internal marker axios puts
  // on the error it constructs; the code check catches a cancellation that arrived as a plain
  // object -- rebuilt across a boundary, or handed over by a test.
  axios.isCancel(error) || (axios.isAxiosError(error) && error.code === 'ERR_CANCELED')

/**
 * A stopped request is an ordinary outcome -- another keystroke in an autocomplete, a route change
 * while a list is loading -- so it needs a class of its own. Reported as a transport failure it
 * would raise an error at the user for something the user did.
 */
export class AnzuApiCancelledError extends AnzuError {
  constructor(cause: unknown = undefined) {
    super('API request was cancelled', cause)
    this.name = 'AnzuApiCancelledError'
  }
}
