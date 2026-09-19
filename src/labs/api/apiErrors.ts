import axios, { type AxiosError } from 'axios'
import { AnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'
import { AnzuApiCancelledError, axiosErrorIsCancelled } from '@/model/error/AnzuApiCancelledError'
import {
  AnzuApiDependencyExistsError,
  axiosErrorResponseHasDependencyExistsData,
} from '@/model/error/AnzuApiDependencyExistsError'
import { AnzuApiForbiddenError, axiosErrorResponseIsForbidden } from '@/model/error/AnzuApiForbiddenError'
import {
  AnzuApiForbiddenOperationError,
  axiosErrorResponseHasForbiddenOperationData,
} from '@/model/error/AnzuApiForbiddenOperationError'
import { AnzuApiResponseCodeError } from '@/model/error/AnzuApiResponseCodeError'
import { AnzuApiTimeoutError, axiosErrorIsTimeout } from '@/model/error/AnzuApiTimeoutError'
import { AnzuApiValidationError, axiosErrorResponseHasValidationData } from '@/model/error/AnzuApiValidationError'
import { AnzuError, isAnzuError } from '@/model/error/AnzuError'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'

export type ApiErrorContext = {
  system: string
  entity: string
  /** The url actually requested, parameters substituted and query included -- not the template. */
  url?: string
}

export type ApiErrorLogger = (error: Error, context: ApiErrorContext) => void

/** What reporting does until an application says otherwise; exported so a test can put it back. */
export const defaultApiErrorLogger: ApiErrorLogger = (error, context) => {
  console.error('Api error: ' + (context.url ?? ''), error)
}

let logger: ApiErrorLogger | null = defaultApiErrorLogger

/**
 * Replaces the logger the api helpers report unexpected failures through, or turns reporting off
 * with `null`.
 *
 * It is one switch for the whole family rather than a flag on each instance, which is what it
 * replaces: whether a failure was written down used to depend on which helper made the call and how
 * that instance happened to be constructed.
 *
 * An application that wants these where it can see them passes its own:
 * `setApiErrorLogger((e, ctx) => Sentry.captureException(e, { extra: ctx }))`.
 */
export const setApiErrorLogger = (fn: ApiErrorLogger | null): void => {
  logger = fn
}

// Only the failures nobody planned for. A validation or forbidden answer is the backend saying
// something the caller asked about and will show; writing those down as well would be noise that
// teaches people to ignore the log.
const LOGGED = [AnzuApiAxiosError, AnzuFatalError, AnzuApiResponseCodeError]

/**
 * Reports an error once, after it has been mapped, and hands it back so the caller can throw it.
 *
 * After, not during: an error the helper raised itself -- a body that never arrived, a status it
 * refuses -- is already an `Anzu*` class by the time it reaches the mapping, so a logger placed
 * inside the mapping would never see the two cases it exists for.
 */
export const report = <E>(error: E, context: ApiErrorContext): E => {
  if (logger !== null && LOGGED.some((cls) => error instanceof cls)) {
    try {
      logger(error as unknown as Error, context)
    } catch {
      // A logger that throws must not replace the failure the caller is waiting for.
    }
  }

  return error
}

/**
 * Turns whatever axios rejected with into one of the Anzu error classes.
 *
 * There used to be a copy of this inside each helper. The order of the checks is what decides which
 * class a failure becomes, so four copies were four chances for the same failure to arrive under
 * different names depending on which helper made the call.
 */
export const mapApiError = (err: unknown, context: ApiErrorContext): AnzuError => {
  const { system, entity } = context
  // The predicates below are typed against `Error` / `AxiosError` and each begins by checking what
  // it was handed, so narrowing here only satisfies their signatures.
  const error = err as Error
  const axiosError = err as AxiosError

  // Already mapped -- including the errors a helper raised about its own contract. Wrapping it again
  // would bury the class the caller branches on.
  if (isAnzuError(err)) return err

  // Before everything else, because it is not a failure: the caller stopped this request.
  if (axiosErrorIsCancelled(err)) return new AnzuApiCancelledError(error)

  if (axiosErrorResponseIsForbidden(axiosError)) return new AnzuApiForbiddenError(axiosError, axiosError.config?.url)

  if (axiosErrorResponseHasValidationData(axiosError)) {
    return new AnzuApiValidationError(axiosError, system, entity, error)
  }

  if (axiosErrorResponseHasDependencyExistsData(axiosError)) {
    return new AnzuApiDependencyExistsError(axiosError, system, entity, error)
  }

  if (axiosErrorResponseHasForbiddenOperationData(axiosError)) {
    return new AnzuApiForbiddenOperationError(axiosError, error)
  }

  if (axiosErrorIsTimeout(error)) return new AnzuApiTimeoutError(error)

  if (axios.isAxiosError(err)) return new AnzuApiAxiosError(axiosError)

  return new AnzuFatalError(error)
}
