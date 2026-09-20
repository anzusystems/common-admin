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
import { HTTP_STATUS_FORBIDDEN, HTTP_STATUS_UNAUTHORIZED } from '@/composables/statusCodes'

export type ApiErrorContext = {
  system: string
  entity: string
  /** The url actually requested, parameters substituted and query included -- not the template. */
  url?: string
  /**
   * The status the backend answered with, when it answered at all. Absent for a transport failure,
   * where there is no response.
   *
   * It is here so an application can decide what is worth writing down without the call sites having
   * to: a 404 that a caller probes for, for instance. Those used to be silenced per call, which made
   * whether a failure was recorded depend on which call made it. The switch is the application's now,
   * and this is what it needs to use it.
   *
   * Two statuses are not the application's to decide, and the library keeps them: 401 and 403. They
   * are not an endpoint failing its contract, they are the session -- nobody is logged in, or this
   * user may not -- and every admin in the fleet already branches on them and acts. Everything else
   * reaches the logger and is filtered here, on this field.
   */
  status?: number
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
/** The status the backend answered with, read off whichever class carries it. */
const answeredStatus = (error: unknown): number | undefined => {
  if (error instanceof AnzuApiResponseCodeError) return error.code
  if (error instanceof AnzuApiAxiosError) return error.cause.response?.status

  return undefined
}

export const report = <E>(error: E, context: ApiErrorContext): E => {
  const status = answeredStatus(error)
  // Neither of these is an unplanned failure. A 401 is "nobody is logged in", which every admin
  // branches on before sending the user to the login page -- writing it down would mean an "Api
  // error" for every unauthenticated start of the app. A 403 is "this user may not", which the
  // caller shows. Both are the session rather than an endpoint breaking its contract.
  //
  // By status rather than by class, because the class only keeps it quiet on one of the two paths: a
  // rejected 403 becomes `AnzuApiForbiddenError`, which is outside `LOGGED`, while one that arrives
  // fulfilled -- as `options.validateStatus` allows -- becomes an `AnzuApiResponseCodeError`, which
  // is inside it. Left to the class, the policy would hold or not depending on how the caller
  // configured axios.
  //
  // It is the one thing the `status` field above does not leave to the application, and deliberately:
  // an app that wanted its own unauthenticated starts in the log would be asking for noise it cannot
  // act on, while an app that wants 404 or 409 filtered has the field to do it with.
  if (status === HTTP_STATUS_UNAUTHORIZED || status === HTTP_STATUS_FORBIDDEN) return error

  if (logger !== null && LOGGED.some((cls) => error instanceof cls)) {
    try {
      // Filled in here rather than by the caller: the status belongs to the failure, and only the
      // mapped error knows it -- the helper that built the context has not looked at the error yet.
      logger(error as unknown as Error, { ...context, status })
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

  // The rendered url, not `config.url`: that one is relative, carries no params, and would become
  // this error's `message` -- the only url in the family that never went through `requestedUrl`.
  if (axiosErrorResponseIsForbidden(axiosError)) return new AnzuApiForbiddenError(axiosError, context.url)

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
